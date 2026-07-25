/**
 * Post-render DOM work on the character sheet:
 *  1. Inject one identity pill per framework held into the Features page,
 *     styled on the native class pill skeleton (verified by spike), with a
 *     context menu carrying the identity's Edit and Delete actions.
 *  2. Hide framework items from the native Features list, where they otherwise
 *     land in dnd5e's uncategorized "Other Features" bucket (Phase 4).
 *  3. Enforce per-actor tab visibility. TABS/PARTS are class-wide statics, so
 *     every sheet renders our parts; sheets for actors that do not hold a
 *     framework get the tab button and section hidden here.
 *
 * All of it runs from the renderCharacterActorSheet hook, which the spike
 * verified fires reliably and survives re-renders.
 */

import { MODULE_ID, FRAMEWORK_TABS, frameworkItems, identityFor } from "./tab.mjs";
import { bindTabInteractions } from "./expand.mjs";

const esc = s => Handlebars.escapeExpression(s ?? "");

export function onRenderCharacterSheet(app, element) {
  const actor = app.actor ?? app.document;
  if (!actor) return;
  injectPills(actor, element);
  bindPillMenu(app, element);
  hideFrameworkFeatures(actor, element);
  enforceTabVisibility(app, actor, element);
  bindTabInteractions(app, element);
}

function injectPills(actor, element) {
  const pills = element.querySelector("section.classes.pills-lg");
  if (!pills) return;

  // Idempotent: partial renders can leave prior pills in place.
  pills.querySelectorAll("[data-veyl-pill]").forEach(el => el.remove());

  for (const identity of frameworkItems(actor)) {
    const fw = FRAMEWORK_TABS.find(f => f.id === identity.system.framework);
    const abl = identity.system.ability;
    const abbr = (CONFIG.DND5E?.abilities?.[abl]?.abbreviation ?? abl).toUpperCase();

    const pill = document.createElement("div");
    pill.className = "class pill-lg veyl-pill";
    pill.dataset.veylPill = identity.id;
    pill.innerHTML = `
      <div class="icons"><img class="gold-icon" src="${esc(identity.img)}" alt=""></div>
      <div class="name-stacked">
        <div class="title">${esc(game.i18n.localize(fw?.label ?? identity.system.framework))}</div>
        <div class="subtitle">${esc(identity.system.craftName || identity.name)}</div>
      </div>
      <div class="level">${esc(abbr)}</div>`;

    // Real-module behavior per spec: the pill opens the identity item's sheet,
    // which is the one place for name, icon, ability, and framework.
    pill.addEventListener("click", () => identity.sheet.render(true));
    pills.append(pill);
  }
}

/**
 * Context menu on the identity pill (Edit / Delete). The pill is the only
 * handle on the identity item once hideFrameworkFeatures takes its row out of
 * the Features list, so this is what keeps it reachable.
 *
 * Bound through ApplicationV2's own _createContextMenu, which delegates by
 * selector and therefore survives the pills being rebuilt on every render.
 * Guarded to bind once per application instance: the root element persists
 * across partial re-renders, so binding per render would stack duplicates.
 */
function bindPillMenu(app, element) {
  if (app._veylPillMenu || typeof app._createContextMenu !== "function") return;
  try {
    app._veylPillMenu = app._createContextMenu(
      () => pillMenuItems(app), "[data-veyl-pill]",
      { hookName: "VeylPillContext", parentClassHooks: false, fixed: true }
    ) ?? true;
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not bind the identity pill context menu`, err);
  }
}

function pillMenuItems(app) {
  const identityFrom = target => (app.actor ?? app.document)?.items.get(target.dataset.veylPill);
  return [
    {
      name: "VEYL.Edit",
      icon: '<i class="fa-solid fa-pen-to-square"></i>',
      callback: target => identityFrom(target)?.sheet.render(true)
    },
    {
      name: "VEYL.Delete",
      icon: '<i class="fa-solid fa-trash"></i>',
      callback: target => identityFrom(target)?.deleteDialog()
    }
  ];
}

/**
 * Keep our items out of dnd5e's Features list. They have their own tab, and
 * with no dnd5e feature metadata they fall into the uncategorized "Other
 * Features" bucket (Phase 2 gate note 3).
 *
 * Ability items are hidden only when their framework's identity is held. An
 * orphaned ability (identity deleted, so its tab is hidden too) stays visible
 * here, because otherwise it would be reachable from nowhere at all.
 *
 * Hide, never remove: same reason as enforceTabVisibility below.
 */
function hideFrameworkFeatures(actor, element) {
  const features = element.querySelector(
    '[data-application-part="features"], .tab[data-tab="features"]'
  );
  if (!features) return;

  const hidden = new Set();
  for (const item of actor.items) {
    if (item.type === `${MODULE_ID}.framework`) hidden.add(item.id);
    else if (item.type === `${MODULE_ID}.ability`
      && identityFor(actor, item.system.framework)) hidden.add(item.id);
  }

  for (const section of features.querySelectorAll(".items-section")) {
    const rows = section.querySelectorAll("li.item[data-item-id]");
    let hiddenRows = 0;
    for (const row of rows) {
      const hide = hidden.has(row.dataset.itemId);
      row.classList.toggle("veyl-hidden", hide);
      if (hide) hiddenRows++;
    }
    // Only collapse a section we emptied ourselves; dnd5e owns its own empty
    // sections, and a section that regains a native row must come back.
    section.classList.toggle("veyl-hidden", rows.length > 0 && hiddenRows === rows.length);
  }
}

function enforceTabVisibility(app, actor, element) {
  let activeHidden = false;

  for (const fw of FRAMEWORK_TABS) {
    const held = !!identityFor(actor, fw.id);

    // Hide rather than remove: ApplicationV2 manages part elements across
    // partial re-renders, and removing them risks breaking that bookkeeping.
    const nav = element.querySelectorAll(`nav [data-tab="${fw.id}"], a[data-tab="${fw.id}"]`);
    const part = element.querySelector(`[data-application-part="${fw.id}"]`);
    nav.forEach(el => el.classList.toggle("veyl-hidden", !held));
    part?.classList.toggle("veyl-hidden", !held);

    if (!held && app.tabGroups?.primary === fw.id) activeHidden = true;
  }

  // If the framework item was deleted while its tab was open, fall back to a
  // native tab so the sheet is not left on an empty body.
  if (activeHidden) {
    try { app.changeTab("details", "primary"); }
    catch (err) { console.warn(`${MODULE_ID} | Could not change away from hidden tab`, err); }
  }
}
