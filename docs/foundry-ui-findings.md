# FoundryVTT UI Findings: Building Against dnd5e 5.x

Working reference for Veyl Frameworks UI development. Everything here was verified live against Foundry 13.351 + dnd5e 5.2.4 during the spike (2026-07-20) and the front-end session (2026-07-21). Update it when a finding changes or a new one earns its place through pain.

---

## The prime directive: copy, don't imitate

When the UI you want already exists in dnd5e, mount dnd5e's actual building blocks instead of replicating their markup and CSS. This is not a style preference; it is structural:

1. **dnd5e scopes styling to its custom element tag names** (`item-list-controls`, `dnd5e-inventory`, etc.). A `<div>` dressed in the same classes misses every tag-scoped rule, which is exactly how the search bar ended up with wrong icon sizes, misalignment, and a stray border. Mounting the real `<item-list-controls>` made those bugs impossible by construction: the same code renders both bars.
2. **Behavior comes free.** The real element brought dnd5e's own name filtering, tooltips, and aria labels with zero custom JS. The hand-rolled version needed inline handlers that would never reach parity.
3. **It survives system updates.** Replicated pixel values (a 41px bar, 16px icons) silently drift when dnd5e restyles. The real element restyles itself.

Corollary: when native reuse is genuinely impossible, do not eyeball the imitation. Measure the native original with `getComputedStyle` and `getBoundingClientRect` on the live sheet and copy exact values. Eyeballing produced three rounds of "still not lined up."

---

## Contracts of the dnd5e list UI (discovered by introspection)

These are the undocumented wiring requirements for reusing dnd5e's list stack. All were found by probing live instances, not docs.

### `<item-list-controls>` (the search bar)

- Attributes: `for="<listName>"`, `collection="items"`, `label="Search ..."`, and `keep-empty=""` if empty sections should stay visible (the Spells tab uses it; so do we, for Surge/Apex).
- **It builds its own children.** Mount the tag empty; it generates the `<search>`, input, and clear/filter/sort buttons itself. Do not author inner markup.
- **It resolves its target list as `[data-item-list="<for>"]`**, and this resolution happens inside `connectedCallback`. If the list is not findable at connect time, it throws `Cannot read properties of null (reading 'querySelectorAll')` once per render.
- **It must live inside a `<dnd5e-inventory>` ancestor** for that resolution to work during ApplicationV2's `_replaceHTML`. Bare in the tab section, it errors at connect and only resolves later.
- **Name filtering keys off `data-item-name` on each `li.item`.** Rows without it are invisible to the filter.

### `<dnd5e-inventory>` (the list wrapper)

The exact native structure, which must be copied precisely:

```html
<dnd5e-inventory class="inventory-element">
  <div class="middle">
    <item-list-controls for="..." collection="items" label="..." keep-empty=""></item-list-controls>
  </div>
  <section class="items-list ..." data-item-list="...">
    ...
  </section>
</dnd5e-inventory>
```

- **The list is a sibling of `div.middle`, not a child.** `.middle` is a flex row with `item-list-controls { flex: 1 1 0% }`; nesting the list inside it stretches the 41px bar to the full list height and overlaps them.
- Mounting `dnd5e-inventory` also wires its click delegation: rows with `item-action` classes route to `_onEditItem` and friends by `data-item-id`. This is desirable plumbing, but see Known Incompatibilities for what happens until our item sheets exist.

### Row conventions

Native item rows carry: `data-item-id`, `data-entry-id`, `data-uuid`, `data-item-name` (plus `data-group-*` attributes for the grouping mode). Supplying the same set makes dnd5e's filtering, and eventually context menus and drag handling, treat our rows as native.

---

## ApplicationV2 tab and part contracts

