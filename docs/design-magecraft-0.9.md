# Design: Full Magecraft for v0.9

Synthesis of four design tracks (Engine, UI, Cards, Test/Release) against the Magecraft rules contract (`docs/rules/magecraft.md`) and repo HEAD 195d8d8, revised against two adversarial reviews (rules fidelity; feasibility vs dnd5e 5.0.4 / Foundry v13 core source). All paths under `C:/Users/Zyriel/Documents/veyl-frameworks/`. Contradictions between tracks are resolved inline in **Resolution** notes stating which track won and why; review corrections are folded in place.

---

## 1. Goals & scope

**v0.9 ships the COMPLETE Magecraft framework:**
- Live MP pool (spend/restore/clamp), max MP = `(level × 3) + (base Magecraft mod × level) + prof + 5` — base mod from `_source`, **never** the Attunement-boosted score (rules contract §2 line 21).
- Full ability lifecycle: functional chat cards that spend, empowerment picker with unlock/affordability/strain caps and Threshold Evolutions (steps 3/6/9), Surge with amplify/HP-payment/Burnout, Echo activate/collapse with Attunement (real ActiveEffect on the ability score).
- Rest cycle: long rest = full MP + Strain clear + short-rest flag reset; short rest = `floor(max/3)` once per long rest, clamped to max.
- Enforcement: Burnout blocks all activation and MP recovery; Strain locks comparable levels 6-9 shared across Augments/Channels; never a half-spend.

**Arts is deferred to 1.0** — rules are in flux. Nothing Arts-specific is designed here. The shared/parameterized architecture (`tab.hbs` + `FrameworkData` serve both frameworks; Arts display-only Phases 1-4 features) must keep working byte-identically; every v0.9 change lives behind `framework === "magecraft"` / `{{#if mp}}` branches, and Test leg J enforces it. Arts identity items carry the new schema fields only in prepared data (initials never materialize in `_source` without a write — see §3), asserted by byte-diff.

**Key adopted rules-contract readings** (each also an owner sign-off item, §13):
- Ambiguity #4: the **activated step's** comparable level locks under Strain; 7th does not lock 6th.
- Ambiguity #5: short rest = one-third of **max**, clamped to max.
- Ambiguity #7 **strict**: HP payment covers shortfall only up to the 15 MP minimum, **never amplification** — any `increments > 1` Surge must be fully MP-funded. The shortfall must also be **actually payable in HP** (rules review): an actor whose HP cannot cover `shortfall × 2` is refused; dropping to exactly 0 with full payment is the only allowed floor case.
- Ambiguity #8: Echo activation **requires** `available ≥ echoReserve(level)` (with Echo inactive, `available === current` — one wording, used everywhere).
- Ambiguity #3: running concentration effects persist through Burnout (only Echo ends).
- Ambiguity #1: Burnout out of combat = `seconds: rounds × 6` on world time.
- Surge is gained at 5th level (rules :113): the engine gates `level >= 5` explicitly — item presence alone is not the gate.
- **Echo Deepening / Surge Mastery tiers (levels 10/15/20, rules :91/:117)** are freeform-effect text: 0.9 surfaces them only through the ability items' existing description/summary fields — no engine mechanics, no tier-aware card lines. Declared punt (§13 Q18).
- Appendix items (Attunement nerfs, Strain loosening) are **not** implemented.

---

## 2. Architecture overview

```
                         ┌──────────────────────────────────────────────┐
                         │ scripts/models.mjs                           │
                         │  FrameworkData  ← +5 live-state fields       │
                         │  AbilityData    ← ZERO changes               │
                         │  + shared constants (MP_COSTS, echoReserve,  │
                         │    unlockedStep, comparableLevelNumber)      │
                         └───────────────┬──────────────────────────────┘
                                         │ identity Item (per actor)
     ┌───────────────────────────────────▼───────────────────────────────────┐
     │ scripts/engine.mjs  (NEW — the ONLY module that mutates documents)    │
     │  manaState/canAfford/spendMP/restoreMP · activateEcho/collapseEcho    │
     │  activateAbility (empower+strain) · surgeCost/activateSurge           │
     │  applyBurnout/isBurnedOut · Attunement & Burnout AE lifecycle         │
     │  rest handlers · expiry sweeps                                        │
     └───┬───────────────────┬───────────────────────┬───────────────────────┘
         │ context reads     │ picker→spend→post     │ hooks (main.mjs)
┌────────▼────────┐ ┌────────▼────────────────┐ ┌────▼──────────────────────────┐
│ scripts/tab.mjs │ │ scripts/use.mjs (NEW)   │ │ dnd5e.preRestCompleted /      │
│ prepareFramework│ │  onUseAbility, commitUse│ │ restCompleted · updateCombat /│
│ Context → mana, │ │  inFlight guard,        │ │ deleteCombat / updateWorldTime│
│ usable, strain  │ │  postUsageCard          │ │ (expiry) · advancementManager │
└────────┬────────┘ │ scripts/dialogs.mjs(NEW)│ │ Complete + updateItem (level  │
         │          │  VeylEmpowerDialog      │ │ rewrite) · deleteItem cleanup │
┌────────▼────────┐ │  VeylSurgeDialog        │ │ CONFIG.statusEffects entries  │
│templates/tab.hbs│ │  (Dialog5e subclasses)  │ └───────────────────────────────┘
│ MP meter, Echo  │ └────────┬────────────────┘
│ toggle, use btns│ ┌────────▼────────────────────────────┐
│ (magecraft      │ │ scripts/chat.mjs + chat-card.hbs    │
│  branch only)   │ │  reference cards (Phase 3, +Use btn)│
└────────┬────────┘ │  usage "receipt" cards (born-spent) │
         │          │  veyl-attack / veyl-save handlers   │
┌────────▼────────┐ └─────────────────────────────────────┘
│scripts/expand.mjs│  delegated click/change listeners ([data-veyl-*], .veyl-tab)
└─────────────────┘
```

Data-flow invariants:
- **UI and chat never mutate documents directly** — everything routes through `engine.mjs`.
- Every entry point **re-fetches** identity/ability by id off fresh `actor.items` (synthetic-actor delta rebuilds; never cache Item refs, never `game.actors.get`).
- **No writes during prepare, ever** — clamping is display-time; persistence happens only inside explicit engine transitions (write-during-prepare = render loop, client-document.mjs:688-691).
- Message flags stay in `flags["veyl-frameworks"]` only; never `flags.dnd5e` (structural invisibility to dnd5e `migrateData`/`getAssociatedActivity` is load-bearing).
- **Import direction:** shared constants (`MP_COSTS`, `echoReserve`, `unlockedStep`, `comparableLevelNumber`) live in `models.mjs`; `engine.mjs` and `tab.mjs` both import from there and `tab.mjs` imports from `engine.mjs` — never the reverse (feasibility review: the draft's engine←tab + tab←engine cycle worked only by accident of call-time references and was one refactor from a TDZ error).

---

## 3. Schema & migration

**Resolution — schema shape:** Engine track's field set wins over UI track's (`burnout` schema field dropped — Burnout is an actor-side ActiveEffect only, see §5/§7; a stored countdown would be a second source of truth) and over Test track's (which omitted `echoItemId`; engine's robustness argument — users can create two echo items — stands). Final: **five fields**.

Append to `FrameworkData.defineSchema()` (scripts/models.mjs:53-84, after `rallyDescription` at :72):

```js
// --- v0.9 live-state fields (Magecraft engine; Arts leaves defaults). ---
// Exception to the header rule: spent MP is not derivable, so it is stored.
// Everything computable (max MP, reserve amount, DC, Attunement bonus) stays derived.
currentMP: new fields.NumberField({
  required: true, integer: true, min: 0, nullable: true, initial: null
}),
echoActive: new fields.BooleanField({ initial: false }),
// Item id of the ability item whose Echo is up (label/collapse robustness).
echoItemId: new fields.StringField({ required: true, initial: "" }),
shortRestUsed: new fields.BooleanField({ initial: false }),
// Comparable spell levels (6-9) locked by Strain until long rest; shared
// across Augments and Channels, so the number alone is the key.
strainLocks: new fields.ArrayField(
  new fields.NumberField({ required: true, integer: true, min: 6, max: 9 })
)
```

Decisions (all four tracks agree on these):
- **`currentMP` nullable, initial null = "uninitialized, treat as max"** — no migration, fresh identity starts full without a write, level-up max changes never strand it.
- **`currentMP` INCLUDES reserved Echo MP; the reserve is never stored.** `reserved = echoActive ? echoReserve(level) : 0`; `available = max(0, current − reserved)`. Echo activate/collapse writes only the boolean + item id — zero MP arithmetic. Consequences for free: "held, not lost", instant same-turn spendability on Collapse, self-correcting reserve on level-band changes (5→10 at L5 etc.), long rest `current = max` regains all *expended* MP while the reserve floor still binds.
- **`strainLocks` as array of comparable levels** — the level number IS the lock identity (shared budget across disciplines); cleared with `[]`.
- **`AbilityData`: zero additions.** Chosen step, amplify increments, collapse choice are per-activation parameters traveling in chat-message flags — ability items stay byte-identical, not merely additive.
- Amend the models.mjs:4-8 header comment ("derived never stored") with the stored-spend-state exception, or the file lies.
- **Constants relocation** (feasibility fix): `MP_COSTS` (tab.mjs:23), `echoReserve` (tab.mjs:33-39), `unlockedStep` (tab.mjs:63-65) move to `models.mjs` alongside a new `comparableLevelNumber`; tab.mjs re-imports. Pure move, no behavior change.

**Migration story:** additive fields with initials → no migration code. **Foundry never materializes schema initials into `_source` at install** — new keys appear in `_source` only on a document's first write; until then, initials live in prepared data only (feasibility review fix). Byte-diff gate accordingly: at install, **zero `_source` diff on every item**; after the full 0.9 exercise, a Magecraft identity's diff = exactly the five new keys (written by engine transitions), an Arts identity's `_source` stays **byte-identical** (no engine write ever targets it), and any ability item diff = **empty** always.

