# Phase 3 gate evidence

Exit test run live in the Veyl world on The Forge against the installed 0.3.0-rc.1, driven via browser automation with DOM measurement, `_source` inspection, and real or dispatched-event verification for every claim. Single run, all ten steps passing; no code changes required.

## Environment

| Component | Version |
| --- | --- |
| Date of run | 2026-07-22 |
| Foundry VTT | 13.351 |
| dnd5e | 5.2.4 |
| libWrapper | 1.13.4.0 |
| Feature Organizer | enabled only for step 10's regression leg, then disabled again |
| veyl-frameworks | 0.3.0-rc.1 (tag `v0.3.0-rc.1`) |
| World | veyl (test world) |

Test data: the standing clean actor "Veyl Exit Test" (0 items) was granted both identities plus one ability per discipline (8 abilities) covering all three resolutions, rich-text fields with bold, italics, and an inline-roll enricher, evolutions at thresholds 1/2/3, and deepenings at levels 10/15/20. A "VeylTest Class" item provided level control (1, 9, 17). Ability scores were set to INT 16 and STR 14 so derived numbers were nonzero. Everything was deleted and the scores restored at the end; the world was left exactly as found.

## Results per exit-test step

| Step | Description | Result |
| --- | --- | --- |
| 1 | Console clean at init; existing items load with resolution none | PASS |
| 2 | Resolution and save-ability selects: reveal, persist, Play read-only | PASS |
| 3 | Play click toggles summary; Edit click opens sheet; context menu both | PASS |
| 4 | Summary content correct per group, both frameworks, rich text rendered | PASS |
| 5 | Ladder numbers at levels 1/9/17, capped, thresholds marked and labeled | PASS |
| 6 | Fixed costs track the level band | PASS |
| 7 | Chat cards: content, attack button, save DC line, neither on none | PASS |
| 8 | Search filters and clears; no dead controls | PASS |
| 9 | Statelessness: byte-identical source, expansion dies on reload | PASS |
| 10 | Regression: Phase 2 exit test end to end, native items unaffected | PASS |

## Evidence detail

