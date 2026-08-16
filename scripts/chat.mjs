/**
 * Ability chat cards (Phase 3 reference cards + v0.9 use-time buttons).
 *
 * Posting builds the whole card from the live actor at post time; the message
 * stores our own flags namespace only (never flags.dnd5e: dnd5e resolves its
 * flags through Activity handlers our subtypes lack, and its flags-to-message
 * -type migration would break us silently). Attunement is an ActiveEffect on
 * the ability SCORE (design §5), so every derived .mod read here is already
 * Attunement-aware — "up" while the Echo holds, base after collapse or
 * Burnout — with zero read changes; the one deliberately base read (MP max)
 * lives inside engine manaState(). Receipt cards freeze their DC at cast;
 * attack rolls recompute mod/prof live at click.
 */

import {
  MODULE_ID, FRAMEWORK_TABS, identityFor, buildAbilitySummary, displayCost
} from "./tab.mjs";
import { DISCIPLINE_GROUPS, MP_COSTS, echoReserve } from "./models.mjs";
import { manaState, checkStrain } from "./engine.mjs";
import { useAbility } from "./use.mjs";

/** Delegated handler for the per-row post control ([data-veyl-post]). */
export async function onPostCard(app, target) {
  const li = target.closest("li.item");
  const actor = app.actor ?? app.document;
  const item = actor?.items.get(li?.dataset.itemId);
  if (!item) return;
  await postAbilityCard(item);
}

/**
 * Post-time affordability hint for the reference card's Use button (design
 * §7.3): cosmetic only — the click-time flow re-validates against live state
 * and toasts when the card has gone stale. Magecraft cards only; Arts cards
 * get no button and stay byte-identical.
 */
function referenceUseButton(identity, item, level) {
  const state = manaState(identity);
  const discipline = item.system.discipline;
  let reasonKey = null;
  if (discipline === "echo" && state.echoActive) {
    reasonKey = null;                       // Collapse is never blocked (§9).
  } else if (state.burnedOut) {
    reasonKey = "VEYL.Blocked.Burnout";
  } else if (discipline === "surge") {
    const hp = identity.actor?.system.attributes?.hp?.value ?? 0;
    if (level < 5) reasonKey = "VEYL.Blocked.Level";
    else if (state.available + Math.floor(hp / 2) < 15) reasonKey = "VEYL.Blocked.InsufficientMP";
  } else if (discipline === "echo") {
    if (state.available < echoReserve(level)) reasonKey = "VEYL.Blocked.InsufficientMP";
  } else if (checkStrain(identity, DISCIPLINE_GROUPS[discipline], 1).locked) {
    reasonKey = "VEYL.Blocked.Strained";
  } else if (MP_COSTS[1] > state.available) {
    reasonKey = "VEYL.Blocked.InsufficientMP";
  }
  return {
    disabled: !!reasonKey,
    reason: reasonKey ? game.i18n.localize(reasonKey) : ""
  };
}

/** Post one ability's read-only reference card to chat. */
export async function postAbilityCard(item) {
  const actor = item.actor;
  if (!actor) return;
  const sys = item.system;
  const fw = sys.framework;
  const identity = identityFor(actor, fw);
  const abl = identity?.system.ability;
  // Derived .mod: Attunement-aware via the Echo's ActiveEffect (design §5).
  const mod = actor.system.abilities?.[abl]?.mod ?? 0;
  const prof = actor.system.attributes?.prof ?? 0;
  const level = actor.system.details?.level ?? 1;
  const magecraft = fw === "magecraft" && !!identity;

  const fwTab = FRAMEWORK_TABS.find(t => t.id === fw);
  const cost = displayCost(sys.discipline, level);
  const costUnit = fw === "magecraft" ? ` ${game.i18n.localize("VEYL.MP")}` : "";

  const context = {
    name: item.name,
    img: item.img,
    subtitle: `${game.i18n.localize(fwTab?.label ?? fw)}, `
      + game.i18n.localize(`VEYL.Discipline.${sys.discipline}`),
    costLabel: `${game.i18n.localize("VEYL.Cost")}: ${cost}${costUnit}`,
    summary: await buildAbilitySummary(item, {
      framework: fw, level,
      strainLocks: magecraft ? [...identity.system.strainLocks] : []
    }),
    isAttack: sys.resolution === "attack",
    isSave: sys.resolution === "save",
    attackBonus: (prof + mod >= 0 ? "+" : "") + (prof + mod),
    saveLine: game.i18n.format("VEYL.SaveLine", {
      dc: 8 + prof + mod,
      ability: CONFIG.DND5E?.abilities?.[sys.saveAbility]?.label ?? sys.saveAbility
    }),
    useButton: magecraft ? referenceUseButton(identity, item, level) : null
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    `modules/${MODULE_ID}/templates/chat-card.hbs`, context
  );
  return ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: {
      [MODULE_ID]: {
        itemUuid: item.uuid,
        identityUuid: identity?.uuid ?? null,
        kind: "reference"
      }
    }
  });
}