---

## 4. Engine API (`scripts/engine.mjs`, new)

**Resolution — file name:** `engine.mjs` (Engine/UI/Cards tracks) over Test track's `mana.mjs` — three-to-one, and the module's scope (AEs, rests, sweeps) exceeds "mana". **Resolution — signatures:** Engine track's set is authoritative; UI-track helpers `magecraftMod`/`mpState` and Test-track names (`mpMax` etc.) map onto it; the Cards track's dependency contract (`getManaState`, `canActivate`, `spendActivation`, `spendSurge`) is satisfied by `manaState`, `checkStrain`+guards, `activateAbility`, `activateSurge`.

```js
import { MP_COSTS, echoReserve, unlockedStep, comparableLevelNumber } from "./models.mjs";
// (constants moved out of tab.mjs — see §2/§3; engine must not import tab.mjs)

/** 16-char padded static ids, dnd5e staticID pattern (dnd5e.mjs:718-721). */
export const EFFECT_IDS = {
  attunement: staticId("veylattunement0"),
  burnout:    staticId("veylburnout0000")
};

/** Numeric comparable spell level (0 = cantrip); lives in models.mjs.
 *  tab.mjs comparableLevel() returns a LOCALIZED STRING — engine math must not use it. */
export function comparableLevelNumber(group, step) {
  return step - (group === "enhance" ? 1 : 0);   // one-level Augment offset, contract §4
}

/** Base (pre-ActiveEffect) Magecraft modifier — MP-max formula input ONLY. */
export function baseMod(actor, abl) {
  const v = actor.system._source.abilities[abl]?.value ?? 10;
  return Math.floor((v - 10) / 2);
}

/** THE read. Everything derived, clamped here, single place. */
export function manaState(identity) → {
  max,        // (level*3) + (baseMod*level) + prof + 5  — baseMod(), NEVER derived mod
  current,    // clamp(identity.system.currentMP ?? max, 0, max)
  reserved,   // echoActive ? echoReserve(level) : 0
  available,  // Math.max(0, current - reserved)
  pct,        // for the meter
  echoActive, echoItemId, shortRestUsed,
  strainLocks: [...],
  burnedOut   // !!identity.actor?.effects.get(EFFECT_IDS.burnout)
}

export function canAfford(identity, cost) → manaState(identity).available >= cost;

/** Low-level. Guards cost<=available; ONE item.update; returns {ok, current, reason?}.
 *  extraUpdate merges into the same write (atomic spend+strain / spend+collapse). */
export async function spendMP(identity, cost, { extraUpdate = {} } = {})
/** Adds clamped to max; reserved untouched by construction. Refused during Burnout. */
export async function restoreMP(identity, amount) → newCurrent

// ---- Echo ----
export async function activateEcho(identity, echoItem) → { ok, reason? }
//  guards: burnout → refuse; already active → no-op;
//          available >= echoReserve(level)   (ambiguity #8: required; with Echo
//          inactive available === current — "available" is the canonical wording, §1)
//  writes {echoActive:true, echoItemId}; then createAttunementEffect(identity)
export async function collapseEcho(identity) → { freed }   // freed = reserve amount
//  writes {echoActive:false, echoItemId:""}; deletes attunement effect.
//  No MP write; available rises instantly — same-turn rule free. Never burnout-blocked.

// ---- Strain ----
export function checkStrain(identity, group, step) → { level, locked }
//  level = comparableLevelNumber(group, step); locked iff level>=6 && strainLocks.includes(level)
//  Activated step's CSL locks (ambiguity #4); 7th does NOT lock 6th.

// ---- Augment/Channel activation (the one orchestrator) ----
export async function activateAbility(identity, abilityItem, { step }) →
  { ok, reason?, cost, comparable, evolutionsCrossed }
//  reason ∈ "burnout" | "locked-step" | "strained" | "insufficient-mp"
//  Order: burnout guard → step <= unlockedStep(level) → strain check →
//         cost = MP_COSTS[step] → canAfford → ONE spendMP with
//         extraUpdate {"system.strainLocks": [...locks, level]} when level>=6.
//  Single item.update = never a half-spend / half-lock.

// ---- Surge ----
export function surgeCost(identity, { increments = 1, collapse = false }) → {
  mpCost: 15*increments,
  freedByCollapse,           // collapse && echoActive ? echoReserve(level) : 0
  availableAfterCollapse,    // available + freedByCollapse
  mpPaid,                    // min(mpCost, availableAfterCollapse)
  shortfall,                 // mpCost - mpPaid
  hpPaid,                    // shortfall * 2
  hpAfter,                   // identity.actor hp.value - hpPaid
  legal,                     // (shortfall === 0 || increments === 1) && hpAfter >= 0
                             //   ambiguity #7 strict + HP sufficiency (rules review):
                             //   the shortfall must be actually payable — flooring at 0
                             //   with an underpaid cost would silently forgive it while
                             //   Burnout still counted the unpaid MP. hpAfter === 0 with
                             //   full payment is the one allowed floor case.
  totalMPValue,              // mpPaid + shortfall — each point counted once (contract §8)
  burnoutRounds              // burnoutDuration(totalMPValue)
}
export function burnoutDuration(totalMPValue) → 5 * Math.ceil(totalMPValue / 15)
//  ceil defensive only — legal totals are exact multiples of 15 (contract fix #4).
export async function activateSurge(identity, surgeItem, { increments, collapse }) → { ok, reason?, breakdown }
//  Order: burnout guard → level >= 5 guard (reason "level"; Surge gained at 5th,
//  contract :113 — item presence alone is not the gate) → breakdown = surgeCost(...) →
//  !legal → refuse (reason "amplify-shortfall" | "insufficient-hp") →
//  ONE item.update: spendMP(mpPaid) with extraUpdate {echoActive:false, echoItemId:""}
//  whenever Echo was up — collapse-to-fund AND Echo-ends-at-Burnout-onset both fold
//  into the spend write (feasibility fix: the draft's collapse-then-spend was two item
//  updates and could strand a collapsed Echo with no Surge paid); the affordability
//  guard runs against availableAfterCollapse. Onset-ended (non-collapse-funded) Echo
//  points are NOT counted (not spent on the Surge — contract §8 once-only) →
//  delete Attunement AE → if hpPaid: HP reduction → applyBurnout(identity, breakdown.burnoutRounds)

// ---- Burnout ----
export async function applyBurnout(identity, rounds)
export function isBurnedOut(actor) → !!actor.effects.get(EFFECT_IDS.burnout)
export function assertNotBurnedOut(actor) → { ok, reason? }
```

