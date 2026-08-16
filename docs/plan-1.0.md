# Plan: v0.4.0-rc.2 → 1.0.0

Written 2026-08-16. This is the consolidated execution plan for finishing the
module. It supersedes the phase-by-phase pacing of `roadmap.md` — the phase
*seams* (which risk ships when, and what gets tested before what builds on it)
are kept, because they exist for correctness, not caution; the *iteration
overhead* (one small phase per release cycle) is dropped. Five roadmap phases
collapse into four milestones plus a close-out.

`roadmap.md` remains the reference for the researched findings (chat-card
wiring, Attunement landmines, rest hooks); this document is the schedule and
the contract.

## Definition of done for 1.0.0

A user can install the module from the manifest URL and, with no knowledge of
this repo, run both frameworks at the table end to end:

1. Create identities and abilities through dedicated sheets; everything from
   Phases 1–4 (tabs, ladder, pills, search, chat cards) works as gated.
2. Spend and recover resources live: MP pool, Echo reserve/Collapse, ready/spent
   techniques, Stance assume/Release, Rally, the 1-minute breather.
3. Attunement raises the framework ability while the signature is up, with the
   documented carve-outs (MP max off the base score; Con adept HP unchanged).
4. Use abilities from chat cards that actually pay their costs, with the
   empowerment picker, threshold evolutions surfaced, Surge/Apex flows with HP
   payment, and Strain / Burnout / Winded enforced.
5. Long and short rests restore per the rules, including the once-per-long-rest
   short-rest recovery and Strain clearing.
