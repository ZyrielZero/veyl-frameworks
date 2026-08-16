# Release gate: v0.9.0 (full §10 exit test)

Run 2026-08-16 in the live Veyl world via Chrome, against manifest-installed rc
artifacts (`0.9.0-rc.2` → `0.9.0-rc.3` after the sweep fix below). Environment:
Foundry 13.351, dnd5e 5.2.4, libWrapper 1.13.4.0. Fixtures per design §10: F1
(L5 Int 18, max 43), F2 (L13 Int 20, max 114), F3 (L4 Int 16, max 31), F-Arts
(L5 Str 14, Brace). All fixtures, chat, combats, and the world clock (advanced
81 s during leg G) were restored to found state at the end; final restart
booted console-clean.

## Finding fixed mid-gate (rc.3)

**Both expiry sweeps trusted `effect.duration.remaining`, which is prepared
data — nothing re-prepares effects when world time or the combat round
advances, so the compared value stays frozen at the last prepare and expired
Burnouts survived every sweep.** Found by legs G6/G7 on rc.2; both sweeps now
compute remaining from `startTime`/`startRound` directly. Fixed in `3224333`,
tagged `v0.9.0-rc.3`, reinstalled, and legs G6/G7 re-run green on the
installed build. Rule for the findings doc: **never trust prepared duration
math in time-driven hooks.**

## Results

| Leg | Result | Notes |
| --- | --- | --- |
| A. Migration & schema | PASS¹ | Keys materialize only on engine write (exactly the five); stripped-source item loads with sane prepared defaults, manaState treats null as full; Arts source pristine throughout |
| B. MP arithmetic | PASS | 43/43 src-null; spend/persist/overdraft-refuse/clamp exact; formula pins 13/43/89/171 |
| C. Echo lifecycle | PASS | 26/31 reserve 5; drain-to-available-0 refuses with current==reserve; level-up mid-Echo floors available at 0 with Echo up; collapse spendable same tick, AE gone; activation gate; reserve bands 5/10/10/15/15/20/20/25 |
| D. Attunement | PASS² | Int 18→20 mod +5, native check 1d20+5, attack +8 DC 16; **T-D2 max 43 while attuned**; F2 Int 26 unclamped; odd-parity 17→19; level-change AE rewrite 2→5→2; source-edit policy (src 20 / derived 22 / max follows base 48); idempotent double-activate; hud:false both entries |
| E. Empowerment | PASS | Unlock cap (`locked-step` at 4 on L5); affordability cap at 4 MP; evolutions []/[1]/[1,2]/[1,2,3] at 2/3/6/9; cost pins 5/9/13; dialog stays open on selection (live UI, rc.2 smoke) |
| F. Strain | PASS | Step-6 Channel locks [6]; second 6th Channel AND step-7 Augment refused `strained` (shared budget); 7th Channel legal then locks [6,7]; ≤5th never locks; short rest survives, long rest clears |
| G. Surge/HP/Burnout | PASS | 15→28/5rds, 30→13/10rds; 10 MP+10 HP paid; strict amplify (30 not legal at 20 MP); HP == shortfall×2 exactly; collapse-into-Surge counted once (5 rds, totalMP 15); combat rounds stamped + swept at expiry (not before); deleteCombat converts 3 remaining rounds → 18 s; world-time sweep; recovery+all four entry points refuse under Burnout; `insufficient-hp` at 9 HP with zero change, exact-10 resolves to HP 0; L4 Surge refused `level`; concentration untouched |
| H. Rest sequence | PASS | 10→short +14→24 flag true→2nd short +0→long 43 flag false lock cleared; long-with-Echo: 43 current / 33 available / Echo up; long rest during Burnout clears it then recovers (Q2), flag not consumed (Q3) |
| I. Chat cards | PASS | commitUse pays exact cost + posts receipt; stale card refuses with zero MP change; flags `veyl-frameworks` only, never `flags.dnd5e`; unlinked token writes land in `token.delta`, base actor untouched, re-fetch works; use cards collapsible |
| J. Arts statelessness | PASS | Identity source pristine (all five keys at initials, zero engine writes); card reads "Ready Hand 2/2 · Rally: Brace recovers 3 · 5 temp HP" matching Phase-4 formulas; zero Magecraft controls in the Arts branch; magecraft tab hidden |
| K. Console & idempotency | PASS | Double-click race under `Promise.all`: one spend, one card; sheet close/reopen ×3 mid-Echo leaves one AE and state intact; zero errors across the run and on the final restarted boot |

## Deviations

1. **T-A1 install-over-existing-world leg** could not be replayed literally: no
   genuine pre-0.9 items remained in the world (cleared by prior gate
   cleanups), and simulating one by deleting keys from stored source is
   defeated by schema cleaning (any write re-materializes initials — itself a
   confirmation of the mechanism). The two halves that matter were verified:
   initials live in prepared data, and the first engine write materializes
   exactly the five keys.
2. **T-D5 (ASI via AdvancementManager)** approximated by a direct source-score
   edit with the Echo active — source, derived, and MP max all moved
   correctly. The full AdvancementManager flow should be exercised once during
   ordinary play before 1.0.
3. **T-G6 two-client activeGM dedup** not run (single browser); the
   `isActiveGM` guard is in the registered hooks and single-client sweeps are
   verified.
4. **T-I3 advantage/disadvantage keybinds** verified only as the native
   dialog's Advantage/Normal/Disadvantage buttons (present, roll posted);
   keyboard modifiers not separately exercised.
5. **Forge metadata lag:** after reinstall, `game.modules` reports the version
   cached in The Forge's package DB while the served files (including
   `module.json` on disk) are already the new tag. Verify installs by fetching
   `modules/veyl-frameworks/module.json`, not the modules list.

## Open minor (rc.4 / 1.0 candidate, does not block 0.9)

- Deleting the **ability item whose Echo is up** leaves `echoActive` set with
  a dangling `echoItemId` (identity deletion cascades correctly; the
  ability-item path has no cleanup). The Echo remains collapsible from the
  sheet, so no lockout — robustness only.

## Verdict

**PASS.** All eleven legs green on the installed artifacts; the one defect
found (stale-duration sweeps) was fixed, tagged, reinstalled, and re-verified
within the run. `v0.9.0` tags the rc.3 tree with only the version bump.
