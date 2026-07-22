# Veyl Frameworks: Roadmap and Forward Findings

Working plan for everything past Phase 3, plus researched technical findings for the phases that need them. Companion to `foundry-ui-findings.md`: that doc records what was learned by pain, this one records what was learned in advance so the pain can be smaller. Verify each finding live before building on it; sources are noted where a claim came from research rather than our own introspection.

The phase discipline stays as established: each phase carries one kind of risk, ships behind a written exit test, and closes with gate evidence in `docs/gates/`. Nothing touches Taoteti without explicit go-ahead.

---

## Phase 3 (in flight): two flags before the gate runs

1. **Chat card rolls are Attunement-blind by construction.** The card's attack bonus and Save DC are prof + base ability mod. With the Echo or Stance up (most of actual play), the real numbers are higher, and "is the signature active" is exactly the live state Phase 3 excludes. Accepted limitation, but the exit test should state which number is expected so step 7's "matches the stat card" stays unambiguous when Phase 6 makes the stat card Attunement-aware.
2. **Resolution none/attack/save misses contested checks.** Meteor Throw's Strength save fits the schema; an opposed Athletics check does not. Punt, but record it here so it does not surprise us at a future schema day.

---

## The phases

### Phase 4: Arts parity and display polish

Scope: sweep every Phase 3 feature against the Arts side specifically (ladder in techniques, Rally display, hold vs. reservation, Apex "All / minimum 3" vs. Surge "15 + amplify"), fix any asymmetry the ladder and cards revealed, and clean up the cosmetic residue: framework items appearing under "Other Features" on the native Features tab (Phase 2 note 3).

Risk carried: none new; this is a consolidation phase. Exit test is largely a re-parameterization of Phase 3's for the Arts plus the cosmetic fixes.

### Phase 5: Resource state

The first phase that writes actor state. Scope:

- Current MP (spend, restore, clamp to max) and the Echo lifecycle: activate reserving the level-band amount, Collapse returning it immediately, reserved points untouchable by spending or recovery.
- Ready/spent tracking per technique, the Stance lifecycle (assume holding the level-band count, Release readying them immediately), and the Rally action recovering proficiency-bonus techniques with its chosen benefit.
- The 1-minute out-of-combat breather readying all spent techniques.

Explicitly out: Attunement (Phase 6), spending from chat cards (Phase 7), Strain/Burnout/Winded (Phase 7), rests (Phase 8).

Design notes:

- Storage: `system` fields on the identity item (currentMP, echoActive, per-ability ready state), not actor flags. The identity item already owns the framework; deleting it should take the state with it, which item-scoped storage gives us for free.
- The stat card becomes live (current/max MP, ready hand count) but every *derived* number still recomputes at render. The gate for this phase is the inverse of Phase 3's step 9: persisted state persists correctly, derived state still derives, and nothing else appears.
- Reserved/held amounts are derived from level at render, never stored; only the boolean (Echo up, Stance up) and the identities of held techniques persist. This keeps level-up from stranding stale numbers.

