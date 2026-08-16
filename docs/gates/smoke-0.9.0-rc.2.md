# Smoke run: 0.9.0-rc.1 → rc.2, live in Veyl

Run 2026-08-16 against the installed artifacts, driven from the live world via
Chrome. This is a smoke run, not the §10 exit-test gate — the full legs A–K run
still gates v0.9.0. Fixtures: "Veyl Exit Test" (clean, 0 items) + VeylTest
Class 5, MC identity (Severance/int, INT 16), one Channel, one Echo, one Surge;
everything deleted and the actor, scores, HP, and chat restored at the end.

## rc.1 findings (both fixed in rc.2, verified live)

1. **Empower/Surge dialogs failed to render** — "Template part 'content' must
   render a single HTML element." ApplicationV2 requires exactly one root
   element per template part; both dialogs rendered several. Fixed by a single
   wrapping div.
2. **CONFIG.statusEffects entries silently missing** — dnd5e rebuilds
   `CONFIG.statusEffects` wholesale during its own setup, clobbering init-time
   pushes. Registration moved to the `ready` hook. Rule for the findings doc:
   **never push to CONFIG.statusEffects at init under dnd5e.**

Every other init registration (tabs, parts, item sheets, dataModels, rest and
combat hooks) survived rc.1 intact.

## Verified on rc.2 (all PASS)

| Check | Result |
| --- | --- |
| Stat card derived numbers (L5, INT 16): attack +6, DC 14, MP 38/38 | exact |
| Echo activate: AE +2 int.value, live 18/source 16, reserve segment 28/38+10, card +7/15, **MP max unchanged 38** | exact |
| currentMP stays null through Echo toggle (no MP arithmetic on activate) | pass |
| State survives full page reload (Echo up, 28/38) | pass |
| Empower dialog: steps 1–3 selectable at costs 2/3/5, 4–9 disabled "unlocks at higher level", live cost preview, stays open on selection | pass |
| Step-3 activation: 5 MP spent (28→23 available), receipt card with step/CSL/cost/ATTUNED and threshold-evolution flag | pass |
| Attack button → native D20RollConfigurationDialog, `1d20 + 4 + 3` (attuned), genuine D20Roll posted | pass |
| Collapse: echoActive false, AE removed (int back to 16), 10 MP instantly available (33), receipt card posted | pass |
| Surge dialog: amplify rows capped by pool (15/30 of 33), Burnout preview 5→10 rounds tracking selection | pass |
| Amplified Surge: 30 MP paid (33→3), Burnout AE 10 rounds, out-of-combat world-time duration 60 s, full receipt flags | pass |
| Burnout enforcement: BURNOUT 10 badge, Echo toggle disabled, every use button disabled | pass |
| Identity deletion cascades: Burnout AE auto-removed | pass |
| Console: zero errors across the rc.2 segment | pass |

## Notes

- The running Forge world server reports the module *version label* cached from
  boot; served files update immediately on reinstall. Restart the world before
  the real gate so the label matches the artifact.
- Release pipeline verified end to end for the first time: tag → Actions
  (~12 s) → assets → `releases/latest` manifest → Forge manifest install.
- `mpAfter` in receipt flags is *current* MP; card display correctly shows
  *available*. Internal only; no action.
