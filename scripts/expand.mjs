/**
 * Delegated click/change handling for the framework tabs (Phase 3 + v0.9).
 *
 * dnd5e-inventory binds its own per-element listeners to
 * .item-action[data-action] and [data-context-menu] at connect time; our
 * Play-mode name divs carry neither, so they are invisible to dnd5e and
 * handled here instead. One listener on the sheet root: ApplicationV2 keeps
 * the root element across partial re-renders (only part contents are
 * replaced), so binding once with a dataset guard survives every re-render.
 *
 * v0.9 additions route to the use flow and the engine — the sheet itself
 * never mutates a document (design §2): activations go through use.mjs (the
 * picker/spend/receipt pipeline owning the inFlight guard), and the MP input
 * routes its delta through engine spendMP/restoreMP.
 */

import { onPostCard } from "./chat.mjs";
import { onUseAbility, onEchoToggle } from "./use.mjs";
import { manaState, spendMP, restoreMP } from "./engine.mjs";
import { identityFor } from "./tab.mjs";

/** Engine refusal reason → toast key (only the reasons the MP input can hit). */
const REASON_KEYS = {
  "burnout": "VEYL.Reason.Burnout",
  "insufficient-mp": "VEYL.Reason.InsufficientMP"
};

export function bindTabInteractions(app, element) {
  if (element.dataset.veylBound) return;
  element.dataset.veylBound = "1";

  element.addEventListener("click", event => {
    const toggle = event.target.closest("[data-veyl-toggle]");
    if (toggle && toggle.closest(".veyl-tab")) {
      event.stopPropagation();
      onToggleExpand(app, toggle);
      return;
    }
    const post = event.target.closest("[data-veyl-post]");
    if (post && post.closest(".veyl-tab")) {
      event.stopPropagation();
      onPostCard(app, post);
      return;
    }
    const use = event.target.closest("[data-veyl-use]");
    if (use && use.closest(".veyl-tab")) {
      event.stopPropagation();
      onUseAbility(app, use, event);
      return;
    }
    const meter = event.target.closest("[data-veyl-mp-meter]");
    if (meter && meter.closest(".veyl-tab") && !event.target.closest("[data-veyl-mp-input]")) {
      event.stopPropagation();
      onToggleMpMeter(meter);
    }
  });

  // v0.9 change delegation. The bubbling change also reaches the sheet's own
  // submitOnChange handler — the sheet root IS the <form>, and stopPropagation
  // cannot suppress a same-node sibling listener — which is an accepted no-op
  // per design §6.4: the MP input carries no name, so that submit's diff is
  // empty, and <slide-toggle> is not a named form element either.
  element.addEventListener("change", event => {
    const input = event.target.closest("[data-veyl-mp-input]");
    if (input && input.closest(".veyl-tab")) {
      event.stopPropagation();
      onMpInputChange(app, input);
      return;
    }
    const echo = event.target.closest("[data-veyl-echo-toggle]");
    if (echo && echo.closest(".veyl-tab")) {
      event.stopPropagation();
      // Spike finding: dnd5e's CheckboxElement has no disabled guard in its
      // click handler (unlike ProficiencyCycleElement), and form-associated
      // custom elements are not click-suppressed by the browser — a blocked
      // toggle still flips its DOM state and fires change. Snap it back
      // silently; the design intends an inert control, not a refusal toast.
      if (echo.hasAttribute("disabled")) return void app.render();
      onEchoToggle(app, echo);
    }
  });

  // Blur without a committed change restores the label (a committed change
  // re-renders the whole part anyway, which rebuilds both nodes hidden/shown
  // as fresh context dictates).
  element.addEventListener("focusout", event => {
    const input = event.target.closest?.("[data-veyl-mp-input]");
    if (input && input.closest(".veyl-tab")) {
      onToggleMpMeter(input.closest("[data-veyl-mp-meter]"), false);
    }
  });
}

/**
 * Flip one row's expansion. State is a per-sheet-instance Set consumed by
 * prepareFrameworkContext at render time (so partial re-renders keep open
 * rows open), never stored on any document, and discarded on reload.
 */
function onToggleExpand(app, target) {
  const li = target.closest("li.item");
  const id = li?.dataset.itemId;
  if (!id) return;
  const expanded = app._veylExpanded ??= new Set();
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);
  li.classList.toggle("veyl-collapsed", !expanded.has(id));
}

/**
 * Replicate dnd5e's #toggleMeter on the MP bar: swap the label for the input
 * on click (focus + select), swap back on blur. Purely cosmetic — the write
 * happens in onMpInputChange.
 */
function onToggleMpMeter(meter, editing = true) {
  if (!meter) return;
  const label = meter.querySelector(":scope > .label");
  const input = meter.querySelector("[data-veyl-mp-input]");
  if (!label || !input) return;
  label.hidden = editing;
  input.hidden = !editing;
  if (editing) {
    input.focus();
    input.select();
  }
}

/**
 * Commit the MP input with dnd5e's parseInputDelta semantics (+N / -N / =N /
 * plain N), applied against the AVAILABLE pool the label displays. The
 * resulting delta routes through the engine — spendMP guards affordability,
 * restoreMP refuses during Burnout and clamps to max (design §9) — and a
 * refusal toasts and re-renders so the display snaps back.
 */
async function onMpInputChange(app, input) {
  const actor = app.actor ?? app.document;
  const identity = identityFor(actor, "magecraft");
  if (!identity) return;
  const state = manaState(identity);
  const raw = input.value.trim();
  let target;
  if (/^[+-]/.test(raw)) target = state.available + Number(raw);
  else if (raw.startsWith("=")) target = Number(raw.slice(1));
  else target = Number(raw);
  if (!Number.isFinite(target)) return void app.render();
  const delta = Math.round(target) - state.available;
  if (!delta) return void app.render();
  const result = delta < 0
    ? await spendMP(identity, -delta)
    : await restoreMP(identity, delta);
  if (!result.ok) {
    ui.notifications.warn(game.i18n.localize(REASON_KEYS[result.reason] ?? "VEYL.Reason.InsufficientMP"));
    app.render();
  }
}
