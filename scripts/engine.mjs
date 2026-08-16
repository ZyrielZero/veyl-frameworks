/**
 * Magecraft engine (v0.9): the ONLY module that mutates documents.
 *
 * Every state transition (spend, restore, Echo, Strain, Surge, Burnout, rests,
 * expiry sweeps) lives here; UI and chat call in, never write. Each entry
 * point re-reads live state off the identity before acting, so stale callers
 * are refused rather than half-applied, and every spend is ONE item.update
 * (companion writes merged in via extraUpdate) so a half-spend is structurally
 * impossible. Cross-document steps (effect create/delete, HP) follow the
 * identity write and self-heal on the next transition if one fails.
 *
 * Arts must not regress: every hook body here gates on
 * framework === "magecraft" before considering a write; an Arts identity
 * never receives an engine write.
 *
 * Import direction (design §2): shared constants come from models.mjs;
 * tab.mjs imports from this module — never the reverse.
 */

import {
  MP_COSTS, THRESHOLD_STEPS, DISCIPLINE_GROUPS,
  echoReserve, unlockedStep, comparableLevelNumber
} from "./models.mjs";

// tab.mjs exports MODULE_ID, but importing it here would recreate the
// engine<->tab cycle the constants relocation removed (design §2), so the id
// is restated. It can never drift: module ids are frozen at publish.
const MODULE_ID = "veyl-frameworks";

/* -------------------------------------------- */
/*  Static effect ids                           */
/* -------------------------------------------- */

/** 16-char padded static id, the dnd5e staticID pattern (dnd5e.mjs:718-721). */
function staticId(id) {
  if (id.length >= 16) return id.substring(0, 16);
  return id.padEnd(16, "0");
}

/**
 * Fixed _ids for the two engine-owned ActiveEffects. Static ids make
 * create/find/delete race-safe: a keepId create of an existing id is a no-op
 * failure, and lookup is a Map get rather than a flag scan.
 */
export const EFFECT_IDS = {
  attunement: staticId("veylattunement0"),
  burnout: staticId("veylburnout0000")
};

/* -------------------------------------------- */
/*  Reads                                       */
/* -------------------------------------------- */

/**
 * Base (pre-ActiveEffect) Magecraft modifier, read from _source. This is the
 * MP-max formula input ONLY (rules contract §2 line 21: Attunement never
 * feeds MP max); every other read wants the derived .mod, which the
 * Attunement effect adjusts automatically.
 */
export function baseMod(actor, abl) {
  const v = actor?.system._source.abilities?.[abl]?.value ?? 10;
  return Math.floor((v - 10) / 2);
}

/**
 * THE read. Everything derived from the identity's stored spend state is
 * computed and clamped here, in one place; nothing below ever reads
 * system.currentMP directly.
 *
 * currentMP INCLUDES the reserved Echo MP (the reserve is never stored);
 * null currentMP means "uninitialized, treat as max" (design §3).
 *
 * @param {Item} identity  A Magecraft framework identity item.
 * @returns {object}       { max, current, reserved, available, pct,
 *                           echoActive, echoItemId, shortRestUsed,
 *                           strainLocks, burnedOut, level, abl }
 */
export function manaState(identity) {
  const actor = identity.actor;
  const sys = identity.system;
  const abl = sys.ability;
  const level = actor?.system.details?.level ?? 1;
  const prof = actor?.system.attributes?.prof ?? 0;
  const max = (level * 3) + (baseMod(actor, abl) * level) + prof + 5;
  const current = Math.clamp(sys.currentMP ?? max, 0, max);
  const reserved = sys.echoActive ? echoReserve(level) : 0;
  return {
    max,
    current,
    reserved,
    available: Math.max(0, current - reserved),
    pct: max > 0 ? Math.round((current / max) * 100) : 0,
    echoActive: sys.echoActive,
    echoItemId: sys.echoItemId,
    shortRestUsed: sys.shortRestUsed,
    strainLocks: [...sys.strainLocks],
    burnedOut: !!actor?.effects.get(EFFECT_IDS.burnout),
    level,
    abl
  };
}

/** Whether the identity's AVAILABLE pool (current minus reserve) covers cost. */
export function canAfford(identity, cost) {
  return manaState(identity).available >= cost;
}

export function isBurnedOut(actor) {
  return !!actor.effects.get(EFFECT_IDS.burnout);
}

