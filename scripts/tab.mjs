/**
 * Part context for the Magecraft and Arts tabs.
 *
 * All values here are DERIVED, never stored, per the spec's identity item schema:
 * MP max, DC, attack, unlocked step, ready hand are computed from actor level
 * and the chosen ability every render.
 */

import { LEGAL_DISCIPLINES, DISCIPLINE_GROUPS, THRESHOLD_STEPS } from "./models.mjs";

export const MODULE_ID = "veyl-frameworks";

export const FRAMEWORK_TABS = [
  { id: "magecraft", label: "VEYL.Magecraft", icon: "fas fa-hand-sparkles" },
  { id: "arts", label: "VEYL.Arts", icon: "fas fa-hand-fist" }
];

/**
 * MP cost by step on the Magecraft cost progression (the rules table in
 * docs/rules/magecraft.md). Arts spend techniques equal to the step number,
 * so they need no table.
 */
export const MP_COSTS = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7, 6: 9, 7: 10, 8: 11, 9: 13 };

/** Stance hold by level band (1-4 / 5-9 / 10-14 / 15-19 / 20). */
export function stanceHold(level) {
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
}

/** Echo reservation by level band (per the Magecraft reservation table). */
export function echoReserve(level) {
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
export function displayCost(discipline, level) {
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
export function unlockedStep(level) {
  return Math.min(9, Math.floor((level + 1) / 2));
}

/**
 * Derived expansion summary for one ability row (Phase 3). Everything here is
 * recomputed per render from the item and the actor's level (rule 6); the
 * chat card builds on the same context.
 */
export async function buildAbilitySummary(item, { framework, level }) {
  const sys = item.system;
  const group = DISCIPLINE_GROUPS[sys.discipline];
  const TextEditor = foundry.applications.ux.TextEditor.implementation;
  const enrich = value => TextEditor.enrichHTML(value ?? "", {
    secrets: item.isOwner,
    relativeTo: item,
    rollData: item.getRollData?.() ?? {}
  });

  const summary = {
    group,
    activationLabel: sys.activation === "none"
      ? "" : game.i18n.localize(`VEYL.Activation.${sys.activation}`),
    trigger: sys.trigger,
    duration: sys.duration,
    concentration: sys.concentration,
    // The reserve disciplines are defined by their Signature; everything else
    // leads with its base effect.
    rich: await enrich(group === "reserve" ? sys.signature : sys.baseEffect),
    perStep: (group === "enhance" || group === "active") ? sys.perStep : "",
    ladder: null,
    costUnit: "",
    fixed: null,
    amplifyRich: group === "climax" ? await enrich(sys.amplify) : "",
    evolutions: [],
    deepenings: []
  };

  // Empowerment ladder: enhance and active disciplines only, base to the
  // actor's unlocked step, tier thresholds at steps 3/6/9.
  if (group === "enhance" || group === "active") {
    const cap = unlockedStep(level);
    summary.ladder = [];
    for (let step = 1; step <= cap; step++) {
      summary.ladder.push({
        step,
        cost: framework === "magecraft" ? MP_COSTS[step] : step,
        threshold: step % 3 === 0
      });
    }
    summary.costUnit = game.i18n.localize(
      framework === "magecraft" ? "VEYL.MP" : "VEYL.TechniquesSpent"
    );
    summary.evolutions = await Promise.all(
      [...(sys.evolutions ?? [])]
        .sort((a, b) => a.threshold - b.threshold)
        .map(async row => ({
          step: THRESHOLD_STEPS[row.threshold],
          enriched: await enrich(row.text)
        }))
    );
  }

  // Fixed cost displays: reservation, hold, Surge minimum, Apex spend-all.
  switch (sys.discipline) {
    case "echo":
      summary.fixed = game.i18n.format("VEYL.Summary.Reservation", { mp: echoReserve(level) });
      break;
    case "stance": {
      const hold = stanceHold(level);
      summary.fixed = game.i18n.format(
        hold === 1 ? "VEYL.Summary.HoldOne" : "VEYL.Summary.HoldMany", { n: hold }
      );
      break;
    }
    case "surge":
      summary.fixed = game.i18n.localize("VEYL.Summary.Surge");
      break;
    case "apex":
      summary.fixed = game.i18n.localize("VEYL.Summary.Apex");
      break;
  }

  if (group === "reserve" || group === "climax") {
    summary.deepenings = await Promise.all(
      [...(sys.deepenings ?? [])]
        .sort((a, b) => a.level - b.level)
        .map(async row => ({ level: row.level, enriched: await enrich(row.text) }))
    );
  }

  return summary;
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
export async function prepareFrameworkContext(sheet, partId) {
  const actor = sheet.actor ?? sheet.document;
  const identity = identityFor(actor, partId);
  if (!identity) return { held: false, framework: partId };

  // dnd5e sheet mode (MODES.PLAY = 1, MODES.EDIT = 2). In Edit mode a row's
  // name keeps dnd5e's edit action; in Play mode it becomes our expansion
  // toggle (see tab.hbs and expand.mjs).
  const editMode = (sheet._mode ?? 1) === (sheet.constructor.MODES?.EDIT ?? 2);
  // Expansion state is per sheet instance and in-memory only: never stored on
  // the actor or item, discarded on reload (Phase 3 statelessness rule).
  const expanded = sheet._veylExpanded ??= new Set();

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
    editMode,
    craftName: identity.system.craftName || identity.name,
    abilityAbbr: (abilityCfg?.abbreviation ?? abl).toUpperCase(),
    abilityLabel: abilityCfg?.label ?? abl,
    attack: (prof + mod >= 0 ? "+" : "") + (prof + mod),
    dc: 8 + prof + mod,
    unlockedStep: unlockedStep(level),
    sections: await Promise.all(LEGAL_DISCIPLINES[partId].map(async d => ({
      id: d,
      label: `VEYL.Discipline.${d}`,
      items: await Promise.all(abilityItemsFor(actor, partId)
        .filter(i => i.system.discipline === d)
        .map(async i => ({
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
          time: TIME_ABBR[i.system.activation] ?? i.system.activation,
          expanded: expanded.has(i.id),
          summary: await buildAbilitySummary(i, { framework: partId, level })
        })))
    })))
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
