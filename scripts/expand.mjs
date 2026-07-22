/**
 * Delegated click handling for the framework tabs (Phase 3).
 *
 * dnd5e-inventory binds its own per-element listeners to
 * .item-action[data-action] and [data-context-menu] at connect time; our
 * Play-mode name divs carry neither, so they are invisible to dnd5e and
 * handled here instead. One listener on the sheet root: ApplicationV2 keeps
 * the root element across partial re-renders (only part contents are
 * replaced), so binding once with a dataset guard survives every re-render.
 */

import { onPostCard } from "./chat.mjs";

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
