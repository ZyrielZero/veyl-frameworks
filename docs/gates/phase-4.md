# Phase 4 gate evidence: Arts Parity and Display Polish

Run 2026-07-25 against the installed release candidate, driven from the live world via Chrome.

## Environment

| Component | Version |
| --- | --- |
| Foundry VTT | 13.351 |
| dnd5e | 5.2.4 |
| libWrapper | 1.13.4.0 |
| veyl-frameworks | 0.4.0-rc.1 (tag `v0.4.0-rc.1`) |
| World | veyl (test world) |
| Feature Organizer | disabled throughout |
| Plutonium | active (see note 3) |

Test data: the standing clean actor "Veyl Exit Test" (0 items) received a "VeylTest Class" item for level control, both identities (MC Severance int / AR Ironbound str, Rally benefit Brace), one ability per discipline plus a second Boost, a second Strike as a Counter, and a native "Control Feat" as the untouched-native control. Four techniques known (2 Boosts, 2 Strikes) so the ready hand could be distinguished from every Stance hold value. Scores set to INT 16 and STR 14, walk speed 30, so every derived number was nonzero. Everything was deleted and the scores, speed, and chat log restored at the end; the world was left exactly as found.

## Results per exit-test step

| Step | Description | Result |
| --- | --- | --- |
| 1 | Console clean at init; pre-existing items load with no drift | PASS |
| 2 | Arts card reads N/N, unaffected by the Stance hold band | PASS |
| 3 | Rally block: benefit, recovery count, per-benefit derived number | PASS |
| 4 | Comparable spell level per step, both frameworks, measured legible | PASS (one CSS fix, see deviation 1) |
| 5 | Framework items gone from the native Features list | PASS |
| 6 | Orphan guard: unheld-identity abilities stay visible | PASS |
| 7 | Pill context menu: Edit opens, Delete removes and falls back | PASS |
| 8 | Statelessness: source byte-identical, no flags written | PASS |
| 9 | Phase 3 exit test end to end, including its Phase 2 leg | PASS |

## Evidence detail