Risk carried: state correctness and migration (existing ability items must load with the new fields defaulting sanely, same bar as Phase 3's schema addition).

### Phase 6: Attunement as an Active Effect

Deliberately its own phase. It modifies the actor's actual ability score, which touches every roll, DC, skill, and third-party module on the sheet. Spike it the way the UI was spiked; findings below are the starting hypotheses to verify, not conclusions.

Scope: while the Echo or Stance is active (Phase 5's boolean), an Active Effect on the actor adds floor(level/2) to the framework ability score. Deactivation or identity deletion removes it. Chat cards and stat cards now read the derived score, resolving Phase 3's flagged limitation.

Risk carried: everything. See the Attunement findings section.

### Phase 7: Use-time integration

Scope:

- Chat card buttons that actually spend: activation costs MP or spends techniques through Phase 5's state.
- An empowerment picker at activation: choose a step up to the unlocked cap and what the current pool/hand can pay, pay it, and surface the evolution text on the card when the use crosses a 3/6/9 threshold.
- Surge/Apex flow: minimum cost, amplify increments, HP payment at the documented rates (2 HP per MP up to the Surge minimum; 10 HP per missing technique to the Apex minimum, 30 HP per amplification).
- The penalty states: Strain locks per comparable level 6+ (until long rest), Burnout and Winded with round-tracked duration and their full lockouts (no activations, signature down and not reassumable, no recovery).

Risk carried: workflow correctness across two economies plus timed conditions. This is the largest phase; if it bloats, split the penalty states into their own phase between this and rests. The seam is clean: cards-that-spend is sheet-and-chat work, penalty states are combat-tracker work.

### Phase 8: Rest cycle

Scope: long rest restores MP to max and clears Strain locks; short rest restores one-third of max MP, once per long rest (tracked flag, cleared on long rest); technique recovery confirmed against the rest flow (the 1-minute breather from Phase 5 already covers it, but a short rest must not double-dip anything); reserved MP untouched by rests per the rules.

Risk carried: low, but the once-per-long-rest flag is easy to get subtly wrong. Exit test needs the full sequence: spend, short rest, verify third, second short rest, verify nothing, long rest, verify full and flag cleared.

### Phase 9: Release

Scope: compendium packs (the six example characters, Nerine through Sera, as prebuilt actors or at least item sets make the natural starter pack), user-facing documentation, version 1.0.0 tagged with the zip artifact, and only then the Taoteti deployment conversation.

---

## Findings: chat cards (Phase 3/7)

Researched 2026-07-22 against dnd5e 5.x source discussion and system wiki; verify by introspection on 5.2.4 before building.

**Copy the markup, own the handlers, borrow the roll machinery.** The same lesson as the search bar, inverted: the card chrome is class-scoped markup we can lift wholesale, but the interactivity layer is where dnd5e's assumptions live.

1. **Markup and CSS lift cleanly.** dnd5e chat cards are `.dnd5e2.chat-card` structures (header with image and name, description block, footer buttons), styled by class rather than by custom-element tag. Copying the native structure buys the styling, the collapse behavior, and theming for free.
2. **Native button wiring is off-limits.** dnd5e's card buttons resolve through `flags.dnd5e` (messageType "usage" plus item/activity identifiers) to handlers on the item's *Activity*, defined in `metadata.usage.actions`. Our subtypes have no `system.activities`; a native-wired button on a framework card is the `hasEffects` problem wearing a different hat. So: their button markup and classes, our own `data-action` names (never reusing theirs), our own flags under `flags.veyl-frameworks`, and our own listener bound via the chat-message render hook. Note dnd5e is actively migrating usage messages from flags to a custom message type (upstream issue #5152, slated 5.3.0); keeping our flags in our own namespace insulates us from that migration.
3. **Roll through the system's dice, not raw `Roll`.** The old `dnd5e.dice.d20Roll(options)` single-config API was replaced in the 4.x roll refactor. The current path is `CONFIG.Dice.D20Roll.build(rollConfig, dialogConfig, messageConfig)` (BasicRoll build pattern, verified in upstream source discussion of 4.x/5.x). Building through it gets the native advantage/disadvantage dialog, roll modes, and crit presentation, so the roll behaves like a dnd5e attack even though the button is ours. Introspect the exact config shapes on 5.2.4 before writing; the refactor is recent enough that examples online mix old and new signatures.

---

## Findings: Attunement via Active Effects (Phase 6)

Researched 2026-07-22 against the dnd5e Active Effect guide and upstream issues; every item below needs live verification.

The standard mechanism fits: an ActiveEffect with change `system.abilities.[abbr].value`, mode ADD, value floor(level/2). Core applies actor effects before `prepareDerivedData`, so the raised score flows into the modifier, and from there into our derived DC/attack at render. Four landmines:

1. **Max MP must ignore Attunement.** The rules price the pool off the *base* score, unmodified by the Echo's own effect. Once the AE exists, `actor.system.abilities.X.value` is the raised score; the MP formula must read the pre-effect source (`actor._source.system.abilities.X.value` or equivalent). Miss this and activating the Echo silently inflates the pool it is supposed to tax. Same for the Ready Hand: it derives from counts, not scores, so it is safe, but audit every formula in `tab.mjs` for which score it reads.
2. **The Constitution adept's HP carve-out.** The Arts rules state Attunement never changes hit point maximum. dnd5e derives HP max from Con, so a naive ADD on `system.abilities.con.value` hands a 20th-level Con adept roughly +50 phantom HP the rules explicitly forbid. Options to spike: a paired countervailing change on the HP bonus path, or computing Attunement's benefits (DC, checks, saves) without touching the score for Con specifically. This is the single hardest problem in the phase; it may decide the whole implementation approach (score-modifying AE vs. derived-only Attunement that never touches `system.abilities` and instead feeds our own formulas plus targeted bonus paths).
3. **Advancement interactions.** Upstream issue #2470 documented ASIs double-applying when an AE already modifies the score being raised. Reported fixed, but the class of bug (advancement writing back a derived value) is exactly what an always-on Attunement effect would expose constantly. Exit test must include: level up and take an ASI in the framework ability with the signature active, verify the base score moved by exactly the ASI.
4. **Sheet editing while the effect is live.** Community guidance notes that effects targeting `.value` make manual edits to that score revert or misbehave while active. Acceptable if documented (drop the signature to edit your score), but decide it on purpose and put it in the user docs.

Also inherited from Phase 3's flag: once Attunement is live, the chat card and stat card numbers change with signature state. The Phase 6 exit test should re-run Phase 3's step 7 in both states and pin both expected values.

---

## Findings: timed conditions and rests (Phases 7/8)

Researched 2026-07-22; thinner than the above, treat as direction rather than contract.

1. **Burnout/Winded as round-limited Active Effects.** Core AE durations support rounds/turns tied to the combat tracker, which matches "lasts N rounds" exactly and gets expiry display for free. Needs a fallback for out-of-combat use (Surging outside initiative is legal and the duration is still real time); a world-time duration or a manual clear both work, pick at spike time. Enforcement (blocking activations while the condition holds) is our own check in the use-time flow either way; the AE is bookkeeping and visibility, not enforcement.
2. **Rest integration has first-class hooks.** `dnd5e.restCompleted` (and its pre- counterpart) fire with the actor and a result object distinguishing long from short rest; no libWrapper needed for the basic flow. The once-per-long-rest short-rest recovery is our own flag on the identity item, set on short-rest recovery and cleared on long rest.
3. **Strain locks are long-rest-scoped state**, so they live with Phase 5's storage pattern (on the identity item) and clear in the Phase 8 rest handler. One lock per comparable level 6 through 9, shared across Augments and Channels (or Boosts and Strikes) per the rules.

---

## Standing reminders

- The Forge snapshots at install: every phase gate runs against a tagged rc artifact reinstalled from the manifest, never against a pushed branch.
- New third-party collisions go in the README known-issues list as found; Plutonium remains the known one.
- Schema changes after schema day get walked against both rules documents and called out in the phase description, as Phase 3's resolution field was.
