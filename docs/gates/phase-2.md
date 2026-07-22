# Phase 2 gate evidence

Exit test run live in the Veyl world on The Forge, driven via browser automation with DOM measurement, `item.system` inspection, and dispatched-event verification for every claim. Two runs: the full ten steps against 0.2.0-rc.1 (which surfaced one failure), then a re-verification of the failing step and the resulting fixes against the installed 0.2.0-rc.2.

## Environment

| Component | Version |
| --- | --- |
| Date of runs | 2026-07-22 (both) |
| Foundry VTT | 13.351 |
| dnd5e | 5.2.4 |
| libWrapper | 1.13.4.0 |
| Feature Organizer | 1.0.0 installed manifest (source audit was against repo v1.0.21) |
| veyl-frameworks | 0.2.0-rc.1, then 0.2.0-rc.2 (tag `v0.2.0-rc.2`, commit `63d231e`) |
| World | veyl (test world) |

Fresh page loads with the module active produced zero console errors on both builds.

## Results per exit-test step

| Step | Description | Result |
| --- | --- | --- |
| 1 | Clean console at init; veyl sheets are per-type defaults | PASS |
| 2 | Both types from sidebar; sheets open with native chrome, no hasEffects | PASS |
| 3 | Play mode disables every field; Edit mode enables them | PASS |
| 4 | Framework switch reveals Rally, carries ability by position; identity fields persist | PASS |
| 5 | Eight disciplines show exactly their group's sections; discipline carries by position | PASS |
| 6 | Prose-mirror saves land in baseEffect and signature | PASS |
| 7 | Evolutions and deepenings arrays: fill, persist, middle-delete | PASS |
| 8 | Ability row click and Features pill both open the new sheets | FAIL on rc.1 (row half), PASS on rc.2 |
| 9 | Feature Organizer: categories, framework-drop rejection, clean actor triage | PASS |
| 10 | Native items open dnd5e sheets; Phase 1 exit test end to end | PASS |

## Evidence detail

- **Step 1**: `CONFIG.Item.sheetClasses` lists exactly one sheet per subtype (`veyl-frameworks.VeylFrameworkSheet`, `veyl-frameworks.VeylAbilitySheet`), both default; dnd5e's sheet is absent from our types.
- **Step 2**: both subtypes present in the sidebar create dialog. Sheets opened with the dnd5e2 window classes, header image, name input, mode slider, and zero create-child buttons (DOM query, not eyeball).
- **Step 3**: play mode measured `disabled: true` on every input, select, and prose-mirror; edit mode re-enabled all of them. Verified in both directions.
- **Step 4**: with ability at wis (index 1 of int/wis/cha), switching magecraft to arts produced dex (index 1 of str/dex/con) in `item.system.ability` and revealed the Rally fieldset. Craft name, sentence, rallyBenefit (brace), and rallyDescription survived close and reopen, both in `item.system` and in the re-rendered inputs.
- **Step 5**: swept all eight disciplines capturing fieldset legends per render. Echo/Stance: Identity, Signature, Deepenings. Augment/Boost: Identity, Base Effect (with Trigger and Per Step), Threshold Evolutions. Channel/Strike: the same plus Activation, with Trigger rendered only when activation is reaction (verified on both channel and strike, both directions). Surge/Apex: Identity, Base Effect, Deepenings, Amplify, no Per Step. A framework switch carried augment (index 1) to boost (index 1).
- **Step 6**: typed into both editors via the real toolbar flow; `system.baseEffect` and `system.signature` each received exactly the typed paragraph.
- **Step 7**: three evolutions with thresholds 1/2/3 and three deepenings with levels 10/15/20 persisted across close and reopen; deleting the middle row of each left rows one and three with their data intact.
- **Step 8 (rc.1)**: the Features pill opened `VeylFrameworkSheet` (Phase 1's accepted deviation gone), but a row click did nothing. Diagnosis by introspection: `dnd5e-inventory` binds click listeners only to `.item-action[data-action]` and `[data-context-menu]` elements, and the template supplied the classes without the attributes. The fix was live-prototyped via the Handlebars partial override and confirmed before release.
- **Step 8 (rc.2, installed build)**: from zero open sheets, a real mouse click on the ability row opened `VeylAbilitySheet`; the ellipsis button opened dnd5e's native context menu (View Item, Edit, Duplicate, Delete, Display in Chat, Favorite) whose Edit entry opens our sheets; the pill opened `VeylFrameworkSheet`. Zero console errors.
- **Step 9**: with Feature Organizer enabled, the Features tab rendered, "Test Category" created and deleted through FO's own dialog on the framework actor and on a clean actor. A dispatched drop of a framework item onto the custom category was rejected (no flag written, no row rendered, no error) while a control feat dropped the same way was accepted (flag written, row rendered), making the rejection dispositive. FO decorates all feature rows with `fo-sortable-item` including ours but writes nothing to framework items. Recorded as verified compatible in README.
- **Step 10**: feat, weapon, and spell all rendered `ItemSheet5e`. Phase 1 loop re-run: clean actor showed no framework tabs (measured `display: none`) and no pill; a magecraft grant produced the tab, the Severance card (INT, Attack +1, Save DC 9, Mana 6/6, matching the hand-computed formulas for level 0, prof 1, int 10), the "Magecraft Severance INT" pill, and the ability in the Channels section; deleting the identity with the tab open hid the tab, removed the pill, and fell back to Details. Compendium round trip passed (import into a world pack, create inside the pack, drop back onto the actor). An illegal arts + int identity was rejected by `validateJoint` and never created; its two validation-error console lines are the only errors of the entire run and are the guard working as designed.
- **Bonus (rc.2)**: the open prose-mirror editor fix measured 150px on the element with a 100px visible content area and the saved text legible while editing (rc.1 rendered the content area at 0px; typing worked blind but saves landed).

## Deviations and notes

1. Step 8's row half failed on rc.1 and was fixed in rc.2 (`data-action="edit"` and `data-context-menu` on the row elements); the re-run on the installed rc.2 is the passing evidence. No accepted deviations remain from this phase.
2. Synthetic drop tests silently duplicate embedded items via dnd5e's drop handler (dropEffect quirk, documented in foundry-ui-findings.md); duplicates were cleaned up and are a test-harness artifact, not a module bug.
3. Framework items appear under "Other Features" on dnd5e's Features tab (native uncategorized bucket). Cosmetic, not part of this gate; revisit if it bothers play.

## Verdict

Pass. Phase 2 gate closed; rc.2 promoted to v0.2.0.
