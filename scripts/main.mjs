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

/** Spec's "small verification task": the exact path to the sheet class. */
const SHEET_CLASS_PATH = "dnd5e.applications.actor.CharacterActorSheet";

function getCharacterSheetClass() {
  const direct = foundry.utils.getProperty(globalThis, SHEET_CLASS_PATH);
  if (direct) return direct;
  // Fallback: find it in the registered sheet classes.
  const entry = Object.values(CONFIG.Actor?.sheetClasses?.character ?? {})
    .find(e => e.cls?.name === "CharacterActorSheet");
  return entry?.cls ?? null;
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

  // 3. Tab and part registration on the character sheet class.
  const cls = getCharacterSheetClass();
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

  // 6. Chat card button wiring (Phase 3). Our cards only; guarded by flag.
  Hooks.on("renderChatMessageHTML", onRenderChatMessage);
});
