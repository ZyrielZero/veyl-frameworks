/**
 * Veyl Frameworks: scaffold entry point.
 *
 * Registers at init, before any sheet renders (the spike proved container
 * placement happens at first insertion only, so init-time registration is
 * load-bearing, not just tidy).
 */

import { FrameworkData, AbilityData } from "./models.mjs";
import { MODULE_ID, FRAMEWORK_TABS, prepareFrameworkContext } from "./tab.mjs";
import { onRenderCharacterSheet } from "./pill.mjs";
import { registerVeylSheets } from "./item-sheets.mjs";
import { onRenderChatMessage } from "./chat.mjs";
import {
  onPreRestCompleted, onRestCompleted, sweepCombatExpiry,
  convertBurnoutsOnCombatEnd, sweepWorldTimeExpiry, rewriteAttunement,
  onIdentityDeleted, sweepOrphanedEffects
} from "./engine.mjs";

/** Spec's "small verification task": the exact path to the sheet class. */
const SHEET_CLASS_PATH = "dnd5e.applications.actor.CharacterActorSheet";

/** True on exactly one connected client: the active GM (sweep election). */
function isActiveGM() {
  return game.users.activeGM === game.user;
}

Hooks.once("init", () => {
  // 1. Custom Item subtype DataModels.
  Object.assign(CONFIG.Item.dataModels, {
    [`${MODULE_ID}.framework`]: FrameworkData,
    [`${MODULE_ID}.ability`]: AbilityData
  });

  // 2. Dedicated item sheets for both subtypes (Phase 2). Without these,
  // dnd5e's default ItemSheet5e is the default for our types too and throws
  // its hasEffects TypeError on open.
  registerVeylSheets();

  // 3. Tab and part registration on the character sheet class. One resolved
  // path only: registration and the libWrapper target below must never
  // diverge, so the old registered-sheet-classes fallback is gone (a class
  // found by name but not at SHEET_CLASS_PATH would register tabs the
  // wrapper never feeds).
  const cls = foundry.utils.getProperty(globalThis, SHEET_CLASS_PATH);
  if (!cls) {
    console.error(`${MODULE_ID} | CharacterActorSheet not found; framework tabs not registered.`);
    return;
  }

  // TABS and PARTS are plain writable statics shared by every character sheet
  // (verified by spike). Two consequences worth remembering:
  //  - Per-actor visibility cannot live here; it is enforced at render time
  //    in pill.mjs.
  //  - This mutates shared state. If another module ever touches the same
  //    statics, load order matters. Defensive: skip if already present.
  for (const fw of FRAMEWORK_TABS) {
    if (!cls.TABS.some(t => t.tab === fw.id)) {
      cls.TABS.push({ tab: fw.id, label: fw.label, icon: fw.icon });
    }
    cls.PARTS[fw.id] = {
      template: `modules/${MODULE_ID}/templates/tab.hbs`,
      // The container key is load-bearing (spike finding): without it the part
      // renders as a loose child of the form. This matches dnd5e's own PARTS.
      container: { classes: ["tab-body"], id: "tabs" },
      scrollable: [""]
    };
  }

  // 4. Part context via libWrapper (WRAPPER: we always call the wrapped
  // function first, then extend the context for our own partIds).
  libWrapper.register(
    MODULE_ID,
    `${SHEET_CLASS_PATH}.prototype._preparePartContext`,
    async function (wrapped, partId, context, options) {
      context = await wrapped(partId, context, options);
      if (FRAMEWORK_TABS.some(fw => fw.id === partId)) {
        return foundry.utils.mergeObject(context, await prepareFrameworkContext(this, partId));
      }
      return context;
    },
    "WRAPPER"
  );

  // 5. Pill injection and tab visibility on every render.
  Hooks.on("renderCharacterActorSheet", onRenderCharacterSheet);

  // 6. Chat card button wiring (Phase 3, extended in v0.9 to the use/attack/
  // save dispatch table in chat.mjs). Our cards only; guarded by flag. This
  // one hook covers every card action — no further chat hooks are needed.
  Hooks.on("renderChatMessageHTML", onRenderChatMessage);

  // 7. Token status icons for the two engine effects (v0.9). hud: false is
  // load-bearing: without it the token HUD's toggleStatusEffect could
  // create/delete our effects outside the engine — a HUD click could drop
  // the Attunement effect while echoActive stays set, or hand-clear Burnout
  // enforcement. The HUD honors the flag; statuses stay valid for
  // isTemporary/token-icon purposes.
  CONFIG.statusEffects.push(
    {
      id: "veyl-echo", name: "VEYL.Effect.Attunement",
      img: `modules/${MODULE_ID}/icons/echo.svg`, hud: false
    },
    {
      id: "veyl-burnout", name: "VEYL.Effect.Burnout",
      img: `modules/${MODULE_ID}/icons/burnout.svg`, hud: false
    }
  );

  // 8. Magecraft engine hooks (v0.9, design §8). Rest hooks run on the
  // resting client (it owns the actor); the sweeps and cleanup hooks fire on
  // every client, so they elect the active GM to write exactly once.
  Hooks.on("dnd5e.preRestCompleted", onPreRestCompleted);
  Hooks.on("dnd5e.restCompleted", onRestCompleted);
  Hooks.on("updateCombat", (combat, changed) => {
    if (!isActiveGM()) return;
    // Round/turn advance only; other combat updates cannot expire anything.
    if (!("round" in changed) && !("turn" in changed)) return;
    sweepCombatExpiry(combat);
  });
  Hooks.on("deleteCombat", combat => {
    if (isActiveGM()) convertBurnoutsOnCombatEnd(combat);
  });
  Hooks.on("updateWorldTime", () => {
    if (isActiveGM()) sweepWorldTimeExpiry();
  });
  // Level changes rewrite the Attunement effect's frozen bonus (Q7): both the
  // advancement flow and a direct class-item levels edit.
  Hooks.on("dnd5e.advancementManagerComplete", manager => {
    if (isActiveGM() && manager.actor) rewriteAttunement(manager.actor);
  });
  Hooks.on("updateItem", (item, changed) => {
    if (!isActiveGM()) return;
    if (item.type !== "class" || !item.actor) return;
    if (!foundry.utils.hasProperty(changed, "system.levels")) return;
    rewriteAttunement(item.actor);
  });
  // Deleting a Magecraft identity takes both engine effects with it.
  Hooks.on("deleteItem", item => {
    if (isActiveGM()) onIdentityDeleted(item);
  });
});

Hooks.once("ready", () => {
  // Orphan sweep: engine effects whose identity item no longer resolves
  // (a deleteItem that fired with no GM connected leaves them behind).
  if (game.users.activeGM === game.user) sweepOrphanedEffects();
});