/** Guard form of isBurnedOut for the refusal-reason pipeline. */
export function assertNotBurnedOut(actor) {
  return isBurnedOut(actor) ? { ok: false, reason: "burnout" } : { ok: true };
}

/* -------------------------------------------- */
/*  Low-level MP writes                         */
/* -------------------------------------------- */

/**
 * Spend MP. Guards cost <= available, then performs ONE item.update.
 * extraUpdate merges into that same write, which is how spend+strain and
 * spend+collapse stay atomic. When extraUpdate clears echoActive the guard
 * runs against the post-collapse pool (available plus the freed reserve) —
 * the Surge collapse-to-fund path depends on this.
 *
 * @returns {Promise<{ok: boolean, current: number, reason?: string}>}
 */
export async function spendMP(identity, cost, { extraUpdate = {} } = {}) {
  const state = manaState(identity);
  const collapsing = foundry.utils.getProperty(extraUpdate, "system.echoActive") === false;
  const available = collapsing ? state.current : state.available;
  if (cost > available) return { ok: false, current: state.current, reason: "insufficient-mp" };
  await identity.update(foundry.utils.mergeObject(
    { "system.currentMP": state.current - cost }, extraUpdate
  ));
  return { ok: true, current: state.current - cost };
}

/**
 * Restore MP, clamped to max; the reserve is untouched by construction
 * (currentMP includes it). Refused during Burnout: "regain no MP" covers
 * every recovery path (rules contract §8).
 *
 * @returns {Promise<{ok: boolean, current: number, reason?: string}>}
 */
export async function restoreMP(identity, amount) {
  const state = manaState(identity);
  if (state.burnedOut) return { ok: false, current: state.current, reason: "burnout" };
  const next = Math.clamp(state.current + amount, 0, state.max);
  await identity.update({ "system.currentMP": next });
  return { ok: true, current: next };
}

/* -------------------------------------------- */
/*  Echo & Attunement                           */
/* -------------------------------------------- */

/**
 * Activate the Echo: reserve MP (a boolean flip — no MP arithmetic, the
 * reserve is derived) and raise the Attunement effect. Requires
 * available >= echoReserve(level) (ambiguity #8; with Echo inactive,
 * available === current — "available" is the canonical wording).
 */
export async function activateEcho(identity, echoItem) {
  const state = manaState(identity);
  if (state.burnedOut) return { ok: false, reason: "burnout" };
  if (state.echoActive) return { ok: true };
  if (state.available < echoReserve(state.level)) return { ok: false, reason: "insufficient-mp" };
  await identity.update({ "system.echoActive": true, "system.echoItemId": echoItem?.id ?? "" });
  await createAttunementEffect(identity);
  return { ok: true };
}

/**
 * Collapse the Echo. No MP write: available rises the moment the boolean
 * clears, which is what makes the freed reserve same-turn spendable. Never
 * burnout-blocked (canonically the Echo already ended at Burnout onset;
 * collapsing then is harmless bookkeeping).
 *
 * @returns {Promise<{freed: number}>}  The reserve amount released (0 if the
 *                                      Echo was not up).
 */
export async function collapseEcho(identity) {
  const state = manaState(identity);
  if (!state.echoActive) return { freed: 0 };
  await identity.update({ "system.echoActive": false, "system.echoItemId": "" });
  await deleteEffect(identity.actor, EFFECT_IDS.attunement);
  return { freed: echoReserve(state.level) };
}

/**
 * Create the Attunement ActiveEffect on the identity's actor (idempotent:
 * no-op when already present). Applied to the SCORE, not the modifier
 * (ambiguity #9 — odd-parity gains are intended), as a literal number string
 * (applyChange runs Number(raw) against the NumberField; no formulas). The
 * value is frozen at creation; level changes rewrite it (see
 * onLevelChanged), and activateEcho always writes it fresh (self-heal).
 */
