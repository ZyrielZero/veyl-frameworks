# Handoff — Veyl Frameworks

Written 2026-08-16, after fast-forwarding the local checkout (it was 40 commits
behind origin) to `93dbfb8` / tag `v0.4.0-rc.2`. Supersedes the earlier draft of
this file, which was written against the Phase 1 scaffold and is obsolete.

## Where the project stands

- **Phases 1–3 are closed** (v0.1.0, v0.2.0, v0.3.0), each with gate evidence in
  `docs/gates/`. Phase 3 shipped item sheets, the tab ladder/expansion, search
  via dnd5e's own `<item-list-controls>`, and chat cards with native attack
  rolls.
- **Phase 4 (Arts parity and display polish) is one step from closing.** The
  gate run on 2026-07-25 against rc.1 passed all nine steps, with one CSS fix
  applied live during the run (ladder legend row alignment, deviation 1). That
  fix shipped in `338ea57` and is in the tagged `v0.4.0-rc.2`. Per the gate
  verdict, the phase closes when rc.2 is **reinstalled in the Veyl world and
  step 4's legend alignment is re-confirmed on the installed build** — then tag
  `v0.4.0` and append the confirmation to `docs/gates/phase-4.md`.
- Next up after that: **Phase 5, resource state** — the first phase that writes
  actor state. Full scope, storage design (state on the identity item, not actor
  flags), and researched findings are in `docs/roadmap.md`. Read it before
  starting; it also carries the Phase 6 Attunement landmines and the two flags
  Phase 3 punted (Attunement-blind chat numbers, contested-check resolution).

Working tree is clean except this file. Local checkout now matches origin/main.

## Key documents

| Doc | What it holds |
| --- | --- |
| `README.md` | Current phase scope, exit test, deploy procedure, known issues |
| `docs/roadmap.md` | Phases 5–9 scope + researched findings (chat cards, Attunement AE, rests) |
| `docs/foundry-ui-findings.md` | Hard-won UI mechanics (item-list-controls, TABS/PARTS, prose-mirror sizing) |
| `docs/gates/phase-*.md` | Per-phase exit-test evidence, environments, deviations, harness notes |
| `docs/rules/` | The Magecraft and Arts rules documents (source of truth for formulas) |

Note: gate evidence references a `CLAUDE.md` (e.g. the activation-coercion
design note in phase-4 deviation 2), but `CLAUDE.md` and `.claude/` are
gitignored — that file does not exist in a fresh checkout. The referenced
design decision (rule-fixed activation coerced in the item sheet's
`_processFormData`, so API-created items take schema defaults) is restated here
so it isn't lost.

## Standing constraints (do not re-derive)

- **The Forge snapshots at install.** Pushing to GitHub updates nothing. Every
  gate runs against a tagged rc artifact reinstalled from the manifest URL.
  `module.json`'s `download` field pins the exact tag and must be bumped per
  release (currently done by hand — there is still no release workflow under
  `.github/`; the ten existing tags were evidently cut manually).
- **Test in Veyl only. Nothing touches Taoteti without explicit go-ahead.**
- Phases 1–4 are **display-only / stateless**: every gate includes a
  byte-identical `_source` snapshot check and a no-flags check. Phase 5 is the
  first deliberate break from that.
- Tab bodies must render their `active` class from context
  (`{{#if tab.active}}active{{/if}}` in `tab.hbs`) — ApplicationV2's
  `changeTab` no-ops when state already matches, so a re-render that drops the
  class leaves the open tab blank. Already handled; don't regress it.
- `TABS`/`PARTS` are writable class statics shared by all character sheets;
  per-actor visibility is enforced at render time in `pill.mjs` by hiding (not
  removing) nav buttons and parts. This DOM approach is deliberate (recorded in
  `docs/foundry-ui-findings.md`) and has passed four live gates.
- Known third-party collision: **Plutonium's class importer** fails on actors
  already holding framework items. Accepted cost; workaround and details in
  README known issues. Feature Organizer is verified compatible.

## Review findings still open (2026-08-16 pass)

A code review of the Phase 1 scaffold was done against dnd5e source before the
fast-forward. Most findings were either already fixed independently in Phases
2–4 or turned out to be wrong; here is what survives against current code:

1. **`main.mjs` libWrapper target vs. class fallback** (`scripts/main.mjs:16-40`
   and `:69`). `getCharacterSheetClass()` has a fallback that searches
   `CONFIG.Actor.sheetClasses`, but `libWrapper.register` still targets the
   hardcoded `SHEET_CLASS_PATH` string — if the fallback ever fired, the wrap
   would throw. The path is verified real in dnd5e 5.x, so the fallback is dead
   code. Cosmetic-tier: drop the fallback or wire it through. No urgency.
2. **Pill lacks `--underlay`** (`scripts/pill.mjs`). Native `.pill-lg::before`
   paints `var(--underlay)` as a watermark; our injected pill never sets it, so
   the pseudo-element degrades to nothing. Purely cosmetic.
3. **Optional refactor, low priority:** per-actor tab visibility could move
   from post-render DOM hiding to a `_prepareTabsContext` wrap using
   `findSplice`, the same pattern dnd5e uses for the Bastion tab
   (`CharacterActorSheet._prepareTabsContext`). Benefits: nav button never
   emitted, pre-render active-tab fallback (no flash, no `changeTab` try/catch).
   The shipped approach works and is gate-proven, so this is a nicety.
   **Trap if attempted:** `PrimarySheetMixin._getTabs()` supports a `condition`
   on TABS entries, but `BaseActorSheet._prepareTabsContext` builds the nav
   from `deepClone(TABS)` and ignores `condition` — a declarative condition
   does NOT hide the button. Use `findSplice`.
4. **No release automation.** Releases are manual (zip + tag + `module.json`
   bump). A GitHub Actions workflow building `veyl-frameworks.zip` on tag and
   updating the download URL would remove a per-release footgun. There is also
   no LICENSE file.

Findings from the earlier pass that are **resolved or invalid** — do not re-raise:

- Tab `active` class: fixed in Phase 3 (`tab.hbs` renders it from context).
- `stanceHold` bands: the earlier review flagged a comment/code mismatch; it was
  wrong. The rules table (the-arts.md) is 1-4→1, 5-9→1, 10-14→2, 15-19→2,
  20→3, which the three-threshold implementation encodes exactly.
- `validateJoint` blocking framework switches: handled by the Phase 2 item
  sheets (framework switch carries the ability by index; the joint refusal is
  by design and gate-tested as dispositive).

## Environment note

The local dnd5e install at
`C:\Users\Zyriel\AppData\Local\FoundryVTT\Data\systems\dnd5e` is **5.0.4**, but
every gate since Phase 1 ran against **5.2.4 in the live Veyl world** (per gate
evidence). Treat the local install as a source-reading convenience only; verify
anything version-sensitive against the world's 5.2.4.

## Immediate next steps

1. Reinstall `v0.4.0-rc.2` in the Veyl world, re-confirm exit step 4's legend
   alignment on the installed build (measured, not eyeballed — 12px cost row,
   three-row alignment per gate deviation 1).
2. Tag `v0.4.0`, append the confirmation to `docs/gates/phase-4.md`, close
   Phase 4.
3. Open Phase 5 per `docs/roadmap.md`: write the exit test first, then the
   schema additions to the identity item (currentMP, echoActive, per-ability
   ready state), with migration defaults verified against pre-existing items.
4. Opportunistically: release workflow + LICENSE (finding 4 above).
