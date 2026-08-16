/**
 * Part context for the Magecraft and Arts tabs.
 *
 * All values here are DERIVED, never stored, per the spec's identity item schema:
 * MP max, DC, attack, unlocked step, ready hand are computed from actor level
 * and the chosen ability every render.
 */

// MP_COSTS, echoReserve, and unlockedStep moved to models.mjs for v0.9 so
// engine.mjs and this UI module both import downward from the model layer
// (never from each other — see design §2 on the import direction).
import {
  LEGAL_DISCIPLINES, DISCIPLINE_GROUPS, THRESHOLD_STEPS,
  MP_COSTS, echoReserve, unlockedStep, comparableLevelNumber
} from "./models.mjs";
// Live-state READS only (design §2 import direction: tab imports from engine,
// never the reverse). prepareFrameworkContext never writes — every value the
// engine hands back is display-clamped inside manaState itself.
import { manaState, checkStrain, EFFECT_IDS } from "./engine.mjs";

export const MODULE_ID = "veyl-frameworks";

export const FRAMEWORK_TABS = [
  { id: "magecraft", label: "VEYL.Magecraft", icon: "fas fa-hand-sparkles" },
  { id: "arts", label: "VEYL.Arts", icon: "fas fa-hand-fist" }
];

/** Stance hold by level band (1-4 / 5-9 / 10-14 / 15-19 / 20). */
export function stanceHold(level) {
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
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

/**
 * Comparable spell level for a step, the benchmark both rules documents price
 * every ability against (the two right-hand columns of the step progression).
 * Augments and Boosts benchmark one level below Channels and Strikes of the
 * same step: part of their price pays for the action they ride, which bottoms
 * out at Cantrip on step 1. Display form of comparableLevelNumber (models.mjs)
 * — a localized string, never engine math.
 */
export function comparableLevel(group, step) {
  return game.i18n.localize(`VEYL.CSL.${comparableLevelNumber(group, step)}`);
}

/**
 * Derived Rally display for the Arts identity (the Arts' counterpart to
 * Magecraft's rest recovery). Every number here recomputes at render per
 * rule 6: recovery tracks proficiency, and Brace tracks proficiency plus the
 * Arts modifier.
 */
export function buildRally(identity, { actor, prof, mod }) {
  const benefit = identity.system.rallyBenefit;
  const rally = {
    recover: game.i18n.format(
      prof === 1 ? "VEYL.Rally.RecoverOne" : "VEYL.Rally.RecoverMany", { n: prof }
    ),
    benefitLabel: benefit ? game.i18n.localize(`VEYL.Rally.${benefit}`) : "",
    effect: "",
    description: identity.system.rallyDescription
  };

  switch (benefit) {
    case "brace":
      // Same base-modifier caveat as the MP formula below: Phase 6 revisits.
      rally.effect = game.i18n.format("VEYL.Rally.Effect.brace", { n: prof + mod });
      break;
    case "reposition": {
      const movement = actor.system.attributes?.movement ?? {};
      rally.effect = game.i18n.format("VEYL.Rally.Effect.reposition", {
        n: Math.floor((movement.walk ?? 0) / 2),
        units: movement.units ?? "ft"
      });
      break;
    }
    case "readField":
      rally.effect = game.i18n.localize("VEYL.Rally.Effect.readField");
      break;
  }

  return rally;
}

/**
 * Derived expansion summary for one ability row (Phase 3). Everything here is
 * recomputed per render from the item and the actor's level (rule 6); the
 * chat card builds on the same context.
 */
export async function buildAbilitySummary(item, { framework, level, strainLocks = [] }) {
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
      const cslNumber = comparableLevelNumber(group, step);
      summary.ladder.push({
        step,
        cost: framework === "magecraft" ? MP_COSTS[step] : step,
        csl: comparableLevel(group, step),
        threshold: step % 3 === 0,
        // Strain badge (design §6.2): the step's comparable level is locked
        // until a long rest. Arts callers pass no locks, so always false there.
        locked: framework === "magecraft" && cslNumber >= 6 && strainLocks.includes(cslNumber)
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

/**
 * Advisory use-state for one ability row (v0.9, design §6.2). Engine READS
 * only; the engine re-validates at click time, so these states are cosmetic —
 * a stale row refuses with a toast, never a half-spend (design §9). Reason
 * precedence: burnout > strain > insufficient MP. Magecraft rows only; Arts
 * rows carry no Use control at all.
 */
function abilityUsable(identity, item, mp) {
  const blocked = key => ({ blocked: true, icon: "fa-ban", label: game.i18n.localize(key) });
  const usable = () => ({ blocked: false, icon: "fa-bolt", label: game.i18n.localize("VEYL.Use") });
  const discipline = item.system.discipline;

  if (discipline === "echo") {
    // Active Echo: the control becomes Collapse — never blocked (design §9).
    if (mp.echoActive) return {
      blocked: false, collapse: true, icon: "fa-link-slash",
      label: game.i18n.format("VEYL.CollapseReturns", { mp: mp.reserved })
    };
    if (mp.burnedOut) return blocked("VEYL.Blocked.Burnout");
    if (mp.available < echoReserve(mp.level)) return blocked("VEYL.Blocked.InsufficientMP");
    return usable();
  }

  if (discipline === "surge") {
    if (mp.burnedOut) return blocked("VEYL.Blocked.Burnout");
    // Surge is gained at 5th level; item presence is not the gate.
    if (mp.level < 5) return blocked("VEYL.Blocked.Level");
    // Mirrors the engine's insufficient-hp refusal (design §6.2): blocked only
    // when even all available MP plus every HP at 2:1 cannot reach the 15
    // minimum. hpAfter === 0 is legal, so the whole pool counts.
    const hp = identity.actor?.system.attributes?.hp?.value ?? 0;
    if (mp.available + Math.floor(hp / 2) < 15) return blocked("VEYL.Blocked.InsufficientMP");
    return usable();
  }

  // Augment / Channel: pre-checked at step 1 (the cheapest legal activation);
  // the empowerment picker re-gates every higher step individually.
  if (mp.burnedOut) return blocked("VEYL.Blocked.Burnout");
  const group = DISCIPLINE_GROUPS[discipline];
  if (checkStrain(identity, group, 1).locked) return blocked("VEYL.Blocked.Strained");
  if (MP_COSTS[1] > mp.available) return blocked("VEYL.Blocked.InsufficientMP");
  return usable();
}

/**
 * Remaining Burnout rounds for the status pill, read from the effect's
 * prepared duration. Core _prepareDuration leaves remaining unset (undefined
 * — spike finding: the key is absent, not the null the design text says) for
 * a rounds-form effect with no combat context, so the flagged total stands
 * in; seconds-form remaining converts at 6 s/round (design §5).
 */
function burnoutRoundsRemaining(effect) {
  const remaining = effect.duration.remaining;
  if (!Number.isFinite(remaining)) return effect.flags[MODULE_ID]?.roundsTotal ?? 0;
  const rounds = effect.duration.seconds ? remaining / 6 : remaining;
  return Math.max(0, Math.ceil(rounds));
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
  // The derived .mod is Attunement-aware via the Echo's ActiveEffect, which is
  // exactly what attack, DC, and Rally want (design §5). The ONE read that must
  // stay Attunement-blind is the MP max, computed inside manaState() from
  // baseMod() (_source) — that split resolves the spec's carried base-modifier
  // flag that used to live here.
  const mod = actor.system.abilities?.[abl]?.mod ?? 0;
  const prof = actor.system.attributes?.prof ?? 0;
  const level = actor.system.details?.level ?? 1;
  // Live MP state, magecraft only: engine READS, display-clamped in manaState;
  // prepare never writes (render-loop hazard, design §14).
  const mp = partId === "magecraft" ? manaState(identity) : null;

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
          // Null on Arts rows: the template gates the Use control on it, so
          // the Arts branch renders zero new controls (design §1).
          usable: mp ? abilityUsable(identity, i, mp) : null,
          summary: await buildAbilitySummary(i, {
            framework: partId, level, strainLocks: mp?.strainLocks ?? []
          })
        })))
    })))
  };

  if (partId === "magecraft") {
    // Live meter context (design §6.1): everything from manaState, including
    // max (baseMod/_source inside the engine — never the attuned score).
    context.mp = { ...mp };
    context.echo = {
      active: mp.echoActive,
      reserve: echoReserve(level),
      blocked: !mp.echoActive && (mp.available < echoReserve(level) || mp.burnedOut)
    };
    // Burnout is the actor-side effect, never a schema field (design §5); the
    // pill reads its remaining rounds off the prepared duration.
    const bo = actor.effects.get(EFFECT_IDS.burnout);
    context.burnout = bo ? {
      remaining: burnoutRoundsRemaining(bo),
      total: bo.flags[MODULE_ID]?.roundsTotal ?? null
    } : null;
  } else {
    const techniques = abilityItemsFor(actor, partId).filter(
      i => ["boost", "strike"].includes(i.system.discipline)
    ).length;
    // Live ready/spent tracking is engine-phase work. The stateless baseline is
    // nothing spent and no Stance assumed, under which every technique known is
    // ready, so the hand reads known/known exactly as the pool reads max/max.
    // The Stance hold is NOT subtracted here: it applies only while the Stance
    // is active, which is Phase 5 state. It is surfaced honestly on the Stance
    // row's own summary instead (see buildAbilitySummary).
    context.hand = { value: techniques, max: techniques };
    context.rally = buildRally(identity, { actor, prof, mod });
  }

  return context;
}
