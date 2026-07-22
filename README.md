# Veyl Frameworks

Foundry VTT module providing character sheet support for the Magecraft and Arts frameworks of Veyl: a first-class sheet tab per framework held, an identity pill on the Features tab, and custom Item subtypes carrying framework data.

Built against Foundry VTT 13.351 and dnd5e 5.2.4 (2014 ruleset). Requires libWrapper.

## Current phase: 2 closed, 3 (Tab Interactivity) next

Phase 1 (Scaffold) closed 2026-07-22 with v0.1.0. Phase 2 (Item Sheets) closed 2026-07-22 with v0.2.0: schema day finalized against docs/rules/, dedicated item sheets for both subtypes (removing the hasEffects TypeError), row and context-menu wiring on the framework tabs, and Feature Organizer verified compatible live. Gate evidence for both phases lives in docs/gates/. Phase 3 (tab content interactivity and search) is next; its scope and exit test are not yet defined. Later: Arts parity testing (Phase 4), the spend/Burnout engine (its own effort).

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
