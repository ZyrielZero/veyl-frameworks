# Phase 1 gate evidence

Exit test run live in the Veyl world on The Forge, driven via browser automation with DOM measurement and dispatched-event verification for every UI claim.

## Environment

| Component | Version |
| --- | --- |
| Date of run | 2026-07-22 |
| Foundry VTT | 13.351 |
| dnd5e | 5.2.4 |
| libWrapper | 1.13.4.0 |
| veyl-frameworks | 0.1.0-rc.2 (tag `v0.1.0-rc.2`, commit `c76eb0a`) |
| World | veyl (test world) |

Fresh page load with the module active produced zero console errors.

## Results per exit-test step

| Step | Description | Result |
| --- | --- | --- |
| 1 | Module + libWrapper installed and enabled in Veyl | PASS |
| 2 | Clean actor: no framework tabs, no pill | PASS |
| 3 | Create magecraft identity (Severance, int), drag onto actor | PASS |
| 4 | Magecraft tab + stat card + Features pill | PASS |
| 5 | Pill click opens identity item sheet | PASS with accepted deviation (see below) |
| 6 | Create channel ability, appears in Channels section | PASS |
| 7 | Both subtypes via sidebar, compendium, and drag onto actor | PASS |
| 8 | Delete identity: tab and pill vanish, open tab falls back to Details | PASS |
| 9 | Repeat 3 through 8 with an arts identity | PASS |

## Evidence detail

- **Step 2**: fresh classless actor (0 items). Both framework nav anchors and tab sections present in DOM but measured `display: none`; no visible pill. Hidden-not-removed is the designed behavior (AppV2 tracks part elements across partial re-renders).
- **Step 3/4**: derived numbers verified by hand against `scripts/tab.mjs` formulas on the classless actor (level 0, prof 1, int 10): MANA 6/6, SAVE DC 9, ATTACK +1, ability abbreviation INT. All matched the rendered stat card exactly. Pill text: "Magecraft Severance INT".
- **Step 5**: pill click handler fired (`pill.mjs:49` in the stack) and attempted `ItemSheet5e.render`, hitting the documented `hasEffects` TypeError. Accepted deviation: the default dnd5e item sheet cannot open custom-subtype items until Phase 2 registers dedicated sheets (README known issues).
- **Step 6**: "First Sever" (magecraft/channel) rendered in the Channels section with CSL 0, cost 2, time A, matching `displayCost` and `TIME_ABBR`.
- **Step 7**: identity and ability subtypes both created via the sidebar dialog (both listed in the type picker), imported into a world compendium, created directly inside the compendium, and dropped onto the actor from both the Items directory and the open compendium window. All paths landed correctly with `validateJoint` passing.
- **Step 8**: with the Magecraft tab active, deleting the identity hid the nav tab (measured `display: none`), removed the pill, and the sheet fell back to the Details tab.
- **Step 9**: full repeat with arts identity "Bulwark" (str). Arts card rendered Attack +1, Save DC 9, Ready Hand 0 with no techniques; Ready Hand recomputed to 1 after adding one strike and one boost (2 techniques minus stance hold 1), confirming derive-at-render. Strike and boost abilities rendered in their sections (cost 1, time A). Pill "Arts Bulwark STR". Deletion with the arts tab open fell back to Details. The parameterized template serves both frameworks.
- **Bonus check**: `validateJoint` rejects an illegal arts + int identity at creation (item never created; direct call throws the legality error).

## Accepted deviations (per README known issues, not gate failures)

1. `hasEffects` TypeError whenever dnd5e's default `ItemSheet5e` renders a framework item (item creation auto-open, pill click, tab row click). Fixed by Phase 2 item sheets.
2. Plutonium class-import collision on actors already holding framework items (not retested this run; documented 2026-07-21).

No other console errors occurred at any point in the run.

## Verdict

Clean pass. Phase 1 gate closed; rc.2 promoted to v0.1.0.
