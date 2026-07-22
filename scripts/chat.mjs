/**
 * Ability chat cards (Phase 3).
 *
 * Posting builds the whole card from the live actor at post time; the message
 * stores only the item uuid, under our own flags namespace (never flags.dnd5e:
 * dnd5e resolves its flags through Activity handlers our subtypes lack, and
 * its flags-to-message-type migration would break us silently). The attack
 * bonus and Save DC recompute from level and the BASE framework ability
 * modifier, so they are Attunement-blind by design: the roadmap pins that as
 * the Phase 3 expectation, and the engine phase revisits (same flag as
 * tab.mjs).
 */

import {
  MODULE_ID, FRAMEWORK_TABS, identityFor, buildAbilitySummary, displayCost
} from "./tab.mjs";

/** Delegated handler for the per-row post control ([data-veyl-post]). */
export async function onPostCard(app, target) {
  const li = target.closest("li.item");
  const actor = app.actor ?? app.document;
  const item = actor?.items.get(li?.dataset.itemId);
  if (!item) return;
  await postAbilityCard(item);
}

/** Post one ability's read-only card to chat. */
export async function postAbilityCard(item) {
  const actor = item.actor;
  if (!actor) return;
  const sys = item.system;
  const fw = sys.framework;
  const identity = identityFor(actor, fw);
  const abl = identity?.system.ability;
  // BASE ability modifier (see the note in tab.mjs; Phase 6 revisits when
  // Attunement becomes an Active Effect).
  const mod = actor.system.abilities?.[abl]?.mod ?? 0;
  const prof = actor.system.attributes?.prof ?? 0;
  const level = actor.system.details?.level ?? 1;

  const fwTab = FRAMEWORK_TABS.find(t => t.id === fw);
  const cost = displayCost(sys.discipline, level);
  const costUnit = fw === "magecraft" ? ` ${game.i18n.localize("VEYL.MP")}` : "";

  const context = {
    name: item.name,
    img: item.img,
    subtitle: `${game.i18n.localize(fwTab?.label ?? fw)}, `
      + game.i18n.localize(`VEYL.Discipline.${sys.discipline}`),
    costLabel: `${game.i18n.localize("VEYL.Cost")}: ${cost}${costUnit}`,
    summary: await buildAbilitySummary(item, { framework: fw, level }),
    isAttack: sys.resolution === "attack",
    isSave: sys.resolution === "save",
    attackBonus: (prof + mod >= 0 ? "+" : "") + (prof + mod),
    saveLine: game.i18n.format("VEYL.SaveLine", {
      dc: 8 + prof + mod,
      ability: CONFIG.DND5E?.abilities?.[sys.saveAbility]?.label ?? sys.saveAbility
    })
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    `modules/${MODULE_ID}/templates/chat-card.hbs`, context
  );
  return ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { [MODULE_ID]: { itemUuid: item.uuid } }
  });
}

/**
 * renderChatMessageHTML hook (v13 name; html is an HTMLElement). Binds our
 * attack button on our own cards only.
 */
export function onRenderChatMessage(message, html) {
  if (!message.getFlag(MODULE_ID, "itemUuid")) return;
  html.querySelector('[data-action="veyl-attack"]')
    ?.addEventListener("click", event => onAttackRoll(message, event));
}

/** 1d20 + prof + BASE framework ability mod, recomputed at click time. */
async function onAttackRoll(message, event) {
  const item = await fromUuid(message.getFlag(MODULE_ID, "itemUuid"));
  const actor = item?.actor;
  if (!item || !actor) {
    ui.notifications.warn(game.i18n.localize("VEYL.MissingCardItem"));
    return;
  }
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
        { rolls: [{ parts: ["@mod", "@prof"], data: rollData, options: {} }], event },
        {},
        { data: messageData }
      );
      return;
    } catch (err) {
      console.warn(`${MODULE_ID} | D20Roll.build failed; falling back to a plain roll.`, err);
    }
  }
  const roll = await new Roll("1d20 + @mod + @prof", rollData).evaluate();
  await roll.toMessage(messageData);
}