- **Step 1**: 77 boot console messages, zero errors or exceptions. The pre-existing sidebar "Test Ability" loaded with `system.resolution` `"none"`, `saveAbility` `"str"`, and an empty `validationFailures`.
- **Step 2**: on a Play-mode sheet the resolution select rendered `disabled: true` with value none and no save-ability select in the DOM. In Edit mode the select offered exactly none/attack/save; choosing save revealed the save-ability select with all six abilities; setting wis persisted across close and reopen in the re-rendered selects, `item.system`, and `item._source`. Reverting to none removed the save-ability select again.
- **Step 3**: a trusted mouse click on a Play-mode row name expanded a 204px `.veyl-summary` without opening any application, and a second click collapsed it (per-sheet Set verified both ways). In Edit mode the same physical click opened `VeylAbilitySheet` and left the expansion Set untouched. Right-click opened dnd5e's native context menu in both modes (View Item, Edit, Duplicate, Delete, Display in Chat, Favorite, Expand) at the pointer, without toggling the row.
- **Step 4**: all eight rows expanded through the real click path. Reserve rows led with the Signature and their reservation or hold line plus level-keyed deepenings; enhance and active rows showed trigger or activation, the base effect, the ladder, the per-step line, and evolutions labeled Step 3/6/9; climax rows showed the base effect, their fixed line, the amplify block, and masteries. Bold and italic rendered as elements, the Echo signature's `[[/r 1d4]]` enricher rendered as a live inline-roll link, and no summary contained escaped HTML.
- **Step 5**: ladders capped at step 1 (L1), steps 1-5 (L9), and steps 1-9 (L17). Magecraft costs read 2,3,5,6,7,9,10,11,13 MP and Arts 1..9 techniques, matching the rules tables exactly. `veyl-threshold` marked precisely steps 3, 6, and 9, each tied to its "Step N:" evolution line beneath the ladder.
- **Step 6**: Echo reservation read 5, 10, 20 MP and Stance hold 1, 1, 2 techniques at levels 1, 9, 17; Surge held "Minimum 15 MP; each amplification adds 15 MP" and Apex "Spends all ready techniques (minimum 3; 10 HP per missing technique); each amplification costs 30 HP" at every level. Stat cards recomputed per level: attack +5/DC 13/mana 13 at L1, +7/15/63 at L9, +9/17/113 at L17 (all hand-checked); the Arts ready hand read 0 at L17 (2 techniques known minus hold 2).
- **Step 7**: all eight cards posted with image, name, framework and discipline, cost or step, activation, trigger, duration, and rendered rich text; message flags carried only `veyl-frameworks.itemUuid` plus core. MC Channel carried "Attack +9" and AR Strike "Attack +8", both equal to their stat cards; MC Augment carried "Save DC 17 (Dexterity)" and AR Boost "Save DC 16 (Constitution)", matching DC and naming the ability; the none-resolution cards carried neither. Clicking the attack button opened the native Configure Roll dialog showing `1d20 + 3 + 6`, and Normal posted a genuine `D20Roll` (total 16) flavored "MC Channel: Attack Roll".
- **Step 8**: `item-list-controls` contained exactly one search input and one clear button, nothing else. Typing narrowed rows live across sections ("stance" left only AR Stance visible; a lone "t" correctly kept the three names containing a t) and the clear button restored all four.
- **Step 9**: a JSON snapshot of actor `_source` flags and system plus every item's `_source` flags and system, taken right after setup, was byte-identical (FNV-1a `89cf3bf5`, 10982 chars) after exercising every feature above and reverting the intentional step-2 and level edits. No item ever carried a flag. After a full reload the expansion Set was empty and every row rendered collapsed.
- **Step 10** (Phase 2 regression, all re-verified):
  - `CONFIG.Item.sheetClasses` lists exactly one default sheet per subtype; dnd5e's sheet absent from our types.
  - Sidebar Test Identity and Test Ability opened our sheets with native window chrome and mode slider; no `hasEffects` TypeError.
  - Play mode disabled all 6 body fields on the ability sheet; Edit mode re-enabled them.
  - Framework switch carried wis (index 1) to dex (index 1) and revealed the Rally fieldset.
  - All eight discipline layouts rendered their group's exact fieldset legends; the activation select showed the trigger field only on reaction (verified both directions); the resolution select rendered inside the sheet for every discipline.
  - A typed paragraph saved through the prose-mirror toolbar landed as `<p>The blade remembers.</p>` in `system.signature`.
  - Three evolutions persisted and a middle-delete kept rows one and three intact.
  - The Features pill ("Magecraft Severance INT") opened `VeylFrameworkSheet`.
  - Native feat, weapon, and spell all opened `ItemSheet5e`.
  - Phase 1 loop: a clean actor showed both tabs `display: none` and no pill; a magecraft grant produced the active tab, the Attack +1 / DC 9 / Mana 6/6 card (level 0, prof 1, int 10, matching Phase 2's exact values), the pill, and the Channels row; deleting the identity with the tab open hid the tab, fell back to Details, and removed the pill.
  - An illegal arts+int identity was never created (validateJoint).
  - Compendium round trip: import into a world pack, create inside the pack, and drop back onto the actor all preserved type and system data.
  - Feature Organizer: enabled for this leg only. The Features tab rendered on the framework actor; Test Category created and deleted through FO's own dialog on both the framework actor and a clean actor; a dispatched category drop of a framework item was rejected (no flag, no duplicate, no error) while a control feat dropped the same way was accepted (category flag written), keeping the rejection dispositive. FO disabled again afterward.
- **Console**: zero errors or exceptions across every segment of the run, checked after each page load and at the end.

## Deviations and notes

1. No product deviations: every step passed on rc.1 as installed, with no code changes.
2. Evolutions render beneath the ladder even when their threshold step exceeds the current cap (the ladder itself stays capped). This is the template's intended display-only behavior, recorded here for the record.
3. Test-harness findings from this run (CDP coordinate scaling, contenteditable typing, unscoped row queries) are ported to docs/foundry-ui-findings.md.
4. Environment note: with Feature Organizer enabled, first renders of a bare character sheet twice froze the renderer beyond a 45s CDP timeout before recovering on their own. Not reproducible against our types, no errors logged, and FO is disabled outside its regression leg; noted in case it resurfaces.

## Verdict

Pass. Phase 3 exit test complete on the installed 0.3.0-rc.1; gate ready to close with the v0.3.0 release.
