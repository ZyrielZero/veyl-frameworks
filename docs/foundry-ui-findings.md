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
- Mounting `dnd5e-inventory` also wires its click delegation, but **only to `.item-action[data-action]` elements and `[data-context-menu]` elements**, bound per-element in `connectedCallback` (verified against the live element's source, 2026-07-22). The `item-action` class alone does nothing: a name div without `data-action` is inert, which is exactly how the tab's rows shipped in rc.1. The action attribute value routes through `_onAction` (`edit`, `use`, `view`, `delete`, `toggleExpand`, ...); `data-action="edit"` on the name div opens the item sheet, and `data-context-menu=""` on the ellipsis button produces dnd5e's full native context menu (View/Edit/Duplicate/Delete/Display in Chat/Favorite), whose Edit entry works on our subtypes.

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

## Testing drag and drop without a mouse (found during the Phase 1 gate run, 2026-07-22)

CDP-driven mouse drags (`left_click_drag`) do not fire HTML5 drag events, and a bare synthetic `drop` dispatch fails for a subtler reason: dnd5e's `_onDropItem` consults `_dropBehavior(event, item)`, which reads the drag session's `dropEffect`. A `DataTransfer` constructed in script has `dropEffect` locked to `"none"` (the setter is inert outside a real drag session), so the handler routes correctly all the way to `_onDropItem` and then silently bails with behavior `"none"`.

The reliable dispatched-event recipe, verified against sidebar and compendium sources:

1. Create one `DataTransfer` and dispatch `dragstart` on the source row (`[data-entry-id]` in the Items directory or an open compendium window). Foundry's own dragstart handler fills the payload, so you also verify the source side for free.
2. Dispatch `dragover` then `drop` on a **descendant** of the sheet (e.g. the active tab section), sharing the same `DataTransfer`. The drop listener is not on the form root, and `dispatchEvent` propagation never reaches listeners on descendants of the dispatch target, so dispatching on the root silently misses it.
3. The dragover step is what sets the drop behavior; skipping it resurrects the `"none"` bail.

Payload-only drops (setting `text/plain` to `{type: "Item", uuid}` without a dragstart) work only if a previous real dragstart in the same page session left the behavior state set; do not rely on it.

Addendum (Phase 2 exit run, 2026-07-22): a payload-only drop of an actor's own embedded item onto its sheet does route, and dnd5e resolves the locked `"none"` dropEffect as a **copy**, silently duplicating the item on the actor. Check `actor.items` after any synthetic drop test and delete the clones.

## Prose-mirror editors inside custom item sheets (2026-07-22)

dnd5e sizes an open `<prose-mirror>` only inside its own description tab (`prose-mirror[open]` gets `min-height: 150px`, and that tab's `.editor-content` gets `min-height: 300px`). Outside that layout, in our fieldset stacks, the open editor's `.editor-content` computes to 0px height: typing works and saves land, but the text is invisible while editing. Fix (measured, not eyeballed): give `.veyl-item-sheet prose-mirror[open]` the native `min-height: 150px` and let `.editor-content` flex-fill it. Verified live: 150px editor with a 100px visible typing area.

## Phase 3 pre-implementation spike (2026-07-22, dnd5e 5.2.4)

All verified live against the installed 0.2.0-rc.2 (the Phase 3 code was not yet installed, so the `.mjs` logic was checked by pasting its math into the console and the template was checked via a `Handlebars.compile` override with fabricated context).

- **Sheet mode.** `CharacterActorSheet.MODES` is `{ PLAY: 1, EDIT: 2 }`; `sheet._mode` is instance-only (read `sheet._mode ?? 1`). The `.mode-slider` in the window header toggles it and fires a full `renderCharacterActorSheet`, so a row attribute keyed on mode (our `data-action="edit"` vs `data-veyl-toggle`) re-renders correctly on every mode switch.
- **Play mode is read-only for free.** In Play mode dnd5e sets `disabled` on every `<select>`/`<input>` in the sheet body (verified on our ability sheet's framework/discipline/level selects). Our new resolution and saveAbility selects inherit this: no Play-mode handling needed for exit step 2.
- **`item-list-controls` renders no dead controls on our tab.** With a single-collection list it builds only a `<search>` with an input plus one `filter-control` clear button (aria "Clear Filters"); no filter or sort dropdowns appear. Exit step 8's "no dead controls" is satisfied with zero extra CSS. Name filtering keyed on `data-item-name` hides non-matching rows (`li.hidden`) and clearing restores them, confirmed live.
- **`CONFIG.Dice.D20Roll.build(config, dialog, message)`** (inherited from `BasicRoll`, signature `async build(config={}, dialog={}, message={})`). `config.rolls` is an array of `{ parts, data, options }`; pass the click `event` in `config` so the advantage/normal/disadvantage keybindings register. `message.data` carries `speaker` and `flavor`. `buildConfigure` defaults `config.hookNames` to `[""]`, so omitting it is fine. Live: `build({ rolls: [{ parts: ["@mod","@prof"], data: { mod, prof }, options: {} }], event }, {}, { data: { speaker, flavor } })` opened the native roll dialog and posted a `D20Roll` with formula `1d20 + 3 + 2` (or `2d20kh + 3 + 2` on Advantage) carrying our flavor. Keep the plain-`Roll` fallback for when the shape moves.
- **`renderChatMessageHTML` is the v13 hook** (the old `renderChatMessage` no longer fires). It delivers `(message, html, context)` with `html` an `HTMLElement` (an `HTMLLIElement`, the chat-log row), not jQuery. Guard on our own flag before touching the DOM.
- **Chat card frame.** A native dnd5e item card is `<div class="chat-card item-card">` with a transparent background and `0px` border; the `dnd5e2` theming class sits on the ancestor `.chat-message`, which Foundry always adds. So `.dnd5e2 .chat-card` scoping reaches our card through its ancestor whether or not we repeat `dnd5e2` on the card div (we do, matching the roadmap note; harmless). Our card renders header, content, bordered meta pills, and a styled 32px footer button consistently with native.
- **Derivation math** (checked standalone against the rules tables): ladder caps at `unlockedStep(level)` giving step 1 at L1, steps 1-5 at L9, steps 1-9 at L17; Magecraft MP costs `2,3,5,6,7,9,10,11,13`, Arts techniques `1..9`; thresholds fall on steps 3/6/9; Echo reservation `5/10/15/20/25` and Stance hold `1/1/2/2/3` track the level bands. All exact.

## Phase 3 exit-run harness notes (2026-07-22, browser automation via CDP)

Findings about the test harness itself, not the module; they cost real diagnosis time and will bite again.

- **CDP click coordinates are screenshot-space, not page-space.** The extension screenshots at a scaled resolution (1464px and 1512px wide were both observed in one session against a 1920px viewport) and interprets click coordinates in that space. A coordinate computed from `getBoundingClientRect` lands elsewhere: divide page coordinates by `window.innerWidth / screenshotWidth`, and recompute the factor from the dimensions of the most recent screenshot because it changes between captures. Symptom when wrong: the click "fires" but hits a container (event target `.tab-body`), while `elementFromPoint` at the intended page coordinates swears the right element is there.
- **Synthetic typing reaches `<input>` but not contenteditable.** The extension's type action lands in ordinary inputs (the search bar) but produces nothing inside a ProseMirror `contenteditable`, even when it is focused. Recipe that works and still exercises ProseMirror's real input path: focus the editor, collapse a selection into it, then `document.execCommand("insertText", false, text)` (drives the browser's editing pipeline and PM's beforeinput handling), then click the toolbar's `[data-action="save"]` button. Verified landing in `system.signature`.
- **The first keystroke after a focusing click can be swallowed** (typed "st" into the search bar, got "t"). Verify the field's value after typing instead of trusting the action result.
- **Scope row queries to `.veyl-tab`.** `sheet.element.querySelector('[data-item-id="..."]')` can match dnd5e's native row for the same item on the Features or Inventory tab. Those rows carry dnd5e's own `collapsible collapsed` classes, so an unscoped query reads like a broken expansion state (class and Set disagreeing) when both are actually fine.

---

## Introspecting dnd5e when the docs run out

- `customElements.get("item-list-controls")` gets the class; `Object.getOwnPropertyNames(cls.prototype)` lists its API surface (`list`, `app`, `filters`, `_applyFilters`, ...).
- **Probe getters on a working native instance and the broken custom one side by side.** `nativeCtrl.list` resolving while `mineCtrl.list` is null localized the wiring bug in one call. Comparing ancestor chains (`parentElement` walks) exposed the missing `dnd5e-inventory` wrapper.
- Console error line numbers in the served `dnd5e.mjs` map to real source files in stack traces from the browser (e.g. `item-list-controls.mjs:359`); the numbers alone are enough to correlate repeated errors across sessions.
- The dnd5e GitHub repo is the ultimate reference when live introspection is not enough; match the installed version tag, not `master`.

---

## Known incompatibilities of custom Item subtypes

The custom-subtype architecture (`documentTypes` + `TypeDataModel`) is the right call and passed the load-bearing creation tests, but it has an ecosystem cost. Confirmed so far:

- **dnd5e's default `ItemSheet5e` cannot open our items** (`hasEffects` TypeError in `_configureRenderParts` and `_getTabs`). Resolved in Phase 2 by registering dedicated per-type sheets and unregistering dnd5e's from our types; verified live 2026-07-22 (creation auto-open, pill click, row click, and context-menu Edit all open the Veyl sheets). Registering our own sheets was the fix, not defensive patches around dnd5e.
- **Third-party code that iterates `actor.items` assuming pure dnd5e types can throw.** Confirmed with Plutonium's class importer (reads a dnd5e system field on every embedded item; fails on an actor holding framework items, succeeds on a clean one). Workaround: run such imports before granting frameworks. Feature Organizer verified compatible live 2026-07-22: its feat guards hold, framework drops on custom categories are rejected, and its `fo-sortable-item` row decoration writes no flags to our items.
- Pattern for triage when a third-party module breaks on a framework-holding actor: reproduce on a clean actor. Clean actor fails too: not our problem. Clean actor succeeds: log it in the README's known-issues list and manage per-module.

---

## Standing rules distilled

1. Reuse the native element; imitation is the fallback of last resort and must be measured, not eyeballed.
2. Register tabs, parts, and data models at `init`; never later.
3. Templates own their `active` class.
4. Every UI claim gets a DOM measurement or a dispatched-event test before it is called done.
5. Prototype in the console, deliver as patches, and port every live finding into this document before the session ends.