/* -------------------------------------------- */
/*  Card button dispatch                        */
/* -------------------------------------------- */

/** data-action → handler(message, event, button) (design §7.3). */
const CARD_ACTIONS = {
  "veyl-use": onCardUse,
  "veyl-attack": onAttackRoll,
  "veyl-save": onSaveClick
};

/**
 * renderChatMessageHTML hook (v13 name; html is an HTMLElement). Binds our
 * card buttons on our own cards only; owner-visibility on the buttons is
 * dnd5e's _displayChatActionButtons (data-visibility="all" keeps the save
 * public for its targets).
 */
export function onRenderChatMessage(message, html) {
  if (!message.getFlag(MODULE_ID, "itemUuid")) return;
  for (const [action, handler] of Object.entries(CARD_ACTIONS)) {
    for (const button of html.querySelectorAll(`[data-action="${action}"]`)) {
      button.addEventListener("click", event => handler(message, event, button));
    }
  }
}

/** Resolve the card's item; a vanished item warns and dead-ends cleanly. */
async function cardItem(message) {
  const item = await fromUuid(message.getFlag(MODULE_ID, "itemUuid"));
  if (!item?.actor) {
    ui.notifications.warn(game.i18n.localize("VEYL.MissingCardItem"));
    return null;
  }
  return item;
}

/**
 * Reference-card Use: the same picker/spend/receipt flow as the sheet row
 * (use.mjs owns the inFlight guard and click-time re-validation, so a stale
 * card refuses with a localized toast and never half-spends).
 */
async function onCardUse(message, event, button) {
  button.disabled = true;
  try {
    const item = await cardItem(message);
    if (!item) return;
    await useAbility(item, event);
  } finally {
    button.disabled = false;
  }
}

/**
 * 1d20 + prof + framework ability mod, recomputed at click time — the derived
 * .mod is the live (Attunement-aware) value. hookNames is deliberately
 * omitted (design §7.4): passing ["attack"] would fire dnd5e's native attack
 * hook chain with a config lacking subject/activity, which ecosystem
 * listeners routinely dereference. config.event still buys the adv/dis
 * keybinds and roll grouping natively.
 */
async function onAttackRoll(message, event, button) {
  button.disabled = true;
  try {
    const item = await cardItem(message);
    const actor = item?.actor;
    if (!item || !actor) return;
    const identity = identityFor(actor, item.system.framework);
    const abl = identity?.system.ability;
    const mod = actor.system.abilities?.[abl]?.mod ?? 0;
    const prof = actor.system.attributes?.prof ?? 0;

    const rollData = { mod, prof };
    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format("VEYL.AttackFlavor", { name: item.name })
    };

    // The 5.x BasicRoll pattern: build() runs the native configuration dialog
    // and posts the result. Fall back to a plain roll if the shape ever moves
    // out from under us, so the button never dead-ends a session.
    const D20Roll = CONFIG.Dice?.D20Roll;
    if (typeof D20Roll?.build === "function") {
      try {
        await D20Roll.build(
          { event, rolls: [{ parts: ["@mod", "@prof"], data: rollData, options: {} }] },
          { options: { window: {
            title: game.i18n.localize("VEYL.AttackRoll"),
            subtitle: item.name,
            icon: item.img
          } } },
          { data: messageData }
        );
        return;
      } catch (err) {
        console.warn(`${MODULE_ID} | D20Roll.build failed; falling back to a plain roll.`, err);
      }
    }
    const roll = await new Roll("1d20 + @mod + @prof", rollData).evaluate();
    await roll.toMessage(messageData);
  } finally {
    button.disabled = false;
  }
}

/**
 * Save resolution (design §7.5): clicker-rolls-own-selection, the native
 * SaveActivity model — no sockets, no whispers. The DC was frozen at cast
 * (a property of the casting); target: buys dnd5e's native success/failure
 * highlighting on the roll message.
 */
async function onSaveClick(message, event, button) {
  button.disabled = true;
  try {
    const ability = button.dataset.ability;
    const dc = Number(button.dataset.dc);
    let actors = (canvas?.tokens?.controlled ?? [])
      .map(t => t.actor).filter(a => a);
    actors = [...new Set(actors)];
    if (!actors.length && game.user.character) actors = [game.user.character];
    if (!actors.length) {
      ui.notifications.warn(game.i18n.localize("VEYL.NoTokenSelected"));
      return;
    }
    for (const actor of actors) {
      await actor.rollSavingThrow(
        { event, ability, target: dc },
        {},
        { data: { speaker: ChatMessage.getSpeaker({ actor }) } }
      );
    }
  } finally {
    button.disabled = false;
  }
}