- **Step 1**: 77 boot console messages, zero errors or exceptions. The pre-existing sidebar "Test Ability" and "Test Identity" loaded with zero validation failures, `_source.system` key sets exactly matching the Phase 3 field set (15 and 6 keys), no flags, and `_stats.modifiedTime` still 2026-07-22: the 0.4.0-rc.1 load wrote nothing to them. Phase 4 added no schema fields, so this is the "byte-identical" evidence.
- **Step 2**: the ready hand read `4/4` at levels 1, 9, and 17 with 4 techniques known, while the Stance hold moved 1 (L1), 1 (L9), 2 (L17) across the same renders. Under the old formula those levels would have shown 3, 3, and 2. The Stance row's own summary reported "Holds 1 technique while held" and "Holds 2 techniques while held" correctly at the matching levels, so the hold stayed visible where it is actually true. Magecraft's card read 13/13, 63/63, 113/113, matching the rules MP table at +3 for those levels.
- **Step 3**: at L17 (prof 6, STR mod +2) Brace read "recovers 6 techniques; 8 temporary hit points"; at L1 (prof 2) "recovers 2 techniques; 4 temporary hit points", so both derived numbers tracked proficiency. Reposition read "move 15 ft without provoking" against a 30 ft walk, Read the Field read "advantage on your next attack roll" with no number, and a blank benefit rendered the title as bare "Rally" with the recovery line alone and no empty benefit.
- **Step 4**: at L17 all four ladders matched their rules tables exactly. Arts spent 1 through 9 techniques with Strike CSL 1st-9th and Boost CSL Cantrip-8th; Magecraft cost 2,3,5,6,7,9,10,11,13 MP with Channel CSL 1st-9th and Augment CSL Cantrip-8th. Thresholds marked precisely steps 3, 6, and 9 in all four. Ladders capped at step 1 (L1) and step 5 (L9). Measured, not eyeballed: the ladder occupied 466px with `scrollWidth === clientWidth` (no overflow), all nine cells a uniform 34px, and no row's `scrollWidth` exceeded its `clientWidth` (nothing clipped, including the "Cant" label).
- **Step 5**: on the actor holding both frameworks, all 12 framework items were hidden on the Features page and their section collapsed. Adding a native "Control Feat" to the same section brought the section back with only the feat visible (12 ours hidden, 1 native shown), proving the collapse is scoped to sections we emptied ourselves and reverses correctly. Other feature sections were untouched. Note: in dnd5e 5.2.4 our items bucket into **"Passive Abilities"**, not the "Other Features" section named in the Phase 2 note; the residue is the same, the bucket name differs.
- **Step 6**: deleting the Arts identity made all six AR ability items (Stance, 2 Boosts, 2 Strikes, Apex) visible in Features while the five MC items stayed hidden. Re-creating the identity hid all six again. The guard behaves in both directions.
- **Step 7**: a trusted right-click on the Arts pill opened Foundry's native ContextMenu with exactly Edit and Delete, anchored at the pointer and targeting the correct pill (`.veyl-pill.context` resolved to "Arts Ironbound STR"). Edit opened `VeylFrameworkSheet` for AR Ironbound. Delete opened Foundry's native "Delete Item: AR Ironbound" confirmation; confirming removed the item, the Arts pill, and hid the Arts tab and part while Magecraft stayed visible, with no console error. The Details fallback was verified separately: the pill lives on the Features page, so deleting through it never leaves the framework tab active. With the Arts tab active and the identity deleted, `tabGroups.primary` moved from `arts` to `details` and the tab hid.
- **Step 8**: a snapshot of actor `_source` flags and system plus every item's `_source` flags and system, taken after fixture setup, was byte-identical (FNV-1a `26b9e27d`, 12633 chars) after exercising every feature above and reverting the two intentional edits (a resolution round trip and the Rally benefit cycle). No item carried a flag at any point. After a full reload the expansion Set was empty, every row rendered collapsed, and the hand and Rally values recomputed identically. The actor carries a pre-existing `feature-organizer` flag that was unchanged across the window and is not ours.
- **Step 9** (Phase 3 regression, all re-verified):
  - Play mode: a trusted click on a row name collapsed and then re-expanded the summary (expansion Set 1 to 0 to 1) with no application opened.
  - Edit mode: the same row swapped to dnd5e's `data-action="edit"` and dropped our toggle marker; a trusted click opened `VeylAbilitySheet` and left the expansion Set untouched.
  - Resolution selects: offered exactly none/attack/save; choosing save revealed the save-ability select; Play mode disabled all 11 body fields including resolution; reverting removed the select again.
  - Summary content correct for all eight disciplines: reserve rows led with the Signature plus their reservation or hold line and three level-keyed deepenings; enhance and active rows showed trigger or activation, base effect, a 9-step ladder and three evolutions; climax rows showed the amplify block, masteries, and their fixed line. The Echo signature's bold rendered as an element and its `[[/r 1d4]]` as a live inline roll. No summary contained escaped HTML. The Counter (reaction Strike) showed "Reaction" plus its trigger.
  - Chat cards: all six posted with image, name, framework and discipline, cost, activation, trigger, duration, and rendered rich text, carrying only `veyl-frameworks` and `core` flags. MC Channel showed "Attack +9" and AR Strike A "Attack +8"; MC Augment "Save DC 17 (Dexterity)" and AR Boost A "Save DC 16 (Constitution)", all matching their stat cards. The none-resolution cards carried neither. The attack button opened the native `D20RollConfigurationDialog` reading `1d20 + 2 + 6` and posted a genuine `D20Roll` (d20 19, total 27) flavored "AR Strike A: Attack Roll".
  - Search: `item-list-controls` contained exactly one text input and one clear button, nothing else. Typing "stance" narrowed six rows to AR Stance alone; clearing restored all six.
  - Phase 2 leg: `CONFIG.Item.sheetClasses` listed exactly one default sheet per subtype with dnd5e's absent; a native feat still opened `ItemSheet5e`; the pill's plain click opened the identity sheet; the framework switch carried wis (index 1) to dex (index 1) and revealed the Rally fieldset; `validateJoint` refused both an arts+int identity and an arts+channel ability (each returned undefined and created nothing) while a legal arts+str control was created in the same batch, keeping the refusal dispositive.
- **Console**: zero errors or exceptions across every segment of the run, checked at init, mid-run, and after a final pass over all three tabs.

## Deviations and notes

1. **One product change during the run.** Step 4's measurement found the ladder legend's rows sitting 1.2px off the step cells': a step cell's cost row is 12px/700 and so 14.39px tall, against 12px for the 10px rows, and the legend shrank its cost row to 10px. Fixing the legend's cost row to the cell's font size brought all three rows into exact alignment (840 / 852 / 866.39 on both, legend height 44.4 matching the cells) with the ladder still 466px and not overflowing. Verified live by injecting exactly the rule now in `styles/veyl-frameworks.css`, then re-measured. Everything else in step 4 passed on rc.1 as installed.
2. **Fixture artifact, not a product defect.** Ability items created directly through the API take the schema's default activation rather than the rule-fixed one, so the AR Stance fixture displayed "Action" where a sheet-created Stance would be coerced to "Bonus Action". The coercion lives in the item sheet's `_processFormData` by design (see CLAUDE.md); items authored through the sheet are unaffected.
3. **Plutonium was active** during this run, unlike the Phase 3 run. No interaction was observed and the console stayed clean, but the known collision (its class importer choking on actors already holding framework items) was not re-exercised here.
4. **Harness note.** Removing the `#context-menu` element by hand leaves Foundry's ContextMenu unable to reopen properly; two trusted-click attempts were lost to it before the flow was re-run cleanly. Do not hand-remove that node; dismiss the menu with a click elsewhere instead. Also reconfirmed: scope row queries to `.veyl-tab`, since our items also have rows on the Features page that carry no `.veyl-summary`.

## Verdict

Pass, with one CSS alignment fix applied during the run (deviation 1). All nine steps verified. The gate closes once the fix ships in a tagged artifact and step 4's legend alignment is re-confirmed on the installed build.