export async function createAttunementEffect(identity) {
  const actor = identity.actor;
  if (!actor || actor.effects.get(EFFECT_IDS.attunement)) return;
  const abl = identity.system.ability;
  const level = actor.system.details?.level ?? 1;
  await ActiveEffect.implementation.create({
    _id: EFFECT_IDS.attunement,
    name: game.i18n.localize("VEYL.Effect.Attunement"),
    // Explicit img: a keepId custom create does NOT inherit the
    // CONFIG.statusEffects entry's icon (spike finding from the design's
    // feasibility review); without this the core default icon shows.
    img: `modules/${MODULE_ID}/icons/echo.svg`,
    origin: identity.uuid,
    statuses: ["veyl-echo"],
    flags: { [MODULE_ID]: { kind: "attunement", identityUuid: identity.uuid } },
    changes: [{
      key: `system.abilities.${abl}.value`,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: String(Math.floor(level / 2))
    }]
  }, { parent: actor, keepId: true });
}

/* -------------------------------------------- */
/*  Strain                                      */
/* -------------------------------------------- */

/**
 * Whether activating this group at this step is Strain-blocked. The
 * ACTIVATED step's comparable level is what locks (ambiguity #4): 7th does
 * not lock 6th, and locks are shared across Augments and Channels because
 * the level number alone is the key.
 */
export function checkStrain(identity, group, step) {
  const level = comparableLevelNumber(group, step);
  return {
    level,
    locked: level >= 6 && identity.system.strainLocks.includes(level)
  };
}

/* -------------------------------------------- */
/*  Augment / Channel activation                */
/* -------------------------------------------- */

/**
 * The one orchestrator for Augment/Channel activation at a chosen step.
 * Guard order: burnout, step unlock, strain, affordability; then ONE spendMP
 * whose extraUpdate carries the new strain lock when the comparable level is
 * 6+ — a single item.update, never a half-spend / half-lock.
 *
 * @returns {Promise<{ok: boolean, reason?: string, cost?: number,
 *                    comparable?: number, evolutionsCrossed?: number[]}>}
 */
export async function activateAbility(identity, abilityItem, { step }) {
  const state = manaState(identity);
  if (state.burnedOut) return { ok: false, reason: "burnout" };
  if (step > unlockedStep(state.level)) return { ok: false, reason: "locked-step" };
  const group = DISCIPLINE_GROUPS[abilityItem.system.discipline];
  const strain = checkStrain(identity, group, step);
  if (strain.locked) return { ok: false, reason: "strained" };
  const cost = MP_COSTS[step];
  if (cost > state.available) return { ok: false, reason: "insufficient-mp" };
  const extraUpdate = strain.level >= 6
    ? { "system.strainLocks": [...state.strainLocks, strain.level] }
    : {};
  const spend = await spendMP(identity, cost, { extraUpdate });
  if (!spend.ok) return { ok: false, reason: spend.reason };
  return {
    ok: true,
    cost,
    comparable: strain.level,
    evolutionsCrossed: Object.keys(THRESHOLD_STEPS)
      .map(Number).filter(t => THRESHOLD_STEPS[t] <= step)
  };
}

/* -------------------------------------------- */
/*  Surge                                       */
/* -------------------------------------------- */

/** Burnout duration in rounds. ceil is defensive only — legal totals are
 *  exact multiples of 15 (rules contract fix #4). */
export function burnoutDuration(totalMPValue) {
  return 5 * Math.ceil(totalMPValue / 15);
}

/**
 * Full Surge cost breakdown; pure read, shared by the dialog preview and
 * activateSurge. legality (ambiguity #7 strict + HP sufficiency): any
 * shortfall must be at 1 increment (amplification is never HP-funded) AND
 * actually payable in HP — flooring at 0 with an underpaid cost would
 * silently forgive it while Burnout still counted the unpaid MP. hpAfter of
 * exactly 0 with full payment is the one allowed floor case.
 * totalMPValue = mpPaid + shortfall and nothing else, so collapsed-Echo
 * points (already inside currentMP) count exactly once (contract §8).
 */
export function surgeCost(identity, { increments = 1, collapse = false } = {}) {
  const state = manaState(identity);
  const mpCost = 15 * increments;
  const freedByCollapse = (collapse && state.echoActive) ? echoReserve(state.level) : 0;
  const availableAfterCollapse = state.available + freedByCollapse;
  const mpPaid = Math.min(mpCost, availableAfterCollapse);
  const shortfall = mpCost - mpPaid;
  const hpPaid = shortfall * 2;
  const hpAfter = (identity.actor?.system.attributes?.hp?.value ?? 0) - hpPaid;
  const totalMPValue = mpPaid + shortfall;
  return {
    mpCost,
    freedByCollapse,
    availableAfterCollapse,
    mpPaid,
    shortfall,
    hpPaid,
    hpAfter,
    legal: (shortfall === 0 || increments === 1) && hpAfter >= 0,
    totalMPValue,
    burnoutRounds: burnoutDuration(totalMPValue)
  };
}

