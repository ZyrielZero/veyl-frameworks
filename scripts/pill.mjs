/**
 * Post-render DOM work on the character sheet:
 *  1. Inject one identity pill per framework held into the Features page,
 *     styled on the native class pill skeleton (verified by spike).
 *  2. Enforce per-actor tab visibility. TABS/PARTS are class-wide statics, so
 *     every sheet renders our parts; sheets for actors that do not hold a
 *     framework get the tab button and section hidden here.
 *
 * Both run from the renderCharacterActorSheet hook, which the spike verified
 * fires reliably and survives re-renders.
 */

import { MODULE_ID, FRAMEWORK_TABS, frameworkItems, identityFor } from "./tab.mjs";
import { bindTabInteractions } from "./expand.mjs";

const esc = s => Handlebars.escapeExpression(s ?? "");

export function onRenderCharacterSheet(app, element) {
  const actor = app.actor ?? app.document;
  if (!actor) return;
  injectPills(actor, element);
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
