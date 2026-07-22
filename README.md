# Veyl Frameworks

Foundry VTT module providing character sheet support for the Magecraft and Arts frameworks of Veyl: a first-class sheet tab per framework held, an identity pill on the Features tab, and custom Item subtypes carrying framework data.

Built against Foundry VTT 13.351 and dnd5e 5.2.4 (2014 ruleset). Requires libWrapper.

## Current phase: 1 (Scaffold)

The scaffold is the container the later phases plug into. In scope now: subtype registration, tab and part registration, tab card with derived stats, pill injection, per-actor visibility. Out of scope until later phases: item sheets (Phase 2), tab content interactivity and search (Phase 3), Arts parity testing (Phase 4), the spend/Burnout engine (its own effort).

## Deploying to The Forge

The Forge snapshots module files at install time. Pushing to GitHub does **not** update installed worlds. To deploy: tag a release with a `veyl-frameworks.zip` artifact, then reinstall from the manifest URL. The manifest and download URLs in `module.json` point at tagged release artifacts from day one (lesson carried from Feature Organizer).

Test in **Veyl** first. Nothing touches **Taoteti** without explicit go-ahead.

## Phase 1 exit test (run in Veyl)

1. Install and enable the module (with libWrapper) in the Veyl world.
2. Open a test character's sheet: no framework tabs, no pill (actor holds nothing).
3. Create a new Item, type **Framework Identity**, framework `magecraft`, craft name `Severance`, ability `int`. Drag it onto the actor.
4. Re-open the sheet: the Magecraft tab appears with the stat card (verify MP max, DC, and attack against the formulas by hand), and the Features tab shows the "Magecraft, Severance" pill with the ability abbreviation.
5. Click the pill: the identity item's sheet opens (default sheet until Phase 2; rough appearance is expected).
6. Create a **Framework Ability** item (framework `magecraft`, discipline `channel`) and add it to the actor: it appears in the Channels section of the tab.
7. Confirm both custom-subtype items can be created via the sidebar, via compendium, and via drag onto the actor (early verification of the data architecture's core assumption).
8. Delete the identity item: tab and pill both vanish. If the tab was open at deletion, the sheet falls back to Details.
9. Repeat 3-8 with an `arts` identity to confirm the parameterized template serves both.

## Repo layout

```
veyl-frameworks/
  module.json          documentTypes, esmodules, styles, relationships
  scripts/
    main.mjs           init: TABS/PARTS registration, libWrapper wrap, hooks
    models.mjs         DataModels for framework + ability subtypes (drafts until schema day)
    tab.mjs            part context preparation
    pill.mjs           pill injection + per-actor tab visibility
  templates/
    tab.hbs            one parameterized tab (split only if the layouts diverge)
  styles/
    veyl-frameworks.css
  lang/
    en.json
```