/**
 * Activate the Surge. The MP spend and the Echo collapse fold into ONE
 * item.update (a collapse-then-spend pair could strand a collapsed Echo with
 * no Surge paid); Echo always ends when Burnout begins, so the echoActive
 * clear rides the write whether or not the collapse funded anything —
 * onset-ended (non-collapse-funded) Echo points are NOT counted (never spent
 * on the Surge; contract §8 once-only). Then: Attunement effect deleted, HP
 * cost deducted (a cost, not damage — never applyDamage, which would let
 * resistances and temp HP intercept), Burnout applied.
 *
 * @returns {Promise<{ok: boolean, reason?: string, breakdown?: object}>}
 */
export async function activateSurge(identity, surgeItem, { increments = 1, collapse = false } = {}) {
  const state = manaState(identity);
  if (state.burnedOut) return { ok: false, reason: "burnout" };
  // Surge is gained at 5th level (rules :113); item presence is not the gate.
  if (state.level < 5) return { ok: false, reason: "level" };
  const breakdown = surgeCost(identity, { increments, collapse });
  if (!breakdown.legal) {
    return {
      ok: false,
      reason: (increments > 1 && breakdown.shortfall > 0) ? "amplify-shortfall" : "insufficient-hp",
      breakdown
    };
  }
  const echoWasUp = state.echoActive;
  const extraUpdate = echoWasUp
    ? { "system.echoActive": false, "system.echoItemId": "" }
    : {};
  const spend = await spendMP(identity, breakdown.mpPaid, { extraUpdate });
  if (!spend.ok) return { ok: false, reason: spend.reason, breakdown };
  if (echoWasUp) await deleteEffect(identity.actor, EFFECT_IDS.attunement);
  if (breakdown.hpPaid > 0) {
    await identity.actor.update({ "system.attributes.hp.value": breakdown.hpAfter });
  }
  await applyBurnout(identity, breakdown.burnoutRounds, { totalMPValue: breakdown.totalMPValue });
  return { ok: true, breakdown };
}

/* -------------------------------------------- */
/*  Burnout                                     */
/* -------------------------------------------- */

/**
 * Apply Burnout: a pure-marker ActiveEffect (changes: []) — enforcement is
 * the engine guards, the effect is bookkeeping plus the token icon. Duration
 * (nothing in core/dnd5e auto-expires effects; the module owns expiry): in
 * combat, rounds (core stamps startRound/startTurn); out of combat, seconds
 * at 6 s/round on world time (ambiguity #1).
 */
export async function applyBurnout(identity, rounds, { totalMPValue = null } = {}) {
  const actor = identity.actor;
  if (!actor || actor.effects.get(EFFECT_IDS.burnout)) return;
  const inCombat = !!(game.combat?.started && actor.inCombat);
  const duration = inCombat
    ? { rounds }
    : { seconds: rounds * 6, startTime: game.time.worldTime };
  await ActiveEffect.implementation.create({
    _id: EFFECT_IDS.burnout,
    name: game.i18n.localize("VEYL.Effect.Burnout"),
    // Explicit img for the same keepId reason as the Attunement effect.
    img: `modules/${MODULE_ID}/icons/burnout.svg`,
    origin: identity.uuid,
    statuses: ["veyl-burnout"],
    duration,
    changes: [],
    flags: {
      [MODULE_ID]: {
        kind: "burnout", identityUuid: identity.uuid, roundsTotal: rounds, totalMPValue
      }
    }
  }, { parent: actor, keepId: true });
}

/** Delete one of our static-id effects if present; failures are logged, not
 *  thrown — MP state is already correct, and the next transition self-heals. */
