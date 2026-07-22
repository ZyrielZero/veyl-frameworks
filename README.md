# Veyl Frameworks

Foundry VTT module providing character sheet support for the Magecraft and Arts frameworks of Veyl: a first-class sheet tab per framework held, an identity pill on the Features tab, and custom Item subtypes carrying framework data.

Built against Foundry VTT 13.351 and dnd5e 5.2.4 (2014 ruleset). Requires libWrapper.

## Current phase: 3 (Tab Interactivity)

Phase 1 (Scaffold) closed 2026-07-22 with v0.1.0; Phase 2 (Item Sheets) closed 2026-07-22 with v0.2.0 (gate evidence for both in docs/gates/). Phase 3 delivers four things, all display-only:

1. **Row expansion.** In Play mode, clicking an ability row's name toggles an inline derived summary (trigger, activation, duration and concentration, rendered rich text, evolutions with their thresholds, deepenings with their levels, amplify for Surge/Apex). Edit mode keeps opening the sheet; the context menu works in both modes.
2. **Empowerment ladder.** The expanded row shows the cost ladder from base to the actor's unlocked step only: MP costs for Augments/Channels, techniques spent for Boosts/Strikes, with the tier thresholds (steps 3/6/9) marked and each threshold labeled with the evolution it unlocks. Echo reservation, Stance hold, Surge amplify, and Apex minimum stay on their own fixed displays.
3. **Chat cards.** A per-row control posts a formatted read-only card (image, name, framework, discipline, cost or step, activation, trigger, duration, rich text). Per the resolution field below, the card carries an Attack roll button (1d20 + prof + ability mod) or a derived Save DC line, or neither.
4. **Resolution schema addition** (post-schema-day change, walked against both rules documents: no conflict). The ability model gains `resolution` (none / attack / save) and `saveAbility` (used when resolution is save); the ability sheet gains the matching selects.

Out of scope: any live resource state (current MP, ready/spent techniques, Echo/Stance holds, Strain locks, Burnout/Winded), which is the engine effort; Arts parity testing (Phase 4).

## Phase 3 exit test (run in Veyl)

1. Update the module in the Veyl world: console clean at init, and existing ability items load with `resolution` defaulting to none, no validation errors.
2. Ability sheet: Edit mode shows the Resolution select; choosing Save reveals the save-ability select; both persist across close and reopen; Play mode renders them read-only.
3. On the tab in Play mode, clicking a row's name toggles the inline summary open and closed without opening a sheet; in Edit mode the same click opens the sheet; the context menu works in both modes.
4. Expanded summary shows the right content per group for one ability of each of the four groups in each framework, with rich text rendered (no raw HTML).
5. Empowerment ladder: verify the numbers against the rules tables at actor levels 1, 9, and 17: correct costs (MP or techniques), ladder capped at the unlocked step, thresholds marked with their evolutions.
6. Fixed costs track the actor's level band: Echo reservation and Stance hold change with level; Surge shows 15 with amplify increments; Apex shows All with its minimum.
7. Chat cards post correctly for both frameworks: full descriptive content; an Attack button whose roll matches the stat card's bonus when resolution is attack; a Save DC line matching the stat card's DC and naming the save ability when resolution is save; neither when none.
8. Search: typing filters rows by name across sections and clearing restores them; the search bar has no dead controls (filter/sort either function or are not rendered).
9. Statelessness: after exercising every feature above, no new values appear in actor or item flags/system; expansion state does not survive a reload; all numbers recompute from level and ability at render.
10. Regression: the Phase 2 exit test still passes end to end, native dnd5e items are unaffected, and the console stays clean throughout.

The Phase 1 and Phase 2 exit tests live in docs/gates/ alongside their gate evidence.

## Deploying to The Forge

The Forge snapshots module files at install time. Pushing to GitHub does **not** update installed worlds. To deploy: tag a release with a `veyl-frameworks.zip` artifact, then reinstall from the manifest URL. The manifest and download URLs in `module.json` point at tagged release artifacts from day one (lesson carried from Feature Organizer).

Test in **Veyl** first. Nothing touches **Taoteti** without explicit go-ahead.

The Phase 1 and Phase 2 exit tests live in docs/gates/ alongside their gate evidence.

## Repo layout

```
veyl-frameworks/
  module.json          documentTypes, esmodules, styles, relationships
  scripts/
    main.mjs           init: DataModels, item sheets, TABS/PARTS, libWrapper wrap, hooks
    models.mjs         DataModels for framework + ability subtypes (finalized on schema day)
    item-sheets.mjs    dedicated item sheets subclassing dnd5e's ItemSheet5e
    tab.mjs            part context preparation
    pill.mjs           pill injection + per-actor tab visibility
  templates/
    tab.hbs            one parameterized tab (split only if the layouts diverge)
    framework-sheet.hbs  identity item sheet body
    ability-sheet.hbs    ability item sheet body (all eight disciplines)
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