**HP payment mechanic** (ambiguity #6 decision, Engine + Cards tracks concur, amended per rules review): reduce `system.attributes.hp.value` directly. **Temp HP does not qualify; payment CAN drop the caster to exactly 0** — the Surge still resolves (it was paid in full). An actor whose HP is **less than** `hpPaid` is **refused** (`"insufficient-hp"`) — the engine check now matches the sheet gate (§6.2), keeping the engine at least as strict as the advisory UI. It is a cost, not damage; do NOT route through `actor.applyDamage()` (resistances/temp HP would intercept). UI shows a confirm-grade warning when `hpAfter === 0` but does not block. Owner may veto (§13).

**Double-counting is structurally impossible:** `totalMPValue = mpPaid + shortfall` and nothing else; collapsed-Echo points are just part of `currentMP` (floor model never subtracted them), so they count exactly when spent on the Surge and never twice.

**Double-spend — scope of the guarantee** (downgraded per feasibility review): on a **single client**, the `inFlight` set + re-read guards + single `item.update` make a double spend impossible. Across **two clients** (two owners, or player + GM) clicking near-simultaneously, Foundry has no atomic decrement — both reads see the same `currentMP`, both write an absolute value, last write wins and one cost is lost while two receipts post. This is a **documented limitation**: single-owner play makes it rare; per-client `inFlight` + disabled buttons narrow the window; routing spends through `game.users.activeGM` is the 1.0 hardening line if it bites in practice (§14).

**Cross-document non-atomicity:** item update → effect create/delete → actor HP are separate DB ops. The single identity `item.update` (MP + echo + strain) lands first; on a later effect-op failure, log `veyl-frameworks |` and leave state (MP correct, cosmetic effect missing, self-heals on next activate). Guards re-read state inside every function — same-client double-clicks refuse. Belt-and-suspenders: `currentMP` `min:0` makes an overdraft throw rather than half-spend.

---

## 5. Attunement (and Burnout) ActiveEffects

**Resolution — AE vs derived-only helper:** the **ActiveEffect approach wins** (Engine, Cards, Test tracks) over the UI track's `magecraftMod()` derived-only helper. Rationale: an AE on `system.abilities.${abl}.value` applies in `prepareEmbeddedDocuments` **before** `prepareAbilities`, so the derived `.mod`, native checks, saves, skills, and our DC/attack (tab.mjs:258-259) and chat rolls all become Attunement-aware with **zero read changes** — the UI helper would leave native sheet rolls un-attuned. The UI track flagged this as its own open question; resolved in favor of the AE. Consequently `magecraftMod` does not exist; all attuned reads use derived `actor.system.abilities[abl].mod`, and the **only** read-split is: **MP max → `baseMod()` (`_source`); everything else → derived `.mod`.** Delete the carried "Attunement-blind" comments (tab.mjs:240-244, chat.mjs:8-11, 35-36) when this lands.

**Attunement AE shape** (actor-side, transient — never item-transferred):

```js
{
  _id: EFFECT_IDS.attunement,                      // create with {keepId: true} → idempotent
  name: "Echo: Attunement",                        // localized
  img: "modules/veyl-frameworks/icons/echo.svg",   // explicit — a keepId custom create does
                                                   // NOT inherit the CONFIG.statusEffects img
                                                   // (feasibility review); default core icon otherwise
  origin: identity.uuid,                           // long Scene.X.Token.Y.Item.Z form on synthetics — correct as-is
  statuses: ["veyl-echo"],                         // + CONFIG.statusEffects entry → token icon
  flags: { "veyl-frameworks": { kind: "attunement", identityUuid: identity.uuid } },
  changes: [{
    key: `system.abilities.${abl}.value`,          // abl ∈ int|wis|cha
    mode: CONST.ACTIVE_EFFECT_MODES.ADD,           // = 2
    value: String(Math.floor(level / 2))           // LITERAL number string — NumberField
  }]                                               // applyChange does Number(raw); no formulas
}
```

- Created in `activateEcho` via `ActiveEffect.implementation.create(data, {parent: actor, keepId: true})` (no-op if present); deleted in `collapseEcho`. Static id makes create/find/delete race-safe.
- **`CONFIG.statusEffects` entries carry `hud: false`** (feasibility fix): without it, the token HUD's `toggleStatusEffect` would create/delete our effects outside the engine — a HUD click could delete the Attunement AE while `echoActive: true` stays set (silent score drop) or hand-clear Burnout enforcement. `hud: false` is honored by the token HUD (token-hud.mjs:92) while keeping `statuses` valid for `isTemporary`/token-icon purposes. Entries: `{ id: "veyl-echo", name, img, hud: false }`, `{ id: "veyl-burnout", name, img, hud: false }`.
- Applied to the **score**, not the modifier (ambiguity #9 — odd-parity gains are intended). **Score may exceed 20** — no clamp; 5.0.4 `prepareAbilities` doesn't clamp `.value` to `.max` (**re-verify on 5.2.4**).
- **ASI safety:** dnd5e ASI apply/reverse read/write **source** (`toObject().abilities`, dnd5e.mjs:20739/20747) — the AE bonus can never bake into `_source`. ASIs land in `_source` (correctly inside MP max); Attunement never does (correctly excluded, contract §2 line 21).
- **Level-change rewrite** (value is frozen): (a) self-heal — `activateEcho` always writes fresh `floor(level/2)`; (b) live — `dnd5e.advancementManagerComplete` + `updateItem` filtered to class items with `system.levels` in the diff → `effect.update({changes})`, gated `game.users.activeGM === game.user`. Ship (b); fall back to (a) if noisy (§13).
- Cleanup: `deleteItem` hook removes both effects when the identity is deleted (match `flags["veyl-frameworks"].identityUuid`), plus a `ready`-time orphan sweep.

**Burnout AE shape** (**Resolution:** actor-side AE with static `_id` is the *only* Burnout representation — Engine/Cards/Test — the UI track's stored `burnout:{rounds,remaining}` schema field and manual tick button are **dropped**; a stored countdown next to an AE duration is two sources of truth, and out-of-combat ticking is handled by world-time seconds instead):

- `_id: EFFECT_IDS.burnout`, `keepId: true`, `statuses: ["veyl-burnout"]`, explicit `img` (same reason as above), `origin: identity.uuid`, **`changes: []`** — pure marker; enforcement is engine guards, the AE is bookkeeping + token icon. Flags: `{ kind: "burnout", identityUuid, roundsTotal, totalMPValue }`.
- **Duration** (nothing in core v13/dnd5e 5.x auto-expires effects — the module owns expiry): in combat, `duration: { rounds }` (core stamps `startRound/startTurn`); out of combat, `duration: { seconds: rounds * 6, startTime: game.time.worldTime }` (ambiguity #1: 6 s/round; if worldTime never advances, GM deletes via the effect UI — documented limitation).
- **Expiry sweeps**, all gated `game.users.activeGM === game.user`: `updateCombat` (on round/turn advance, delete flagged effects whose `duration.remaining` is **a finite number ≤ 0 — `Number.isFinite(remaining) && remaining <= 0`**; core `_prepareDuration` returns `remaining: null` for a rounds-form effect with no active combat, and `null <= 0` is `true` in JS, so a bare comparison would delete a Burnout that merely lost combat context — feasibility fix); `deleteCombat` (convert a running rounds-Burnout to seconds form, remaining × 6); `updateWorldTime` (delete expired seconds-form effects).

---

## 6. Sheet UI

(UI track authoritative for markup/CSS, adjusted for the AE and Burnout resolutions above. Context values come from `manaState()`; `context.burnout` derives from the Burnout AE's `duration.remaining`, not a schema field; the out-of-combat tick button is removed. **Resolution — MP controls:** UI track's HP-style meter with delta input wins over the Test track's +/- micro-buttons — it is the native dnd5e affordance for a continuous pool.)

### 6.1 Stat card → interactive meter (templates/tab.hbs :18-61)

Replace tab.hbs:36-46 (Arts `{{else}}` branch unchanged):

```hbs
{{#if mp}}
<div class="prepared">
  <span class="label">{{localize "VEYL.Mana"}}</span>
  <span class="value">{{mp.available}}/{{mp.max}}</span>
</div>
{{else}}
<div class="prepared">
  <span class="label">{{localize "VEYL.ReadyHand"}}</span>
  <span class="value">{{hand.value}}/{{hand.max}}</span>
</div>
{{/if}}
```

Insert after `.info`'s closing `</div>` (tab.hbs:47), before the rally block:

```hbs
{{#if mp}}
<div class="meter-group veyl-mp-group">
  <div class="meter sectioned veyl-mana">
    <div class="progress veyl-mana" role="meter" aria-valuemin="0"
         aria-valuenow="{{mp.current}}" aria-valuemax="{{mp.max}}"
         style="--bar-percentage: {{mp.pct}}%" data-veyl-mp-meter="">
      <div class="label">
        <span class="value">{{mp.available}}</span>
        <span class="separator">&sol;</span>
        <span class="max">{{mp.max}}</span>
      </div>
      <input type="text" data-veyl-mp-input="" data-dtype="Number"
             inputmode="numeric" pattern="[+=\-]?\d*" value="{{mp.available}}" hidden>
    </div>
    {{#if mp.reserved}}
    <div class="tmp veyl-reserved" data-tooltip aria-label="{{localize 'VEYL.MP.ReservedTooltip'}}">
      <span class="value">{{mp.reserved}}</span>
    </div>
    {{/if}}
  </div>
  <div class="veyl-status">
    {{#with echo}}
    <label class="veyl-echo-toggle {{#if this.blocked}}veyl-blocked{{/if}}">
      <slide-toggle data-veyl-echo-toggle="" {{#if this.active}}checked{{/if}}
                    {{#if this.blocked}}disabled{{/if}}></slide-toggle>
      <span class="roboto-condensed-upper">{{localize "VEYL.Echo.Toggle"}}</span>
      <span class="veyl-reserve-note">{{localize "VEYL.Echo.Reserves" mp=this.reserve}}</span>
    </label>
    {{/with}}
    {{#if burnout}}
    <div class="veyl-burnout" role="status">
      <i class="fa-solid fa-fire" inert></i>
      <span class="roboto-condensed-upper">{{localize "VEYL.Burnout.Label"}}</span>
      <span class="value">{{burnout.remaining}}</span>
    </div>
    {{/if}}
  </div>
</div>
{{/if}}
```

Design notes: no `name=` on the MP input (form belongs to the actor; our value lives on the identity item; dnd5e's delta binding wouldn't survive our part re-renders) — a delegated `change` handler replicates `parseInputDelta` semantics (`+N`/`-N`/`=N`/plain) then calls `spendMP`/`restoreMP`; reserved MP reuses the meter's `.tmp` (Temp-HP) slot as a read-only badge; bar fill shows `current` (mana that exists), label shows `available` (what you can spend), badge reconciles; Echo toggle disabled when `!echoActive && (available < reserve || burnedOut)`; Burnout is a status pill reading the AE's remaining rounds.

Context in `prepareFrameworkContext` (scripts/tab.mjs, replace :284-287):

```js
if (partId === "magecraft") {
  const mp = manaState(identity);
  context.mp = { ...mp };
  context.echo = {
    active: mp.echoActive, reserve: echoReserve(level),
    blocked: !mp.echoActive && (mp.available < echoReserve(level) || mp.burnedOut)
  };
  const bo = actor.effects.get(EFFECT_IDS.burnout);
  context.burnout = bo ? { remaining: Math.ceil(/* rounds from bo.duration.remaining */), total: bo.flags["veyl-frameworks"].roundsTotal } : null;
  context.attack = signed(prof + actor.system.abilities[abl].mod);   // derived — Attunement-aware via AE
  context.dc = 8 + prof + actor.system.abilities[abl].mod;
}
```
(MP-max branch tab.mjs:284-287 switches to `baseMod`; Arts branch :288-300 untouched.)

### 6.2 Ability rows: use control + affordability state (tab.hbs :95-102)

Use button before the post button inside `.item-controls` (tab.hbs:96):

```hbs
<button type="button" class="unbutton item-control always-interactive veyl-use"
        data-veyl-use="" {{#if this.usable.blocked}}disabled aria-disabled="true"{{/if}}
        data-tooltip aria-label="{{this.usable.label}}">
  <i class="fa-solid {{#if this.usable.blocked}}fa-ban{{else}}fa-bolt{{/if}}" inert></i>
</button>
```

`<li>` (tab.hbs:79) gains `{{#if this.usable.blocked}}veyl-unusable{{/if}}`. Per-item context (item mapper tab.mjs:266-280): `usable: { blocked, reason, label }` from an engine pre-check at step 1; reason precedence **burnout > strain > insufficient**. Echo row: when active, the button becomes **Collapse** (icon `fa-link-slash`, "Collapse (returns N MP)") — never blocked. Surge row: blocked by burnout, by `level < 5`, or when even `available + floor(hp/2)` can't reach 15 (this sheet gate now matches the engine's `insufficient-hp` refusal, §4).

Ladder strain badges: `buildAbilitySummary(item, { framework, level, strainLocks = [] })` (Arts callers pass nothing — unchanged); ladder rows gain `locked: framework === "magecraft" && csl >= 6 && strainLocks.includes(csl)`; template step class gains `veyl-strain-locked` (opacity .45 + line-through). Chat.mjs:51 passes the identity's array.

### 6.3 Dialogs

**Resolution — base class:** `dnd5e.applications.api.Dialog5e` (UI track) over the Cards track's bare `DialogV2` — inherits dnd5e2 styling, `standard-form`, native footer for free. **Resolution — dialog count:** two dialogs (`VeylEmpowerDialog`, `VeylSurgeDialog`, in new `scripts/dialogs.mjs`) per the UI track; the Cards track's single `VeylUsePicker` merges into them; Echo has no dialog (all tracks agree — sheet toggle only).

**Feasibility fix (HIGH):** the draft's `closeOnSubmit: true` + `submitOnChange: true` is self-defeating — core `_onChangeForm` routes every radio `change` through `_onSubmitForm`, which then closes when `closeOnSubmit` (application.mjs:1617-1645), so the dialog would vanish on first selection. Corrected config for **both** dialogs: `closeOnSubmit: false`; `submitOnChange: true` drives live re-render only (the submit handler stores form state and re-renders the preview); an explicit footer **Activate/Surge** button (`data-action: "confirm"`) resolves the `prompt()` Promise and closes.

```js
export class VeylEmpowerDialog extends dnd5e.applications.api.Dialog5e {
  static DEFAULT_OPTIONS = {
    classes: ["veyl-empower"], position: { width: 420 },
    form: { handler: VeylEmpowerDialog.#onSubmit, closeOnSubmit: false, submitOnChange: true },
    actions: { confirm: VeylEmpowerDialog.#onConfirm }   // footer button resolves + closes
  };
  static PARTS = {
    content: { template: "modules/veyl-frameworks/templates/dialogs/empower.hbs" },
    footer:  { template: "templates/generic/form-footer.hbs" }
  };
  static async prompt({ item }) { /* returns Promise<step|null>; resolves on confirm, null on close */ }
}
```

Step-row context: `{ step, cost, csl, unlocked, affordable, strainLocked, selected, crossesThresholds }`; selectable = `unlocked && affordable && !strainLocked`. **templates/dialogs/empower.hbs**:

```hbs
<fieldset>
  <legend>{{localize "VEYL.Empower.Legend"}}</legend>
  <p class="hint">{{localize "VEYL.Empower.Hint" available=mp.available}}</p>
  <div class="veyl-step-list">
    {{#each steps}}
    <label class="veyl-step-option {{#unless this.selectable}}disabled{{/unless}}
                  {{#if this.threshold}}veyl-threshold{{/if}}">
      <input type="radio" name="step" value="{{this.step}}"
             {{#if this.selected}}checked{{/if}} {{#unless this.selectable}}disabled{{/unless}}>
      <span class="step roboto-upper">{{localize "VEYL.Step"}} {{this.step}}</span>
      <span class="cost">{{this.cost}} {{localize "VEYL.MP"}}</span>
      <span class="csl">{{this.csl}}</span>
      {{#unless this.selectable}}<span class="veyl-why">{{this.blockedLabel}}</span>{{/unless}}
    </label>
    {{/each}}
  </div>
</fieldset>
{{#if evolutionPreview.length}}
<fieldset>
  <legend>{{localize "VEYL.Empower.Evolutions"}}</legend>
  {{#each evolutionPreview}}
  <div class="note info">
    <i class="fa-solid fa-arrow-up-right-dots" inert></i>
    <p class="hint"><strong>{{localize "VEYL.ThresholdStep" step=this.step}}:</strong> {{{this.enriched}}}</p>
  </div>
  {{/each}}
</fieldset>
{{/if}}
<div class="note {{#if strainWarning}}warn{{else}}info{{/if}}">
  <p class="hint">{{costPreview}}</p>  {{!-- "Spend 9 MP (14 → 5). Locks 6th-comparable until long rest." --}}
</div>
```

`submitOnChange` re-renders `evolutionPreview` (only evolutions whose threshold step ≤ selected — fixing phase-3.md deviation 2) and the strain warning (CSL ≥ 6); the footer confirm commits. Entry: exactly one legal step → skip the dialog; shift/ctrl-click = fast-path step 1 (dnd5e convention).

`VeylSurgeDialog` (`classes: ["veyl-surge"]`, width 420, same `closeOnSubmit: false` + footer-confirm pattern): context recomputed from form state via `engine.surgeCost` — `{ increments, mpAvailable, echo:{active,reserve}, collapseFirst, mpFromPool, mpFreedByCollapse, mpShort, hpCost, hpAfter, totalCost, burnoutRounds, legal, blockedReason }`. **templates/dialogs/surge.hbs**:

```hbs
<fieldset>
  <legend>{{localize "VEYL.Surge.Amplify"}}</legend>
  <div class="veyl-step-list">
    {{#each options}}   {{!-- increments 1..N while 15*n reachable --}}
    <label class="veyl-step-option {{#unless this.legal}}disabled{{/unless}}">
      <input type="radio" name="increments" value="{{this.n}}"
             {{#if this.selected}}checked{{/if}} {{#unless this.legal}}disabled{{/unless}}>
      <span class="step roboto-upper">{{this.totalCost}} {{localize "VEYL.MP"}}</span>
      <span class="csl">{{this.amplifyLabel}}</span>
      {{#unless this.legal}}<span class="veyl-why">{{this.blockedLabel}}</span>{{/unless}}
    </label>
    {{/each}}
  </div>
</fieldset>
{{#if echo.active}}
<fieldset>
  <legend>{{localize "VEYL.Echo.Label"}}</legend>
  <label class="checkbox">
    <input type="checkbox" name="collapseFirst" {{#if collapseFirst}}checked{{/if}}>
    {{localize "VEYL.Surge.CollapseOffer" mp=echo.reserve}}
  </label>
  <p class="hint">{{localize "VEYL.Surge.CollapseHint"}}</p>
  {{!-- "Echo ends when Burnout begins regardless; collapsing first lets its N MP pay for the Surge." --}}
</fieldset>
{{/if}}
{{#if hpCost}}
<div class="note warn">
  <i class="fa-solid fa-heart-crack" inert></i>
  <p class="hint">{{localize "VEYL.Surge.HPWarning" mp=mpShort hp=hpCost after=hpAfter}}</p>
</div>
{{/if}}
<div class="note info veyl-surge-total">
  <p class="hint">
    <strong>{{localize "VEYL.Surge.Total"}}:</strong>
    {{mpFromPool}} {{localize "VEYL.MP"}}{{#if mpFreedByCollapse}} ({{localize "VEYL.Surge.InclFreed" mp=mpFreedByCollapse}}){{/if}}{{#if hpCost}} + {{hpCost}} {{localize "VEYL.HP"}}{{/if}}
    &rarr; <strong>{{localize "VEYL.Burnout.Preview" rounds=burnoutRounds}}</strong>
  </p>
</div>
```

HP payment is not opt-in — it appears automatically when a shortfall exists at 1 increment ("after spending all MP you can" is mandatory); `increments > 1` with any shortfall is disabled (ambiguity #7 strict); an HP shortfall the actor cannot cover disables confirm entirely (`insufficient-hp`, §4). Burnout preview always shown — Burnout is the price, never a surprise. `hpAfter === 0` escalates the warning text but doesn't block (§13).

### 6.4 Listeners (scripts/expand.mjs :18-30)

Extend `bindTabInteractions` — same `dataset.veylBound` guard, `.veyl-tab` scoping, `stopPropagation`:

- Click branches: `[data-veyl-use]` (routes by discipline: echo→`activateEcho`/`collapseEcho`, surge→`VeylSurgeDialog.prompt`, augment/channel→`VeylEmpowerDialog.prompt` or direct at step 1 → `use.mjs commitUse`); `[data-veyl-mp-meter]` (replicate dnd5e `#toggleMeter`: hide label, show/focus/select input, restore on blur).
- New delegated `change` listener: `[data-veyl-mp-input]` (delta semantics → engine), `[data-veyl-echo-toggle]` (`slide-toggle` emits bubbling `change`).
- **Known interaction** (feasibility review): the bubbling `change` also reaches the sheet's own ApplicationV2 form handler — the sheet root IS the `<form>` and `stopPropagation` cannot suppress a same-node sibling listener — so dnd5e's `submitOnChange` runs one submit per interaction. Because the MP input has no `name`, that submit's diff is empty (a no-op write at worst). Accepted as designed; leg K asserts console-clean and no spurious actor writes across these interactions.

Item resolved via `closest("li.item").dataset.itemId` (same as onPostCard, chat.mjs:20-22). Dialogs are their own AppV2 instances — no delegation concerns.

### 6.5 CSS (append to styles/veyl-frameworks.css, ~50 lines)

Only what native `.dnd5e2` classes don't cover: MP gradient tokens (`--veyl-color-mp-1/2/3` on `.veyl-tab`, gradient on `.meter.veyl-mana .progress::before`), **replication of the native meter's layout rules on our bar** — dnd5e.css:7600-7620 keys `flex: 1; position: relative; cursor: pointer` to `.meter.sectioned > .hit-points` (not a generic `.progress`) and styles `.tmp > input` (we use a span) — so `.meter.veyl-mana > .progress` and `.tmp.veyl-reserved` must carry those rules explicitly or the bar won't fill/click natively (feasibility review; this is the budget bump from ~40 to ~50 lines), `.veyl-reserved` gold value, `.veyl-status` flex strip, `.veyl-echo-toggle` (+`.veyl-blocked` opacity .5), `.veyl-burnout` maroon pill, `.veyl-use:disabled` (opacity .4, `pointer-events:none` on icon only so `data-tooltip` on the button still fires), `.veyl-unusable .veyl-col` dim, `.veyl-strain-locked` (opacity .45 + line-through), dialog `.veyl-step-option` grid rows (+`.disabled`, `.veyl-threshold` gold inset, `.veyl-why` maroon small). Meter chrome, gold buttons, notes, fieldsets, slide-toggle theming all come free from dnd5e.

---

## 7. Chat cards & use-time flow

(Cards track authoritative.)

### 7.0 Core decision: spend-at-confirm, receipt cards

**MP is spent at picker-confirm time, BEFORE any message exists. The usage card is a born-spent receipt.** (1) Step choice must validate against live MP/Strain/Burnout at payment; pay-later cards go stale. (2) Spend-at-confirm keeps message authorship + item ownership on one client — no cross-client permission paths. (3) Matches dnd5e's own model (Activity.use consumes, then posts) and "never a half-spend": the card cannot exist unless payment succeeded. Receipts render from immutable creation-time flags — nothing post-hoc mutated for the spend.

Two card kinds, one parameterized template (Arts branch untouched):
- `reference` — the existing Phase 3 read-only card, plus one optional owner-only **Use** button that launches the same picker flow (never mutates the reference card).
- `use` — the receipt: step, cost, crossed evolutions, resolution buttons, penalty lines.

**Receipt numbers are historical; roll modifiers are live.** Cost/step/evolutions/**DC are frozen at cast** (a cast's DC is a property of the casting; collapsing Echo later must not retroactively change it); attack rolls recompute mod/prof at click (existing chat.mjs:91-92 pattern). Usage cards filter evolutions to crossed thresholds only (`THRESHOLD_STEPS[t] <= step`); reference cards keep showing all, gaining "(step N)" labels.

### 7.1 Usage-card flags (baked at create, immutable)

```js
flags["veyl-frameworks"] = {
  itemUuid,                       // existing key, kept
  identityUuid,                   // new — resolves the identity for spends
  kind: "use",                    // "reference" (default when absent, back-compat) | "use"
  use: {
    discipline,                   // "augment" | "channel" | "surge" | "echo"
    step, cost, csl,              // e.g. 4, 6, "3rd"
    evolutions: [1],              // threshold indices (1..3) crossed
    mpAfter,                      // remaining current MP (receipt line)
    strainLocked: null | 6..9,
    attuned: true,                // Echo active at cast (display pill)
    dc, saveAbility,              // frozen at cast: 8 + prof + attuned mod
    echoAction: "activate"|"collapse"   // echo receipts only
  },
  surge: {                        // discipline "surge" only
    increments, totalMP, mpPaid, hpPaid,      // hpPaid in HP (2:1)
    echoCollapsed, echoReturned,
    burnoutRounds, burnoutEffectId
  }
}
```

Echo activation/collapse posts a small receipt card (activation costs an action — table-visible; owner may cut, §13).

### 7.2 Sequencing (canonical flow)

```
USER CLICK (sheet row Use / reference-card Use)
  │  expand.mjs delegated listener ([data-veyl-use]) or chat.mjs CARD_ACTIONS["veyl-use"]
  ▼
GUARD #1  engine.manaState(identity)              — Burnout? not owner? → warn, STOP
  ▼
PICKER    VeylEmpowerDialog / VeylSurgeDialog     — steps capped by unlockedStep ∧ affordable
  │        (skipped: one legal step; shift-click; Echo = sheet toggle, no picker)  ∧ ¬strained
  ▼ confirm(choice)
GUARD #2  re-fetch identity/item by id off fresh actor.items; engine re-validates
  │        inFlight.add(identity.uuid)            — same-client double-click dead here
  ▼
SPEND     engine.activateAbility | activateSurge | activateEcho | collapseEcho
  │        ONE item.update on identity (currentMP, strainLocks, echoActive, ...)
  │        surge only: actor.update HP; create Burnout AE; delete Attunement AE
  │        echo only:  create/delete Attunement AE
  │        → Foundry re-renders actor sheet (embedded-update descendant render)
  ▼ receipt {step, cost, csl, evolutions, mpAfter, strain?, surge?}
POST      postUsageCard(item, receipt) → ChatMessage.create({flags:{[MODULE_ID]:{itemUuid, identityUuid, kind:"use", use, surge}}})
  │        inFlight.delete
  ▼
RENDER    renderChatMessageHTML → bind veyl-attack/veyl-save; dnd5e _displayChatActionButtons
  │        hides owner-only buttons; data-visibility="all" keeps Save public;
  │        autoCollapseItemCards collapses the description natively (use cards only)
  ▼
ROLLS     veyl-attack → D20Roll.build (live attuned mod/prof, event keybinds, originatingMessage grouping)
          veyl-save   → per-controlled-token actor.rollSavingThrow({target: frozen DC})
```

Double-spend guard (`scripts/use.mjs`) — single-client guarantee; multi-client concurrency is a documented limitation (§4):

```js
const inFlight = new Set();                       // module-scope, keyed by identity.uuid
export async function commitUse(actor, itemId, choice) {
  const item = actor.items.get(itemId);           // re-fetch — never cache across updates
  const identity = identityFor(actor, "magecraft");
  const key = identity.uuid;
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  try {
    const verdict = /* engine guard chain */;
    if (!verdict.ok) { ui.notifications.warn(verdict.reason); return null; }
    const receipt = await engine.activateAbility(identity, item, choice);  // ONE item.update
    return await postUsageCard(item, receipt);    // card only exists if payment succeeded
  } finally { inFlight.delete(key); }
}
```
Plus `target.disabled = true` in try/finally on every card-button handler (dnd5e `#onChatAction` pattern, dnd5e.mjs:6497-6507).

### 7.3 Card actions & template

| data-action | Card kind | data-visibility | Handler |
|---|---|---|---|
| `veyl-use` | reference | *(omit → author/owner/GM via dnd5e `_displayChatActionButtons`)* | picker flow |
| `veyl-attack` | use | *(omit — owner only)* | `onAttackRoll` |
| `veyl-save` | use | **`all`** (targets must see it) | `onSaveClick` |

`onRenderChatMessage` becomes a dispatch table over these; reference-card Use renders `disabled` + `title` reason when unaffordable at render time (cosmetic — guard #2 is authoritative; click re-checks and toasts on stale affordability). Stay off dnd5e action names and `flags.dnd5e` entirely; keep binding via core `renderChatMessageHTML`.

**templates/chat-card.hbs skeleton** — single parameterized file, **explicitly branched on `isUse`** (feasibility fix: the collapse chrome must NOT apply to reference cards — the current chat-card.hbs:11-50 header is non-collapsible with `<footer class="card-buttons">`, and applying `description collapsible` unconditionally would let `autoCollapseItemCards` and dnd5e's chat-log-wide collapse toggle start folding existing Phase-3/Arts cards, breaking the byte-identity invariant). Reference/Arts cards render the **current Phase 3 markup verbatim** via the `{{else}}` branch; only `kind: "use"` cards adopt dnd5e's native collapse (`description collapsible` + chevron + `details collapsible-content` get `Item5e.chatListeners` toggling and `autoCollapseItemCards` for free) and the native `<div class="card-buttons">`:

```hbs
<div class="dnd5e2 chat-card veyl-chat-card" {{#if isUse}}data-veyl-kind="use"{{/if}}>
  {{#if isUse}}
  <section class="card-header description collapsible">
    <header class="summary">
      <img class="gold-icon" src="{{img}}" alt="{{name}}">
      <div class="name-stacked border">
        <span class="title">{{name}}</span>
        <span class="subtitle">{{subtitle}}</span>
      </div>
      <i class="fa-solid fa-chevron-down fa-fw" inert></i>
    </header>
    <section class="details collapsible-content card-content">
      <div class="wrapper">
        {{> existing meta + summary.rich + amplify block}}
        {{#each crossedEvolutions}}
          <div class="veyl-line veyl-evolution"><strong>{{localize "VEYL.Evolution"}} ({{localize "VEYL.Step"}} {{step}}):</strong>
            <div class="veyl-inline-rich">{{{enriched}}}</div></div>
        {{/each}}
      </div>
    </section>
  </section>
  {{else}}
  {{!-- reference cards: current chat-card.hbs:11-50 header + content, byte-identical --}}
  {{/if}}
  {{#if buttons.length}}
  {{#if isUse}}<div class="card-buttons">{{else}}<footer class="card-buttons">{{/if}}   {{!-- native use-card markup is a div; reference keeps its footer --}}
    {{#each buttons}}
    <button type="button" data-action="{{action}}" {{#if visibility}}data-visibility="{{visibility}}"{{/if}}
            {{#each dataset}}data-{{@key}}="{{this}}"{{/each}} {{#if disabled}}disabled title="{{reason}}"{{/if}}>
      <i class="{{icon}}" inert></i>
      {{#if dc}}<span class="visible-dc">{{label}} {{localize "VEYL.DC"}} {{dc}}</span><span class="hidden-dc">{{label}}</span>
      {{else}}<span>{{label}}</span>{{/if}}
    </button>
    {{/each}}
  {{#if isUse}}</div>{{else}}</footer>{{/if}}
  {{/if}}
  {{#if isUse}}
  <p class="supplement"><strong>{{localize "VEYL.Cost"}}:</strong> {{receiptLine}}</p>  {{!-- "6 MP (Step 4, 3rd) — 31 MP remaining" --}}
  {{#each supplements}}<p class="supplement {{cls}}"><strong>{{label}}:</strong> {{text}}</p>{{/each}}
  <ul class="card-footer pills unlist">
    {{#if attuned}}<li class="pill transparent">{{localize "VEYL.Attuned"}}</li>{{/if}}
    {{#if concentration}}<li class="pill transparent">{{localize "VEYL.Field.concentration"}}</li>{{/if}}
    {{#if strainPill}}<li class="pill transparent veyl-strain-pill">{{strainPill}}</li>{{/if}}
  </ul>
  {{/if}}
</div>
```

### 7.4 Attack rolls

Because Attunement is an AE, the derived `.mod` chat.mjs:91 already reads IS the attuned modifier — "up" while Echo is active, base after collapse/Burnout, zero read changes. Upgraded call (verified 5.0.4/5.2.x shape; keep per-roll `options:{}` — `applyKeybindings` reads it unguarded at 70812):

```js
await CONFIG.Dice.D20Roll.build(
  { event,
    rolls: [{ parts: ["@mod", "@prof"], data: { mod, prof }, options: {} }] },
  { options: { window: { title: game.i18n.localize("VEYL.AttackRoll"), subtitle: item.name, icon: item.img } } },
  { data: { flavor, speaker } }        // no flags.dnd5e ever
);
```
**`hookNames` deliberately omitted** (defaults to `[""]`, dnd5e.mjs:9134 — feasibility review): passing `["attack", "d20Test"]` would fire `dnd5e.preRollAttackV2`/`postAttackRollConfiguration` with a config lacking `subject`/`activity`/`workflow`, which ecosystem listeners (Midi-QOL et al.) routinely dereference — impersonating the native attack hook chain widens the blast radius for zero 0.9 benefit. Revisit alongside AC targeting (§13 Q14/Q19). `config.event` still gives adv/dis keybinds and `originatingMessage` roll-grouping under the card for free (written by dnd5e's own pipeline onto the roll message — native and safe). Keep the plain-Roll fallback (chat.mjs:112-117) verbatim. No AC `target` passed (open decision Q14).

### 7.5 Save resolution

Clicker-rolls-own-selection (native SaveActivity model — no sockets, no whispers). Button: `data-action="veyl-save" data-ability="{{use.saveAbility}}" data-dc="{{use.dc}}" data-visibility="all"` with the `visible-dc`/`hidden-dc` span pair (dnd5e's `shouldDisplayChallenge` CSS hides DC from players automatically). Handler: for each controlled token (fallback `game.user.character`), `t.actor.rollSavingThrow({ event, ability, target: Number(dc) }, {}, { data: { speaker } })` — `target` buys native success/failure highlighting; button disabled in try/finally; warn on no selection.

### 7.6 Surge cards

Receipt supplements itemize each MP once by origin — no-double-count inherent. Legal examples (rules review fix — HP can never fund amplification, so an amplified Surge is always fully MP-funded): base with shortfall — `Surge (1 increment): 15 MP total — 7 MP spent, 16 HP paid (8 MP) — 0 MP remaining`; amplified with collapse — `Surge (2 increments): 30 MP total — 30 MP spent; Echo collapsed (+10 MP returned) — 2 MP remaining`. Burnout supplement, warn-styled: `Burnout: 10 rounds — no Magecraft activations, no MP recovery` + out-of-combat hedge. Amplify enriched text for the purchased increment count (mastery-tier flavor rides the item's own description text — §1 punt). Optional/cut-first: `setFlag` strikethrough when a GM hand-deletes the Burnout effect early (authorship edge cases; open decision Q15).

---

## 8. Rest cycle

Hooks only, no libWrapper; registered in `main.mjs` init:

- **`dnd5e.preRestCompleted(actor, result, config)`** — fires after result computation, before updates; push `{_id: identity.id, ...}` rows into **`result.updateItems`** so recovery rides dnd5e's own `updateEmbeddedDocuments` transaction (single write, no double render). Never `return false` (cancels the whole rest).
- **`dnd5e.restCompleted`** — effect side-effects only (delete the Burnout AE when cleared). Never mutate MP here. **The explicit delete is load-bearing** (feasibility review): `config.duration` is a rest-config fiction — world time only advances when `config.advanceTime && game.user.isGM` — so a seconds-form Burnout's `duration.remaining` will usually NOT have elapsed on world time after the rest; never rely on the `updateWorldTime` sweep to catch a rest-cleared Burnout.

Per Magecraft identity (`identityFor` pattern, tab.mjs:207-219):

1. **Burnout gate first. Resolution:** the Engine track's **elapsed-time reading wins** over the Test track's blanket-suppression recommendation. Burnout durations are 5-30 rounds ≈ 30 s-3 min of world time; a short rest (60 min) or long rest (480 min) necessarily outlasts them, so `config.duration * 60 >= roundsTotal * 6` (always true in practice) → the rest **clears Burnout and recovery proceeds normally** — ambiguity #2 resolved as "delayed, not wasted," which is more rules-coherent (the Burnout expired before the rest completed). If somehow not elapsed: skip all MP recovery, do NOT consume `shortRestUsed` (nothing was gained), but a long rest still clears `strainLocks`/`shortRestUsed` (Burnout blocks *regaining MP*, nothing else — contract §8). Flagged for owner sign-off (§13 Q2).
2. **Long rest**: push `{"system.currentMP": max, "system.strainLocks": [], "system.shortRestUsed": false}`. `current = max` regains all expended MP; the Echo reserve stays bound via the `available` floor — "reserved untouched by rests" is free by construction.
3. **Short rest**: if `shortRestUsed` → push nothing; else push `{"system.currentMP": Math.min(max, current + Math.floor(max/3)), "system.shortRestUsed": true}` (ambiguity #5: one-third of max, clamped).
4. `max` computed with `baseMod()` — `_source` read makes an active Attunement automatically irrelevant.

---

## 9. Enforcement matrix

Guard placement: every engine entry point re-checks; UI disabled-states and card render-states are advisory only — the engine refuses regardless (stale cards get click-time re-validation + toast, never a half-spend).

| Action \ State | **Burnout** | **Strain (CSL L locked)** | **Insufficient available MP** |
|---|---|---|---|
| Activate Channel/Augment (any step) | **Blocked** (`"burnout"`) — all disciplines | **Blocked** only when activated step's CSL == a locked level ≥6 (`"strained"`); other CSLs legal | **Blocked** (`"insufficient-mp"`) when `cost > available` |
| Empower to step S | Blocked (whole activation) | Step rows at locked CSLs disabled; other steps selectable | Step rows above affordability cap disabled (also above `unlockedStep(level)` — `"locked-step"`) |
| Activate Echo | **Blocked** | Exempt (Echo never Strains, never locks) | **Blocked** when `available < echoReserve(level)` (ambiguity #8) |
| Collapse Echo | **Allowed** (harmless; canonically already ended at Burnout onset) | Allowed | Allowed (no cost) |
| Activate Surge | **Blocked**; also blocked below level 5 (`"level"`) | Exempt (Surges never Strain — Burnout is their price) | Allowed via HP shortfall at 1 increment only (2 HP : 1 MP, up to the 15 minimum) **and only when HP actually covers it** (`hpAfter >= 0`, else `"insufficient-hp"`); **blocked** for `increments > 1` with any shortfall (ambiguity #7 strict, `"amplify-shortfall"`) |
| Short-rest MP recovery | **Blocked** unless rest duration outlasts remaining Burnout (always true in practice → clears Burnout, then recovers); `shortRestUsed` not consumed when nothing granted; also blocked once per long rest by `shortRestUsed` | N/A (short rest never clears locks) | N/A |
| Long-rest MP recovery | Same elapsed-time gate; `strainLocks`/`shortRestUsed` clear regardless | Clears all locks | N/A |
| `restoreMP` / MP `+` input | **Blocked** ("regain no MP") | Allowed | Clamped to max |
| Card attack/save rolls | Allowed (resolving an already-paid activation; concentration effects persist — ambiguity #3) | Allowed | Allowed |

Additional invariants: max one Augment per host action and Augment reach limits are design-time/table rules, not engine-enforced in 0.9; abilities are known even when unaffordable (visibility never gated by MP); Attunement never feeds MP max; Burnout duration = `5 × totalMPValue/15` rounds where `totalMPValue = mpPaid + shortfall` (each point once).

---

## 10. Exit test (written FIRST; full run gates v0.9.0)

(Test track authoritative; adjusted for the resolutions: five schema keys not four, Burnout has no schema field, no manual tick; fixtures corrected per rules review.) Fixtures: **F1** L5 Int 18 → base mod +4, prof +3, max = 15+20+3+5 = **43**, unlocked step 3, reserve 10, has Surge. **F2** L13 Int 20 → base mod +5, prof +5, max = 39+65+5+5 = **114**, unlocked step 7, reserve 15 (rules review fix: the draft's L11 fixture could never activate step 7 — `unlockedStep(11) = 6`, step 7 unlocks at 13 — so leg F's shared-budget and 7th-level tests were unexecutable). **F3** L4 Int 16 → max = 12+12+2+5 = **31**, reserve 5, no Surge. **F-Arts** = standing Arts display fixture, untouched. Each has 1 Echo, 1 Channel (attack resolution), 1 Augment, ≥1 ability with all three threshold evolutions; F2 has a 6th-comparable-capable Channel **and** Augment (Augment step 7 = 6th CSL, legal at L13) plus 7th-capable Channel. All legs run on the **installed rc artifact reinstalled from the manifest**, console open throughout.

- **A. Migration & schema** — T-A1 install rc over existing world: **zero `_source` diff on every item at install** (Foundry materializes schema initials only on first write — initials live in prepared data; feasibility review fix); after the first engine write on a Magecraft identity, its diff = exactly `currentMP, echoActive, echoItemId, strainLocks, shortRestUsed`; ability items zero diff always. T-A2 Arts identity `_source` **byte-identical throughout** (no engine write ever targets it); Arts tab screenshot-identical to Phase-4 evidence. T-A3 fresh identity: prepared-data initials correct, no console errors, `FIXED_ACTIVATION` coercion regression intact.
- **B. MP arithmetic & clamp** — T-B1 F1 shows 43/43 with `currentMP` **absent from `_source`** (no render write). T-B2 spend 5 → 38/43 persisted; spend to 0; overdraft refused, unchanged. T-B3 restore 50 → clamps 43. T-B4 level-down: display clamps immediately, `_source` unchanged until next engine write. T-B5 max spot-pins vs contract table: L1/+3=13, L5/+4=43, L10/+5=89, L20/+5=171.
- **C. Echo lifecycle** — T-C1 F3 activate: available 26/31, −5 chip, `_source` diff = `echoActive`+`echoItemId` only. T-C2 spend to available 0 → further spend refused "reserved", `currentMP === 5`. T-C3 level 4→5 mid-Echo: reserve derives to 10, available floors at 0, Echo stays up (Q6 default). T-C4 collapse: instantly spendable same script tick; Attunement AE gone. T-C5 activation gate at available < reserve. T-C6 band pins 5/10/15/20/25 at boundary pairs 4→5, 9→10, 14→15, 19→20.
- **D. Attunement** — T-D1 F1 activate: Int 18→20, mod +4→+5, attack **+8**, DC **16**; native Int check/save also +5. **T-D2 MP max still 43 while attuned — the single most load-bearing assertion.** T-D3 F2: Int 26 (20 + floor(13/2) = 6), unclamped past 20. T-D4 odd-parity applied to score (Int 17 L4 → 19). T-D5 ASI through AdvancementManager with Echo active: `_source` moves by the ASI only, derived = source+ASI+attunement, reverse symmetric, MP max moves only by the ASI. T-D6 level-change rewrites `changes[0].value`. T-D7 idempotent double-activate (one effect); `deleteItem` cleanup; manual base-score edit per Q8 policy. T-D8 token HUD shows the Echo/Burnout icons but offers **no toggle** (`hud: false`); no HUD path can desync `echoActive` from the AE.
- **E. Empowerment caps & evolutions** — T-E1 unlock cap alone (F1 full MP: steps 1-3 only, never 4). T-E2 affordability cap alone (F2 at 4 MP: steps 1-2 only). T-E3 evolutions at exactly 3/6/9 (step 2 → none; 3 → first; 6 → 1+2; 9 → all; fixes phase-3 deviation 2). T-E4 costs match MP_COSTS at every step (spot the +2 thresholds: 3=5, 6=9, 9=13). T-E5 dialog stays open across selection changes (preview re-renders; only footer confirm closes — the `closeOnSubmit` regression guard).
- **F. Strain** (all on F2, L13) — T-F1 6th-comparable Channel (9 MP) → `strainLocks:[6]`; second 6th Channel AND 6th-comparable Augment (step 7, 10 MP) blocked — shared budget. T-F2 7th-comparable Channel still legal with 6 locked, then locks 7 independently. T-F3 empowered-into-6th locks 6 (activated step, not base identity). T-F4 ≤5th never locks; Echo/Surge never lock. T-F5 short rest: locks survive; long rest: cleared.
- **G. Surge/HP/Burnout** — T-G1 15 → 28 MP left, Burnout 5 rounds; 30 → 13 left, 10 rounds. T-G2 at 10 MP: 10 MP + **10 HP**, HP actually deducted, Burnout 5 rounds. T-G3 strict amplify: at 20 MP, 30 not offered; at 30+, offered. T-G4 all-MP-first: HP can never exceed the actual shortfall. T-G5 **collapse-into-Surge counted once**: F1 `currentMP` 20, Echo up (reserve 10) → collapse frees 20 available → 15-MP Surge → Burnout **5 rounds, not double-counted**; 5 MP left; `echoActive:false`; **one item.update** covers spend+collapse (the merged-write invariant). T-G6 combat Burnout: `duration.rounds` stamped; sweep deletes on expiry; only activeGM client deletes (two-client test); a rounds-form effect with `remaining: null` (no combat context) is **not** swept. T-G7 out-of-combat seconds form; `deleteCombat` mid-Burnout converts correctly. T-G8 recovery blocked while Burned out per §9 (`restoreMP` refuses; rest behavior per Q2/Q3). T-G9 all four activation entry points refuse; Surge without collapse-to-fund still ends Echo but excludes its points from the total. T-G10 concentration display state untouched by Burnout. T-G11 **HP sufficiency**: F1 at 10 MP and 9 HP → Surge refused (`insufficient-hp`), zero MP/HP change; at exactly 10 HP → resolves, HP 0. T-G12 **level gate**: Surge item placed on F3 (L4) → refused (`"level"`).
- **H. Rest sequence** (one scripted run on F1) — 10/43 → short: +14 → 24/43, flag true → spend to 20 → second short: +0 → long: 43/43, flag false, pre-seeded lock cleared → repeat with Echo active: long → current 43, available 33, `echoActive` still true. Verify updates rode `result.updateItems` (one transaction); rest-cleared Burnout AE deleted in `restCompleted` explicitly (not by the worldTime sweep).
- **I. Chat cards** — T-I1 card Use pays exact cost, open sheet updates live. T-I2 stale card: drain MP after post, click → toast refusal, **zero** MP change. T-I3 attack adv/dis keybinds intact; numbers attuned per T-D1, base after collapse. T-I4 grep message `_source`: `flags["veyl-frameworks"]` only, no `flags.dnd5e`. T-I5 unlinked token: MP writes into `token.delta`, base actor untouched, second activation works (re-fetch). T-I6 reference cards do **not** collapse under `autoCollapseItemCards`; use cards do (the template-branch invariant).
- **J. Arts statelessness regression** — re-run Phase-4 gate legs verbatim on F-Arts (ready hand, Rally block, technique ladder, Stance hold, Apex line, item sheets, pills/tab visibility); no Magecraft controls render anywhere in the Arts branch; Arts `_source` byte-identical.
- **K. Console-clean & idempotency** — zero errors/warnings from our namespace; sheet close/reopen ×3 mid-Echo; rapid double-click every button (single spend, single effect, exactly one card); MP-input/echo-toggle interactions cause no spurious actor writes despite reaching the sheet's `submitOnChange` pipeline (§6.4).

---

## 11. Internal milestone / rc plan

Each rc tagged and **reinstalled from the manifest** (house rule); each gate includes prior subsets as scripted regression legs. **M0 (release workflow, LICENSE, dead-fallback sweep, local dnd5e update to 5.2.x) ships before rc.1** — the workflow is what makes four tags cheap, and the 5.2.4 re-verifications (rest `result` shape, ASI source-read, no score clamp, `updateItems` transaction order) gate rc.1's hook code.

| Tag | Milestone | Ships | Gate subset | Evidence |
|---|---|---|---|---|
| `v0.9.0-rc.1` | **9a Engine** | schema + constants move, `engine.mjs` transitions (script-driven, no UI), rest hooks, Echo state (no AE yet) | A, B, C1-C6 scripted, H, J schema leg, K | `docs/gates/0.9-engine.md` |
| `v0.9.0-rc.2` | **9b Attunement + live UI** | Attunement AE, MP meter + Echo toggle + strain badges, `baseMod`/`_source` switch everywhere | D full, C UI leg, E1-E2 via picker, J render leg, K | `docs/gates/0.9-attunement.md` |
| `v0.9.0-rc.3` | **9c Cards + penalties** | usage cards, empowerment picker, Surge dialog + HP payment, Strain enforcement, Burnout AE + expiry sweep | E, F, G, I, J card leg, K | `docs/gates/0.9-cards.md` |
| `v0.9.0-rc.4` → `v0.9.0` | **Release gate** | fixes only | **entire §10**, one sitting | `docs/gates/release-0.9.md` |

Rationale: seams are the risk boundaries — 9a is pure state correctness (migration byte-diff cheapest to bisect before UI exists), 9b isolates the one actor-wide-blast-radius feature (real score modification; kill-switch = `collapseEcho`), 9c is workflow correctness consuming both.

**Consolidated file-by-file change list:**

| File | Change |
|---|---|
| `scripts/models.mjs` | +5 `FrameworkData` fields (§3) after :72; header comment :4-8 amended; **receives `MP_COSTS`/`echoReserve`/`unlockedStep` from tab.mjs + new `comparableLevelNumber`** (cycle fix, §2); `AbilityData` untouched |
| `scripts/engine.mjs` **(new)** | §4 API + `staticId` + effect builders + rest handlers + expiry sweeps; imports constants from models.mjs only |
| `scripts/use.mjs` **(new)** | `onUseAbility`, `commitUse`, `inFlight`, `postUsageCard`, receipt assembly |
| `scripts/dialogs.mjs` **(new)** | `VeylEmpowerDialog`, `VeylSurgeDialog` (Dialog5e subclasses, `closeOnSubmit: false` + footer confirm) |
| `scripts/main.mjs` | register `dnd5e.preRestCompleted`/`restCompleted`, `updateCombat`, `deleteCombat`, `updateWorldTime`, `dnd5e.advancementManagerComplete`, `updateItem` (class-level watch), `deleteItem`; `CONFIG.statusEffects` entries `veyl-echo`/`veyl-burnout` with `hud: false` |
| `scripts/tab.mjs` | :23/:33/:63 constants re-imported from models.mjs; :240-247 `baseMod` split (carried comment resolved); :258-259 attack/DC stay on derived mod (attuned via AE); :284-287 → live `mana`/`echo`/`burnout` context; item mapper :266-280 gains `usable`; `buildAbilitySummary` gains `{strainLocks, forUse, step}` options (Arts callers unchanged); Arts branch :288-300 untouched |
| `scripts/chat.mjs` | dispatch table (`veyl-use`/`veyl-attack`/`veyl-save`); `D20Roll.build` upgrade (§7.4, no `hookNames`); `onSaveClick`; `identityUuid`+`step` flags at :67; render-time affordability hint; delete Attunement-blind comments :8-11/:35-36; Phase-3 reference output byte-identical (`isUse:false` branch renders current markup verbatim) |
| `scripts/expand.mjs` | :18-30 +click branches (`data-veyl-use`, `data-veyl-mp-meter`), +delegated `change` (`data-veyl-mp-input`, `data-veyl-echo-toggle`), discipline router |
| `templates/tab.hbs` | :36-46 MP stat pair; meter+status block after :47; use button :95-102; `veyl-unusable` :79; `veyl-strain-locked` :123 |
| `templates/chat-card.hbs` | §7.3 parameterized skeleton with explicit `isUse` branch; reference/Arts rendering byte-identical via `{{else}}` |
| `templates/dialogs/empower.hbs`, `templates/dialogs/surge.hbs` **(new)** | §6.3 skeletons |
| `styles/veyl-frameworks.css` | §6.5 (~50 lines incl. native-meter rule replication) + card supplement/pill/picker styles |
| `lang/en.json` | ~35 keys: `VEYL.Use`, `VEYL.Blocked.*`, `VEYL.Reason.*`, `VEYL.MP.*`, `VEYL.Echo.*`, `VEYL.Burnout.*`, `VEYL.Empower.*`, `VEYL.Surge.*`, `VEYL.Strain.*`, `VEYL.Evolution`, `VEYL.DC`, `VEYL.Attuned`, `VEYL.NoTokenSelected`, `VEYL.HP` |
| `module.json` | version bumps per rc |
| `icons/` **(new)** | `echo.svg`, `burnout.svg` — explicit AE `img` (a `keepId` create does not inherit the CONFIG entry's icon) |
| `docs/gates/` | `0.9-engine.md`, `0.9-attunement.md`, `0.9-cards.md`, `release-0.9.md` (incl. the score-read audit ledger table — every `abilities[X]` read site: base vs derived) |

---

## 12. Revised plan-1.0.md milestone map

The re-scope inverts the plan's framework axis: "both frameworks per layer" → "all layers Magecraft, then all layers Arts." Replacement for plan-1.0.md:36-52:

| Milestone | Version | Was | Now |
|---|---|---|---|
| M0 Close-out + infrastructure | v0.4.0 | unchanged | unchanged; release workflow now load-bearing for the rc cadence; add local dnd5e 5.2.x update |
| M1 → **9a Magecraft engine** | v0.9.0-rc.1 | both-framework state | Magecraft state + rests only; Arts fields (`stanceActive`, `heldTechniqueIds`, `spentTechniqueIds`) deferred, schema shape frozen in plan text |
| M2 → **9b Attunement** | v0.9.0-rc.2 | M2 | **Con adept HP carve-out spike deleted from 0.9** (Con is Arts-only); spike reduces to ASI + manual-edit policy |
| M3 → **9c Use-time** | v0.9.0-rc.3 | M3 A+B both frameworks | Magecraft only: cards-that-spend, empowerment, Surge/HP, Strain, Burnout. Apex/Winded/technique-spend moves to 1.0 |
| **0.9 release** | v0.9.0 | (didn't exist) | full §10 gate; user-facing Magecraft-only release; README states Arts is display-only pending rules |
| **M4 → 1.0 Arts parity** | v1.0.0 | M4 = packaging | absorbs: Arts rules freeze (external gate — blocked on design, not code), Arts state fields + Stance/Rally/breather, Arts Attunement **with the Con adept HP carve-out spike**, Apex + Winded, Arts cards, then old M4 tail: compendia, user guide, LICENSE check, cumulative Phase 1-9 regression, Taoteti conversation |

DoD edits: plan-1.0.md:14-34 splits into "DoD 0.9" (items 2-5 Magecraft-restricted, item 1 unchanged, items 6-7 deferred) and "DoD 1.0". Risk-register rows for Con-adept and Winded move to the 1.0 column. Punted list gains "Arts live state — deliberately, until rules settle", "Concentration enforcement", "Echo Deepening / Surge Mastery tier mechanics (display rides item text)", and "multi-client spend serialization (activeGM routing)". roadmap.md and README.md each get a one-paragraph re-scope note pointing at the revised plan (do not rewrite roadmap.md's findings). Named non-goal: forking the shared `tab.hbs`/`prepareFrameworkContext` parameterization — Test leg J is the enforcement.

---

## 13. Open decisions for the owner (sign off BEFORE the exit test is frozen — test-first bakes answers into assertions)

> **Signed off 2026-08-16.** Owner walked all 19 and confirmed the design's adopted answer on every item, with Q2 (rest clears Burnout), Q4 (strict: amplification never HP-funded), Q5 (no auto-gain on level-up), and Q12 (keep Use on reference cards) confirmed explicitly. Q17 remains a mandatory rc.1 checklist, not a choice. The exit test (§10) is now frozen against these answers.

1. **HP payment** (ambiguity #6): direct HP reduction, temp HP ineligible, may drop to exactly 0 with escalated warning (not blocked); **engine refuses when `hp.value < hpPaid`** (`insufficient-hp` — rules review fix; the Surge must be fully paid to resolve). Alternative: route through `applyDamage` as untyped damage. *(Affects T-G2/T-G11.)*
2. **Rest during Burnout** (ambiguity #2): elapsed-time reading adopted — rest outlasts and clears Burnout, recovery proceeds. Strict alternative: any rest finishing while Burned out yields zero MP. *(Affects T-G8; conflict between Engine and Test tracks, resolved for Engine — flag if you prefer strict.)*
3. **Short rest during Burnout consumes `shortRestUsed`?** Designed: no (nothing granted). *(T-G8.)*
4. **Strict amplify-HP reading** (ambiguity #7): `increments > 1` must be fully MP-funded. *(T-G3.)*
5. **Level-up MP**: `currentMP` does not auto-gain when max rises (HP-style); confirm, or long-rest catch-up only.
6. **Echo held with `currentMP < reserve` after level-up**: Echo stays up, available floors at 0. *(T-C3.)*
7. **Attunement live rewrite on level change**: hook-driven (designed) vs self-heal-only.
8. **Manual base-score edit while attuned**: allowed, AE stacks on top, MP max follows `_source` live; document in user guide. *(T-D7.)*
9. **`restoreMP` during Burnout for the GM**: engine refuses; GM-only force path (shift-click, logged)?
10. **Burnout out of combat**: seconds duration at 6 s/round on world time (designed) vs GM-manual-only. *(T-G7.)*
11. **Concentration**: display-only pill in 0.9 (designed); real dnd5e concentration effect is a 1.0 line item.
12. **Reference-card Use button**: keep (designed) or sheet-only Use (cuts the stale-hint problem).
13. **Echo activate/collapse receipt cards**: post to chat (designed — action-economy event) or silent sheet-side.
14. **Attack targeting**: pass `config.target` = targeted token's AC for native hit/miss? Deferred.
15. **Surge-card Burnout-cleared strikethrough**: optional/cut-first (authorship edge cases).
16. **Status icons**: token icons for Echo/Burnout assumed wanted (HUD-hidden via `hud: false`; explicit `img` files shipped); drop `statuses` if not.
17. **5.2.4 re-verifications** (local source is 5.0.4): rest hook/`result` shapes, ASI source-read, no `.value`→`.max` clamp in `prepareAbilities`, `updateItems` transaction order, `hud: false` still honored by the token HUD, `_prepareDuration` `remaining: null` behavior — all gated in M0/rc.1.
18. **Echo Deepening / Surge Mastery tiers (levels 10/15/20)**: 0.9 shows only the ability items' own description text — no tier-aware engine/card mechanics (rules review flagged the omission; punted deliberately). Confirm, or add a tier label line to Surge/Echo cards as a display-only 0.9 nicety.
19. **Attack roll hook chain**: `hookNames` omitted so our rolls do not impersonate `dnd5e.preRollAttackV2` (ecosystem listeners dereference `config.subject` we can't supply). Revisit with Q14 if native attack-hook integration is wanted.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| **Write-during-prepare render loop** — clamp/MP-init in `prepareFrameworkContext` re-renders infinitely (client-document.mjs:688-691) | Null-initial + display-side clamp; persist only in explicit engine transitions; T-B1/T-B4 assert no write |
| **Real-score AE blast radius** — every module and native roll sees the attuned score; a bug corrupts rolls silently | Own rc (9b); T-D pins native check/save numbers in both states; Plutonium smoke in 9b gate; kill-switch = `collapseEcho` (one boolean + one effect delete) |
| **MP max silently reading the derived score** after a future refactor (the exact bug the carried flags warn about) | T-D2 permanent regression leg; score-read audit ledger in the gate doc |
| **Effect never expires** (core/dnd5e auto-expire nothing) → permanent Burnout | `updateCombat`/`deleteCombat`/`updateWorldTime` sweeps with `Number.isFinite` remaining guard; T-G6/G7; GM can hand-delete via the effects panel (token HUD toggle disabled by `hud: false`) |
| **Token HUD desyncing Echo/Burnout state** — HUD status toggle creates/deletes AEs outside the engine | `hud: false` on both `CONFIG.statusEffects` entries; T-D8 |
| **Multi-client concurrent spends** — no atomic decrement in Foundry; two owners clicking together = last-write-wins, one cost lost | Per-client `inFlight` + disabled buttons narrow the window; documented limitation (single-owner play); activeGM-routed spend is the 1.0 hardening line |
| **Stale chat cards half-spending** | Click-time re-validation; single `item.update` per transition (incl. merged Surge spend+collapse); `min:0` schema throw; `inFlight` set; T-I2 |
| **Cross-document non-atomicity** (item write vs effect ops vs HP) | Merged identity write first; guards re-read; failures logged, self-heal on next activate |
| **dnd5e 5.0.4 local vs 5.2.4 world drift** — rest/ASI/clamp/HUD/duration behaviors cited from 5.0.4 | M0 updates local source; rc.1 gate re-verifies before trusting handlers; `preRestCompleted` data-push is the most stable surface |
| **Token-delta masking** — prototype MP edits stop propagating once a token has delta state | Expected per-token MP behavior; T-I5; all lookups `actor.uuid`-keyed with re-fetch by id |
| **Schema fields on shared model surprise Arts** | T-A2 byte-diff (zero `_source` change — initials never materialize without a write); Arts branch renders zero controls (leg J) |
| **Dialog closes on first selection** (`closeOnSubmit` + `submitOnChange` interaction) | `closeOnSubmit: false` + footer confirm on both dialogs; T-E5 |
| **rc overhead ×4 on manual releases** | M0 workflow is a hard prerequisite of rc.1 |
| **Rules ambiguities becoming silent code decisions** | §13 forces owner sign-off before the exit test freezes |

Key paths: `scripts/models.mjs:53-84`, new `scripts/engine.mjs` / `scripts/use.mjs` / `scripts/dialogs.mjs`, `scripts/tab.mjs:23/33/63/240-247/258-259/266-280/284-287`, `scripts/chat.mjs:8-11/37-39/60-70/75-79/91-92/112-117`, `scripts/expand.mjs:18-30`, `templates/tab.hbs:18-61/79/95-102/123`, `templates/chat-card.hbs:11-50`, `docs/plan-1.0.md:14-52`, `docs/rules/magecraft.md`, gates under `docs/gates/`.