- **PARTS entries need the `container` key** (`container: { classes: ["tab-body"], id: "tabs" }`) or the part renders as a loose child of the form. Container placement happens at first insertion only, so registration must occur at `init`, before any sheet renders. (Spike finding; still the number one thing to forget.)
- **The template must render the `active` class itself** from `context.tab.active` (`{{#if tab.active}}active{{/if}}` on the root section). `changeTab` toggles classes on click but no-ops when its internal state already matches, so a re-render that omits the class leaves the open tab blank until the user clicks away and back. The base `_preparePartContext` populates `context.tab` from `context.tabs[partId]`; do not clobber it when merging custom context.
- **`TABS`/`PARTS` are plain writable statics shared by every sheet instance.** Per-actor tab visibility therefore cannot live in registration; enforce it at render time (hide, do not remove, since AppV2 tracks part elements across partial re-renders).
- Render hook name is `render` + the sheet class name (`renderCharacterActorSheet`), receiving `(app, element)` with `element` an HTMLElement, not jQuery.

---

## Live prototyping workflow (the fast loop)

Iterating in the running world beats the tag-release-reinstall cycle for UI work by an order of magnitude. The loop:

1. **Override the compiled template in place:** `Handlebars.partials["modules/<id>/templates/<file>.hbs"] = Handlebars.compile(src)`. Foundry's template cache lives in `Handlebars.partials` keyed by path, so the next render uses the override. Keep the working source in a `window.__x` variable so edits are string surgery, not full repastes.
2. `await sheet.render(true)` to apply. A close/reopen cycle is only needed when part *registration* changes (the container rule); template swaps just need a render.
3. **Verify with the DOM, not the eyes:** bounding rects, computed styles, and dispatching real `input` events to test behavior. A filter "looks like it works" is worth nothing; `filterResult: ["Soulstep"]` is evidence.
4. Everything is session-local: a refresh reverts to the installed module. Prototype freely, then port the final state into the repo as a patch.

## Introspecting dnd5e when the docs run out

- `customElements.get("item-list-controls")` gets the class; `Object.getOwnPropertyNames(cls.prototype)` lists its API surface (`list`, `app`, `filters`, `_applyFilters`, ...).
- **Probe getters on a working native instance and the broken custom one side by side.** `nativeCtrl.list` resolving while `mineCtrl.list` is null localized the wiring bug in one call. Comparing ancestor chains (`parentElement` walks) exposed the missing `dnd5e-inventory` wrapper.
- Console error line numbers in the served `dnd5e.mjs` map to real source files in stack traces from the browser (e.g. `item-list-controls.mjs:359`); the numbers alone are enough to correlate repeated errors across sessions.
- The dnd5e GitHub repo is the ultimate reference when live introspection is not enough; match the installed version tag, not `master`.

---

## Known incompatibilities of custom Item subtypes

The custom-subtype architecture (`documentTypes` + `TypeDataModel`) is the right call and passed the load-bearing creation tests, but it has an ecosystem cost. Confirmed so far:

- **dnd5e's default `ItemSheet5e` cannot open our items** (`hasEffects` TypeError in `_configureRenderParts` and `_getTabs`). Any UI path that opens the item, including `dnd5e-inventory` row clicks and the Features pill, hits this until Phase 2 registers dedicated item sheets. Registering our own sheets is the fix, not defensive patches around dnd5e.
- **Third-party code that iterates `actor.items` assuming pure dnd5e types can throw.** Confirmed with Plutonium's class importer (reads a dnd5e system field on every embedded item; fails on an actor holding framework items, succeeds on a clean one). Workaround: run such imports before granting frameworks. Feature Organizer is the suspected next case; decision scheduled for Phase 2.
- Pattern for triage when a third-party module breaks on a framework-holding actor: reproduce on a clean actor. Clean actor fails too: not our problem. Clean actor succeeds: log it in the README's known-issues list and manage per-module.

---

## Standing rules distilled

1. Reuse the native element; imitation is the fallback of last resort and must be measured, not eyeballed.
2. Register tabs, parts, and data models at `init`; never later.
3. Templates own their `active` class.
4. Every UI claim gets a DOM measurement or a dispatched-event test before it is called done.
5. Prototype in the console, deliver as patches, and port every live finding into this document before the session ends.
