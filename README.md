# Veyl Frameworks

Foundry VTT module providing character sheet support for the Magecraft and Arts frameworks of Veyl: a first-class sheet tab per framework held, an identity pill on the Features tab, and custom Item subtypes carrying framework data.

Built against Foundry VTT 13.351 and dnd5e 5.2.4 (2014 ruleset). Requires libWrapper.

## Current phase: 4 (Arts Parity and Display Polish)

Phases 1 through 3 closed 2026-07-22 with v0.1.0, v0.2.0, and v0.3.0 (gate evidence for all three in docs/gates/). Phase 4 is a consolidation phase: it sweeps the Phase 3 features against the Arts side specifically and clears the cosmetic residue, all still display-only. It adds no schema fields.

1. **Honest ready hand.** The Arts stat card no longer subtracts the Stance hold from the techniques known. The hold applies only while the Stance is actually assumed, which is live state, so the stateless baseline is nothing spent and no Stance up: every technique known is ready. The card now reads known/known exactly as the Magecraft pool reads max/max, and the hold is surfaced where it belongs, on the Stance row's own summary.
2. **Rally display.** The Arts identity's Rally (its counterpart to Magecraft's rest recovery) renders on the stat card: the chosen benefit, the derived recovery count (proficiency bonus), the derived effect per benefit (Brace temporary hit points, Reposition distance, Read the Field advantage), and the player's Rally description.
3. **Comparable spell level on the ladder.** Each empowerment step now shows the benchmark both rules documents price against, discipline-aware: Channels and Strikes 1st through 9th, Augments and Boosts one level lower (Cantrip through 8th).
4. **Features tab cleanup.** Framework and ability items no longer appear in dnd5e's uncategorized "Other Features" bucket (Phase 2 gate note 3). Ability items whose framework identity is not held stay visible, so an orphan is never reachable from nowhere. The identity pill gains a right-click context menu (Edit, Delete), which keeps the identity reachable now that its Features row is hidden.

Out of scope: any live resource state (current MP, ready/spent techniques, Echo/Stance holds, Strain locks, Burnout/Winded), which is Phase 5 onward; marking CSL 6+ steps for Strain, which is Phase 7 enforcement.

## Phase 4 exit test (run in Veyl)

1. Update the module in the Veyl world: console clean at init. No schema changed this phase, so a pre-existing ability item's `_source` must be byte-identical before and after the update.
2. Arts stat card reads N/N techniques, where N is Boosts plus Strikes known, at levels 1, 9, and 17, and does not change when the level band changes the Stance hold. Cross-check on an actor holding a Stance: the card is unaffected while the Stance row's summary still shows the correct hold for the band.
3. Rally block renders the chosen benefit, the recovery count equal to proficiency bonus, and the right derived number per benefit (Brace = prof + Arts mod temporary hit points; Reposition = half walk speed with units; Read the Field = no number). Verify at two levels so the proficiency-derived numbers move. A blank Rally benefit renders the recovery line alone, with no empty benefit.
4. Ladder shows the comparable spell level per step in both frameworks, matching the rules tables exactly: Channels and Strikes 1st through 9th, Augments and Boosts Cantrip through 8th. Check at level 17 so all nine steps are visible, and confirm the three-row cells stay legible (measured, not eyeballed).
5. Framework and ability items no longer appear under Other Features on an actor holding both frameworks; the section itself disappears when they were its only occupants; native feats are untouched and still render there.
6. An ability item whose framework identity is not held still appears in Other Features, and stops appearing once the identity is granted.
7. Pill right-click opens a context menu: Edit opens the identity sheet; Delete removes the identity, hides the tab, falls back to Details, and removes the pill, with no console error.
8. Statelessness: after exercising every feature above, an actor and item `_source` snapshot is byte-identical to one taken before, and no flags are written.
9. Regression: the Phase 3 exit test still passes end to end, including its Phase 2 regression leg, and the console stays clean throughout.

The Phase 1 through 3 exit tests live in docs/gates/ alongside their gate evidence.

## Deploying to The Forge

The Forge snapshots module files at install time. Pushing to GitHub does **not** update installed worlds. To deploy: tag a release with a `veyl-frameworks.zip` artifact, then reinstall from the manifest URL. The manifest and download URLs in `module.json` point at tagged release artifacts from day one (lesson carried from Feature Organizer).

Test in **Veyl** first. Nothing touches **Taoteti** without explicit go-ahead.

## Repo layout

```
veyl-frameworks/
  module.json          documentTypes, esmodules, styles, relationships
  scripts/
    main.mjs           init: DataModels, item sheets, TABS/PARTS, libWrapper wrap, hooks
    models.mjs         DataModels for framework + ability subtypes (finalized on schema day)
    item-sheets.mjs    dedicated item sheets subclassing dnd5e's ItemSheet5e
    tab.mjs            part context preparation (all derived values)
    expand.mjs         delegated tab interactions: row expansion, post control
    chat.mjs           ability chat cards and the attack roll button
    pill.mjs           pill injection + context menu, Features hiding, tab visibility
  templates/
    tab.hbs            one parameterized tab (split only if the layouts diverge)
    framework-sheet.hbs  identity item sheet body
    ability-sheet.hbs    ability item sheet body (all eight disciplines)
    chat-card.hbs        read-only ability chat card
  styles/
    veyl-frameworks.css
  lang/
    en.json
  docs/
    rules/             the Magecraft and Arts rules documents (schema day reference)
    gates/             per-phase gate evidence
```

## Known issues

- **Opening a framework item throws (`hasEffects` TypeError): resolved in Phase 2, verified live 2026-07-22.** dnd5e's default `ItemSheet5e` read system metadata our subtypes lack; Phase 2 registers dedicated per-type sheets and unregisters dnd5e's from our types. The rc.1 run also found the tab's ability rows were inert (dnd5e-inventory only binds clicks to `.item-action[data-action]`, which the rows lacked); rc.2 adds the `data-action="edit"` and `data-context-menu` attributes.
- **Third-party modules that iterate `actor.items` can choke on framework items.** Confirmed: Plutonium class import fails on an actor already holding framework items (its importer reads dnd5e system fields on every embedded item) and succeeds on a clean actor. Workaround: run such imports before granting the framework. This is an accepted cost of the custom-subtype architecture; new collisions get added here as found.
- **Feature Organizer: verified compatible live 2026-07-22.** Source review of v1.0.21 found every `actor.items` iteration guarded by `item.type === "feat"` checks, and its drop handlers reject non-feat items, so framework items are invisible to it by construction. Exit test step 9 confirmed it live: categories create and delete on actors with and without framework items, a framework item dropped on a custom category is rejected (control feat accepted), and no console errors. Its sheet integration tags framework rows with `fo-sortable-item` but writes no flags to them; harmless.