6. Compendium content (the six example characters' item sets), user-facing
   documentation, LICENSE, and an automated release pipeline.
7. The cumulative regression suite (all gate tests, Phases 1–8 equivalents)
   passes on the installed 1.0.0 artifact in Veyl. Only then does the Taoteti
   deployment conversation happen.

## Milestone map

| Milestone | Version | Absorbs roadmap phases | Risk carried |
| --- | --- | --- | --- |
| M0: Close-out + infrastructure | v0.4.0 | Phase 4 tail | none |
| M1: State engine + basic rests | v0.5.0 | Phase 5, most of Phase 8 | state correctness, migration |
| M2: Attunement | v0.6.0 | Phase 6 | actor-wide score modification |
| M3: Use-time integration | v0.7.0 | Phase 7 + Strain-clearing rest tail | workflow correctness, timed conditions |
| M4: Release | v1.0.0 | Phase 9 | packaging only |

M2's spike runs in parallel with M1's build (see M2). Everything else is
sequential because each milestone consumes the previous one's state.

The Forge constraint stands: every milestone gate runs against a tagged rc
artifact reinstalled from the manifest, never a pushed branch. That is the one
piece of iteration overhead that cannot be dropped — it is how the deploy
target works.

---

## M0 — Close out Phase 4, pay the infrastructure debt (v0.4.0)

Small, immediate, unblocks everything.

1. Reinstall `v0.4.0-rc.2` in Veyl; re-confirm exit step 4's ladder legend
   alignment on the installed build (measured: three rows aligned, legend
   height matching the cells). Append confirmation to `docs/gates/phase-4.md`,
   tag `v0.4.0`.
2. **Release workflow.** GitHub Action on tag push: build `veyl-frameworks.zip`
   (module files only, no docs/.git), rewrite `module.json`'s `version` and
   `download` from the tag, attach both to the release. Removes the per-release
   manual bump that `module.json` currently requires.
3. **LICENSE** (owner's choice of license — decide at M0).
4. Sweep the two open cosmetic findings: remove the dead
   `getCharacterSheetClass` fallback (or wire it into `libWrapper.register`),
   and set `--underlay` on injected pills.

Exit: v0.4.0 tagged by the workflow, installed in Veyl from the manifest, Phase
4 gate closed.

## M1 — State engine + basic rest recovery (v0.5.0)

The first phase that writes actor state. Absorbs roadmap Phase 5 in full, plus
the MP half of Phase 8 (rests), because the rest handlers are consumers of the
exact state this milestone creates and testing them together closes the loop
spend → rest → restored in one gate.

**Schema (identity item `system`, per roadmap storage design — state lives on
the identity item so deleting it takes the state with it):**

- `currentMP` (number, magecraft) — clamped 0..max at prepare time, never
  stored above max so level-down cannot strand it.
- `echoActive` (boolean). Reserved amount is *derived* from level at render
  (`echoReserve(level)` already exists in `tab.mjs`), never stored.
- `stanceActive` (boolean) + `heldTechniqueIds` (array of item ids). Hold
  *count* derives from `stanceHold(level)`; only the identities persist.
- `spentTechniqueIds` (array of item ids, arts).
- `shortRestUsed` (boolean) — the once-per-long-rest flag, lives here so it
  clears with the identity.

Migration bar: pre-existing identity items must load with sane defaults
(`currentMP` initializes to computed max on first prepare, booleans false,
arrays empty) and a byte-level `_source` diff must show *only* the new fields.

**Behavior:**

- Magecraft: spend (floor = reserved amount while Echo up), restore, clamp;
  Echo activate reserves the band amount, Collapse returns it immediately,
  reserved MP untouchable by spending or recovery.
- Arts: technique ready/spent toggles; Stance assume (choose and hold the band
  count — needs a picker when techniques ready > hold), Release readies held
  techniques immediately; Rally recovers proficiency-bonus techniques and
  applies the chosen benefit's derived numbers (display + chat note only —
  applying temp HP is fine, it's a native actor update); 1-minute breather
  readies all spent techniques.
- Rests (dnd5e hooks `dnd5e.restCompleted`, no libWrapper needed): long rest →
  MP to max, `shortRestUsed` cleared; short rest → one-third of max MP once per
  long rest via the flag; reserved MP untouched by both; breather-vs-short-rest
  no-double-dip confirmed for techniques.
- UI: the stat card goes live (current/max MP, ready hand), spend/restore
  controls on the card, Echo/Stance toggle on the signature row, Rally button.
  Every *derived* number still recomputes at render — the gate check is the
  inverse of Phase 3's: persisted state persists, derived state still derives,
  nothing else appears in `_source`.

**Exit test (abridged; full test written before implementation, per house
rule):** spend/restore/clamp cycles at two levels; Echo reserve arithmetic at
band boundaries; Stance hold/Release with the picker; Rally count and benefit
numbers at two proficiency tiers; breather; the full rest sequence — spend,
short rest (verify one-third), second short rest (verify nothing), long rest
(verify full + flag cleared + reserve untouched); migration `_source` diff;
Phase 4 regression leg.

## M2 — Attunement as an Active Effect (v0.6.0)

Deliberately its own milestone: it modifies the actor's real ability score,
which touches every roll, DC, skill, and third-party module. **The spike runs
during M1's build** — it needs only Foundry + dnd5e, not M1's state — so the
approach decision is already made when M1 ships.

**Spike questions (from roadmap, decided before implementation):**

1. Score-modifying AE (`system.abilities.X.value`, mode ADD, floor(level/2))
   vs. derived-only Attunement that never touches the score and instead feeds
   our formulas plus targeted bonus paths.
2. **The Con adept HP carve-out is the decider.** The rules forbid Attunement
   changing HP max; a naive ADD on Con hands a level-20 adept ~+50 phantom HP.
   If no clean countervailing path exists, the derived-only approach wins even
   though it forfeits native skill/save integration for the score.
3. ASI double-apply (upstream #2470 class of bug): level up with the signature
   active, verify the base score moves by exactly the ASI.
4. Manual score editing while the effect is live — document the behavior
   deliberately (likely "drop the signature to edit").

**Implementation (whichever approach wins):** effect keyed to M1's
`echoActive`/`stanceActive` booleans — activate on signature up, remove on
signature down or identity deletion. MP max formula audited to read the
*pre-effect* base score (`_source` path); Ready Hand is count-based and safe,
but audit every formula in `tab.mjs` regardless. Stat cards and chat cards
become signature-aware, resolving Phase 3's flagged limitation — the gate pins
expected numbers in *both* signature states.

**Exit test:** attack/DC/checks/saves with signature up and down at two levels;
MP max unchanged by Echo activation; Con adept HP max unchanged; ASI
interaction; identity deletion removes the effect; third-party smoke check
(sheet renders, a native roll works, with Plutonium active); M1 regression leg.

## M3 — Use-time integration (v0.7.0)

The largest milestone. Absorbs roadmap Phase 7 entirely plus the Strain tail of
Phase 8. Internal seam kept from the roadmap: **cards-that-spend is
sheet-and-chat work, penalty states are combat-tracker work** — build and test
in that order, and if the milestone bloats, that seam is where it splits into
two rc tags.

**Part A — cards that spend:**

- Chat card buttons pay real costs through M1's state: MP per `MP_COSTS` for
  magecraft, techniques equal to the step for arts. Insufficient funds →
  button disabled with the reason, never a failed half-spend.
- Empowerment picker at activation: choose a step ≤ unlocked cap (already
  derived) and ≤ what the pool/hand can pay; pay it; surface the evolution
  text on the card when the use crosses a 3/6/9 threshold.
- Surge/Apex flow: Surge minimum 15 MP + amplify increments, HP payable at
  2 HP per missing MP; Apex spends all ready techniques (minimum 3), missing
  techniques payable at 10 HP each, 30 HP per amplification. Collapse/Release
  offered inline where relevant (the documented nova turn).
- Roll wiring stays on the Phase 3 architecture: our `data-action` names, our
  `flags.veyl-frameworks`, rolls through `CONFIG.Dice.D20Roll.build` —
  verified live in the Phase 4 gate, do not re-derive.

**Part B — penalty states:**

- **Strain:** using a Boost/Strike/Augment/Channel of comparable level 6+
  locks that comparable level until long rest. Storage: lock set on the
  identity item (M1 pattern); enforcement in the Part A spend flow; cleared by
  the long-rest handler (this is the Phase 8 tail — the M1 rest handler grows
  one line here). Stance and Echo unaffected; Surge/Apex exempt.
- **Burnout** (5 rounds per 15 MP of total Surge cost, counting collapsed
  points and HP-paid points once each) and **Winded** (5 rounds + 5 per
  amplification): round-limited Active Effects tied to the combat tracker for
  bookkeeping and visibility, with a world-time fallback out of combat (pick at
  build time, per roadmap). Enforcement is ours in the use-time flow: no
  activations, signature forced down and not reassumable, no recovery (Rally,
  breather, and rests all check it — Winded blocks technique readying "by any
  means", so the M1 recovery paths gain a guard).

**Exit test:** full spend cycles both frameworks at two levels; empowerment
caps (unlock gate and affordability gate independently); threshold evolution
text appears at exactly 3/6/9; Surge and Apex arithmetic including HP payment
and the Collapse-into-Surge total counting collapsed points once; Strain locks
per level 6–9, shared across the discipline pair, surviving short rest and
clearing on long; Burnout/Winded durations in and out of combat, with every
recovery path verified blocked; M1+M2 regression legs.

## M4 — Release (v1.0.0)

- **Compendium packs:** the six example characters (Nerine through Sera) as
  item sets at minimum, prebuilt actors if actor-pack testing is clean. Built
  in-world, exported to packs, verified importable into a fresh world.
- **User documentation:** an in-repo user guide (install, creating an identity,
  creating abilities per discipline, playing a session: spend/recover/rest,
  the penalty states, known third-party collisions and the Attunement editing
  caveat from M2). README trimmed to point at it.
- Known-issues list reverified (Plutonium re-exercised once, since the Phase 4
  run did not).
- **Full regression:** the cumulative suite — every milestone's exit test —
  run once against the installed `v1.0.0-rc.1` artifact in Veyl. Gate evidence
  in `docs/gates/release-1.0.md`.
- Tag `v1.0.0` (workflow builds the artifact). Only after the gate closes:
  the Taoteti deployment conversation, which remains an explicit go-ahead.

---

## Punted, on purpose (recorded so 1.0 scope stays honest)

- **Contested-check resolution** (opposed Athletics vs. Meteor Throw's save):
  schema stays none/attack/save; contested checks resolve manually. Documented
  in the user guide. (Roadmap Phase 3 flag 2.)
- **CSL 6+ step marking on the ladder** beyond the Strain enforcement itself —
  cosmetic ladder badges ship only if free during M3.
- Anything Taoteti-specific.

## Risk register

| Risk | Milestone | Mitigation |
| --- | --- | --- |
| Con adept HP carve-out has no clean AE path | M2 | Spike during M1; derived-only fallback approach is pre-approved |
| State migration corrupts existing items | M1 | `_source` byte-diff gate; migration tested on the standing Veyl fixtures before rc |
| Burnout/Winded out-of-combat duration ambiguity | M3 | Decide world-time vs. manual at build, document in user guide |
| dnd5e 5.3 usage-message migration (upstream #5152) breaks cards | M3 | Already insulated: own flags namespace, own action names; verify once on 5.3 when it lands |
| Milestone 3 bloat | M3 | Pre-planned split seam between Part A and Part B |
| Local dev dnd5e (5.0.4) vs. world (5.2.4) drift | all | Verify version-sensitive behavior against the world; update local install at M0 |

## House rules that survive the pacing change

- Exit test is written **before** implementation, per milestone.
- Every gate runs against a tagged rc artifact reinstalled from the manifest.
- Gate evidence lands in `docs/gates/` (one file per milestone).
- Schema changes get walked against both rules documents and called out.
- New third-party collisions go in the README known-issues list as found.
- Veyl only; Taoteti needs explicit go-ahead, which M4 does not include.