async function deleteEffect(actor, effectId) {
  const effect = actor?.effects.get(effectId);
  if (!effect) return;
  try {
    await effect.delete();
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to delete effect ${effectId}; state self-heals on next transition.`, err);
  }
}

/* -------------------------------------------- */
/*  Rest cycle (design §8)                      */
/* -------------------------------------------- */

/** All Magecraft identities on the actor (defensively plural; identityFor
 *  yields at most one under the sheet's rules, but users can drag items). */
function magecraftIdentities(actor) {
  return actor.items.filter(
    i => i.type === `${MODULE_ID}.framework` && i.system.framework === "magecraft"
  );
}

/**
 * Whether the rest's duration outlasts the Burnout (ambiguity #2, resolved
 * "delayed, not wasted": Burnout is 5-30 rounds of world time, so any rest
 * necessarily outlasts it and recovery proceeds). config.duration is in
 * minutes; Burnout rounds are 6 seconds each.
 */
function restOutlastsBurnout(actor, config) {
  const burnout = actor.effects.get(EFFECT_IDS.burnout);
  if (!burnout) return true;
  const roundsTotal = burnout.flags[MODULE_ID]?.roundsTotal ?? 0;
  return ((config.duration ?? 0) * 60) >= (roundsTotal * 6);
}

/**
 * dnd5e.preRestCompleted: push identity rows into result.updateItems so
 * recovery rides dnd5e's own updateEmbeddedDocuments transaction (single
 * write, no double render). Never returns false (that cancels the rest).
 */
export function onPreRestCompleted(actor, result, config) {
  for (const identity of magecraftIdentities(actor)) {
    const state = manaState(identity);
    // Burnout gate first: if the rest somehow does not outlast the Burnout,
    // no MP is regained ("regain no MP" is all Burnout blocks) and a wasted
    // short rest does NOT consume shortRestUsed (nothing was granted, Q3) —
    // but a long rest still clears strainLocks/shortRestUsed (Q2).
    const cleared = restOutlastsBurnout(actor, config);
    if (result.longRest) {
      const update = {
        _id: identity.id,
        "system.strainLocks": [],
        "system.shortRestUsed": false
      };
      if (cleared) update["system.currentMP"] = state.max;
      result.updateItems.push(update);
    } else {
      if (!cleared || state.shortRestUsed) continue;
      result.updateItems.push({
        _id: identity.id,
        // One-third of MAX, clamped to max (ambiguity #5), once per long rest.
        "system.currentMP": Math.min(state.max, state.current + Math.floor(state.max / 3)),
        "system.shortRestUsed": true
      });
    }
  }
}

/**
 * dnd5e.restCompleted: effect side-effects only, never MP. The explicit
 * Burnout delete is load-bearing: config.duration is a rest-config fiction —
 * world time only advances when config.advanceTime && game.user.isGM — so
 * the updateWorldTime sweep will usually NOT catch a rest-cleared Burnout.
 */
export async function onRestCompleted(actor, result, config) {
  if (!magecraftIdentities(actor).length) return;
  if (restOutlastsBurnout(actor, config)) {
    await deleteEffect(actor, EFFECT_IDS.burnout);
  }
}

/* -------------------------------------------- */
/*  Expiry sweeps (all activeGM-gated in main)  */
/* -------------------------------------------- */

/** Our flagged Burnout effects on one actor (static id, flag-verified). */
function burnoutEffects(actor) {
  const effect = actor?.effects.get(EFFECT_IDS.burnout);
  return effect?.flags[MODULE_ID]?.kind === "burnout" ? [effect] : [];
}

/**
 * updateCombat sweep: on round/turn advance, delete Burnouts whose remaining
 * duration is a FINITE number <= 0. The Number.isFinite guard is load-bearing:
 * core _prepareDuration leaves remaining unset (undefined — spike finding:
 * the key is simply absent, not the null the design text says) for a
 * rounds-form effect with no active combat, and a null from any other path
 * satisfies null <= 0 in JS — the finite check refuses both rather than
 * deleting a Burnout that merely lost combat context.
 */
export async function sweepCombatExpiry(combat) {
  for (const combatant of combat.combatants) {
    for (const effect of burnoutEffects(combatant.actor)) {
      // Compute remaining ourselves rather than trusting the prepared
      // effect.duration.remaining: a combat-round update does not re-prepare
      // actor effects, so the prepared value is frozen at the last prepare
      // (same staleness found live on the seconds sweep in the 0.9 gate run).
      const dur = effect.duration;
      if (!dur.rounds) continue;
      const elapsed = Math.max(0, (combat.round ?? 0) - (dur.startRound ?? 0));
      if (dur.rounds - elapsed <= 0) {
        await deleteEffect(combatant.actor, effect.id);
      }
    }
  }
}

/**
 * deleteCombat: convert a running rounds-form Burnout to seconds form
 * (remaining rounds x 6 on world time) so expiry still has an owner once
 * combat context is gone; already-expired ones are deleted outright.
 */
export async function convertBurnoutsOnCombatEnd(combat) {
  for (const combatant of combat.combatants) {
    for (const effect of burnoutEffects(combatant.actor)) {
      const dur = effect.duration;
      if (!dur.rounds) continue;
      // Compute remaining rounds manually: at deleteCombat time the effect's
      // prepared remaining may already have lost its combat context (null).
      const elapsed = Math.max(0, (combat.round ?? 0) - (dur.startRound ?? 0));
      const remaining = Math.max(0, dur.rounds - elapsed);
      if (remaining <= 0) {
        await deleteEffect(combatant.actor, effect.id);
        continue;
      }
      await effect.update({
        duration: {
          rounds: null, turns: null, startRound: null, startTurn: null,
          seconds: remaining * 6, startTime: game.time.worldTime
        }
      });
    }
  }
}

/** World actors plus EVERY scene's unlinked token actors — their deltas hold
 *  their own copies of our effects, and the active scene alone would strand
 *  an expired Burnout on any token the active GM is not currently viewing. */
function* sweptActors() {
  yield* game.actors;
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      if (!token.actorLink && token.actor) yield token.actor;
    }
  }
}

/**
 * updateWorldTime sweep: delete expired seconds-form Burnouts. Scans world
 * actors plus every scene's unlinked token actors (see sweptActors).
 */
export async function sweepWorldTimeExpiry() {
  for (const actor of sweptActors()) {
    for (const effect of burnoutEffects(actor)) {
      if (!effect.duration.seconds) continue;
      // Compute remaining ourselves: effect.duration.remaining is prepared
      // data, and nothing re-prepares effects when world time advances, so
      // it reports the value frozen at the last prepare (found live in the
      // 0.9 gate run — an expired Burnout survived the sweep).
      const remaining =
        (effect.duration.startTime ?? 0) + effect.duration.seconds - game.time.worldTime;
      if (Number.isFinite(remaining) && remaining <= 0) {
        await deleteEffect(actor, effect.id);
      }
    }
  }
}

/* -------------------------------------------- */
/*  Level change & cleanup                      */
/* -------------------------------------------- */

/**
 * Rewrite the Attunement effect's frozen change value after a level change
 * (Q7: hook-driven; activateEcho self-heals regardless). No-op when no
 * Attunement effect is up or the value is already right.
 */
export async function rewriteAttunement(actor) {
  const effect = actor?.effects.get(EFFECT_IDS.attunement);
  if (effect?.flags[MODULE_ID]?.kind !== "attunement") return;
  const identity = magecraftIdentities(actor)[0];
  if (!identity) return;
  const level = actor.system.details?.level ?? 1;
  const value = String(Math.floor(level / 2));
  const change = effect.changes[0];
  if (change?.value === value) return;
  await effect.update({
    changes: [{
      key: `system.abilities.${identity.system.ability}.value`,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value
    }]
  });
}

/**
 * deleteItem cleanup: a deleted Magecraft identity takes both engine effects
 * with it (matched by our identityUuid flag, so another identity's effects —
 * impossible today, cheap to guard — survive).
 */
export async function onIdentityDeleted(item) {
  if (item.type !== `${MODULE_ID}.framework`) return;
  if (item.system.framework !== "magecraft") return;
  const actor = item.actor;
  if (!actor) return;
  for (const id of Object.values(EFFECT_IDS)) {
    const effect = actor.effects.get(id);
    if (effect?.flags[MODULE_ID]?.identityUuid === item.uuid) {
      await deleteEffect(actor, id);
    }
  }
}

/**
 * ready-time orphan sweep: delete engine effects whose identity no longer
 * resolves (deleteItem missed it — e.g. deletion while no GM was connected).
 * Same actor coverage as the world-time sweep: unlinked token deltas carry
 * their own effect copies and can orphan just as easily.
 */
export async function sweepOrphanedEffects() {
  for (const actor of sweptActors()) {
    for (const id of Object.values(EFFECT_IDS)) {
      const effect = actor.effects.get(id);
      const identityUuid = effect?.flags[MODULE_ID]?.identityUuid;
      if (!identityUuid) continue;
      if (!fromUuidSync(identityUuid)) await deleteEffect(actor, id);
    }
  }
}
