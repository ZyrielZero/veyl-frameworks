/**
 * Part context for the Magecraft and Arts tabs.
 *
 * All values here are DERIVED, never stored, per the spec's identity item schema:
 * MP max, DC, attack, unlocked step, ready hand are computed from actor level
 * and the chosen ability every render.
 */

import { LEGAL_DISCIPLINES } from "./models.mjs";

export const MODULE_ID = "veyl-frameworks";

export const FRAMEWORK_TABS = [
  { id: "magecraft", label: "VEYL.Magecraft", icon: "fas fa-hand-sparkles" },
  { id: "arts", label: "VEYL.Arts", icon: "fas fa-hand-fist" }
];

/** Stance hold by level band (1-4 / 5-9 / 10-14 / 15-19 / 20). */
function stanceHold(level) {
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
}

/** Echo reservation by level band (per the Magecraft reservation table). */
function echoReserve(level) {
  if (level >= 20) return 25;
  if (level >= 15) return 20;
  if (level >= 10) return 15;
  if (level >= 5) return 10;
  return 5;
}

/** Activation displayed in the Time column. */
const TIME_ABBR = { action: "A", bonus: "BA", reaction: "R", none: "\u2013" };

/**
 * Cost displayed per discipline. Base costs only for now: empowerment display
 * is Phase 3 work, and the Apex spends the whole ready hand.
 */
function displayCost(discipline, level) {
  switch (discipline) {
    case "echo": return echoReserve(level);
    case "augment":
    case "channel": return 2;
    case "surge": return 15;
    case "stance": return stanceHold(level);
    case "boost":
    case "strike": return 1;
    case "apex": return game.i18n.localize("VEYL.All");
    default: return "\u2013";
  }
}

/** Highest unlocked step by character level (steps unlock at 1,3,5,...,17). */
function unlockedStep(level) {
  return Math.min(9, Math.floor((level + 1) / 2));
}

export function frameworkItems(actor) {
  return actor.items.filter(i => i.type === `${MODULE_ID}.framework`);
}

export function identityFor(actor, framework) {
  return frameworkItems(actor).find(i => i.system.framework === framework) ?? null;
}

export function abilityItemsFor(actor, framework) {
  return actor.items.filter(
    i => i.type === `${MODULE_ID}.ability` && i.system.framework === framework
  );
}

/**
 * Build the render context for one framework tab. Returns { held: false } when
 * the actor does not hold that framework's identity item; the template renders
 * nothing and visibility enforcement hides the tab entirely.
 */
export function prepareFrameworkContext(sheet, partId) {
  const actor = sheet.actor ?? sheet.document;
  const identity = identityFor(actor, partId);
  if (!identity) return { held: false, framework: partId };

  const abl = identity.system.ability;
  // NOTE (carried flag from the spec): system.abilities[abl].mod reflects
  // Active Effects. The rules require the BASE modifier for the MP formula,
  // unmodified by items or Attunement. No Attunement effect exists yet, so
  // this is currently correct; when Attunement becomes an Active Effect, the
  // engine phase must switch this to the raw score or subtract the effect.
  const mod = actor.system.abilities?.[abl]?.mod ?? 0;
  const prof = actor.system.attributes?.prof ?? 0;
  const level = actor.system.details?.level ?? 1;

  const abilityCfg = CONFIG.DND5E?.abilities?.[abl];
  const context = {
    held: true,
    framework: partId,
    identity,
    craftName: identity.system.craftName || identity.name,
    abilityAbbr: (abilityCfg?.abbreviation ?? abl).toUpperCase(),
    abilityLabel: abilityCfg?.label ?? abl,
    attack: (prof + mod >= 0 ? "+" : "") + (prof + mod),
    dc: 8 + prof + mod,
    unlockedStep: unlockedStep(level),
    sections: LEGAL_DISCIPLINES[partId].map(d => ({
      id: d,
      label: `VEYL.Discipline.${d}`,
      items: abilityItemsFor(actor, partId)
        .filter(i => i.system.discipline === d)
        .map(i => ({
          id: i.id,
          uuid: i.uuid,
          name: i.name,
          img: i.img,
          // Schema day dropped comparableLevel (CSL is a property of the step
          // used, not of the technique), so the subtitle is the trigger or blank.
          subtitle: i.system.trigger
            ? `${game.i18n.localize("VEYL.Trigger")}: ${i.system.trigger}`
            : "",
          cost: displayCost(d, level),
          time: TIME_ABBR[i.system.activation] ?? i.system.activation
        }))
    }))
  };

  if (partId === "magecraft") {
    const max = (level * 3) + (mod * level) + prof + 5;
    // Current MP tracking is engine-phase work; the scaffold displays max/max.
    context.mp = { value: max, max };
  } else {
    const techniques = abilityItemsFor(actor, partId).filter(
      i => ["boost", "strike"].includes(i.system.discipline)
    ).length;
    // Live ready/spent tracking is engine-phase work; the scaffold shows the
    // hand as techniques known minus the Stance hold for the level band.
    context.hand = Math.max(0, techniques - stanceHold(level));
  }

  return context;
}
