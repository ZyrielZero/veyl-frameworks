/**
 * Use-time flow (v0.9, design §7): click → guard → picker → single engine
 * spend → born-spent receipt card.
 *
 * MP is spent at picker-confirm time, BEFORE any message exists (§7.0): the
 * receipt renders from immutable creation-time flags and cannot exist unless
 * payment succeeded — never a half-spend. Receipt numbers are historical
 * (step, cost, DC frozen at cast); roll modifiers stay live on the card's
 * buttons (chat.mjs recomputes at click time).
 *
 * The inFlight set is the single-client double-spend guard (design §4);
 * cross-client concurrency is a documented limitation. Every entry point
 * re-fetches identity/item by id off fresh actor.items — never cached refs.
 */

import {
  DISCIPLINE_GROUPS, THRESHOLD_STEPS, MP_COSTS, unlockedStep
} from "./models.mjs";
import {
  manaState, checkStrain, activateAbility, activateEcho, collapseEcho,
  activateSurge, EFFECT_IDS
} from "./engine.mjs";
import {
  MODULE_ID, identityFor, abilityItemsFor, buildAbilitySummary, comparableLevel
} from "./tab.mjs";
import { VeylEmpowerDialog, VeylSurgeDialog } from "./dialogs.mjs";

/** Engine refusal reason → localized toast key (design §9 enforcement matrix). */
const REASON_KEYS = {
  "burnout": "VEYL.Reason.Burnout",
  "locked-step": "VEYL.Reason.LockedStep",
  "strained": "VEYL.Reason.Strained",
  "insufficient-mp": "VEYL.Reason.InsufficientMP",
  "level": "VEYL.Reason.Level",
  "amplify-shortfall": "VEYL.Reason.AmplifyShortfall",
  "insufficient-hp": "VEYL.Reason.InsufficientHP"
};

/** Toast one refusal reason; returns undefined so callers can `return warn(...)`. */
function warnReason(reason) {
  ui.notifications.warn(game.i18n.localize(REASON_KEYS[reason] ?? "VEYL.Reason.InsufficientMP"));
}

/**
 * Per-client double-spend guard, keyed by identity uuid: a second click on any
 * activation path while one is committing is dead on arrival (design §7.2).
 */
const inFlight = new Set();

/* -------------------------------------------- */
/*  Entry points                                */
/* -------------------------------------------- */

/** Delegated handler for the per-row use control ([data-veyl-use]). */
export async function onUseAbility(app, target, event) {
  const li = target.closest("li.item");
  const actor = app.actor ?? app.document;
  const item = actor?.items.get(li?.dataset.itemId);
  if (!item) return;
  await useAbility(item, event);
}

/**
 * Delegated handler for the Echo slide-toggle ([data-veyl-echo-toggle]). The
 * toggle's checked state is the DESIRED state (the change already happened in
 * the DOM); a refusal posts nothing, and the re-render snaps it back to the
 * document truth.
 */
export async function onEchoToggle(app, toggle) {
  const actor = app.actor ?? app.document;
  const identity = identityFor(actor, "magecraft");
  if (!identity) return;
  const desired = !!toggle.checked;
  if (desired === identity.system.echoActive) return;
  const echoItem = abilityItemsFor(actor, "magecraft")
    .find(i => i.system.discipline === "echo") ?? null;
  const posted = await commitUse(actor, echoItem?.id ?? null, {
    kind: "echo", action: desired ? "activate" : "collapse"
  });
  if (!posted) app.render();
}

/**
 * The shared use flow (sheet row and reference-card Use both land here).
 * Guard #1 (advisory, the engine re-validates at commit): ownership and
 * Burnout, except that collapsing an active Echo is never blocked (design
 * §9). Then the discipline router: echo flips state directly, surge and the
 * empower disciplines go through their pickers — skipped when exactly one
 * step is legal, or fast-pathed to step 1 on shift/ctrl-click (dnd5e
 * convention, design §6.3).
 *
 * @param {Item} item          The ability item being used (fresh reference).
 * @param {PointerEvent} [event]  The originating click, for fast-path keys.
 * @returns {Promise<ChatMessage|null|undefined>}
 */
export async function useAbility(item, event) {
  const actor = item.actor;
  if (!actor || item.system.framework !== "magecraft") return null;
  if (!item.isOwner) {
    ui.notifications.warn(game.i18n.localize("VEYL.NotOwner"));
    return null;
  }
  const identity = identityFor(actor, "magecraft");
  if (!identity) return null;
  const discipline = item.system.discipline;
  const state = manaState(identity);

  if (discipline === "echo") {
    // No picker (design §6.3): the row control mirrors the sheet toggle.
    return commitUse(actor, item.id, {
      kind: "echo", action: state.echoActive ? "collapse" : "activate"
    });
  }

  if (state.burnedOut) return warnReason("burnout");

  if (discipline === "surge") {
    // Advisory mirror of the engine's level >= 5 gate (design §1: the Surge
    // is gained at 5th; item presence is not the gate). Without it a stale
    // reference-card Use opens a fully configurable dialog only to refuse at
    // commit; the engine re-checks regardless.
    if (state.level < 5) return warnReason("level");
    const choice = await VeylSurgeDialog.prompt({ identity, item });
    if (!choice) return null;
    return commitUse(actor, item.id, { kind: "surge", ...choice });
  }

  // Augment / Channel: count the legal steps to decide whether the picker is
  // even needed. The same three gates the dialog rows use (unlock,
  // affordability, strain); the engine re-checks all of them at commit.
  const group = DISCIPLINE_GROUPS[discipline];
  const legal = [];
  for (let step = 1; step <= unlockedStep(state.level); step++) {
    if (checkStrain(identity, group, step).locked) continue;
    if (MP_COSTS[step] > state.available) continue;
    legal.push(step);
  }
  let step;
  if (event?.shiftKey || event?.ctrlKey || event?.metaKey) {
    // Fast path: step 1, refused with its own reason when illegal.
    if (!legal.includes(1)) {
      return warnReason(checkStrain(identity, group, 1).locked ? "strained" : "insufficient-mp");
    }
    step = 1;
  } else if (legal.length === 1) {
    step = legal[0];
  } else {
    // Zero legal steps still opens the picker: it renders every row with its
    // blocked reason and a disabled confirm, which beats a bare toast.
    step = await VeylEmpowerDialog.prompt({ identity, item });
    if (step == null) return null;
  }
  return commitUse(actor, item.id, { kind: "ability", step });
}

/* -------------------------------------------- */
/*  Commit                                      */
/* -------------------------------------------- */

/**
 * Guard #2 + spend + receipt (design §7.2). Re-fetches identity and item by
 * id, takes the inFlight lock, runs the ONE engine transition, and posts the
 * receipt only if payment succeeded. The DC and Attunement pill freeze from
 * the PRE-spend state (a cast's DC is a property of the casting; a Surge that
 * ends the Echo was still cast attuned).
 *
 * @param {Actor} actor
 * @param {string|null} itemId  Ability item id (null only for the Echo toggle
 *                              when no echo ability item exists).
 * @param {object} choice       { kind: "ability", step } |
 *                              { kind: "surge", increments, collapse } |
 *                              { kind: "echo", action: "activate"|"collapse" }
 * @returns {Promise<ChatMessage|null|undefined>}
 */
export async function commitUse(actor, itemId, choice) {
  const item = itemId ? actor.items.get(itemId) : null;
  const identity = identityFor(actor, "magecraft");
  if (!identity) return null;
  const key = identity.uuid;
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  try {
    const pre = manaState(identity);
    const abl = identity.system.ability;
    // Derived .mod IS the attuned modifier (Attunement is an ActiveEffect on
    // the score, design §5); frozen here for the receipt's save DC.
    const mod = actor.system.abilities?.[abl]?.mod ?? 0;
    const prof = actor.system.attributes?.prof ?? 0;

    switch (choice.kind) {
      case "ability": {
        if (!item) return void ui.notifications.warn(game.i18n.localize("VEYL.MissingCardItem"));
        const result = await activateAbility(identity, item, { step: choice.step });
        if (!result.ok) return warnReason(result.reason);
        const after = manaState(identity);
        const group = DISCIPLINE_GROUPS[item.system.discipline];
        return postUsageCard(item, identity, {
          discipline: item.system.discipline,
          step: choice.step,
          cost: result.cost,
          csl: comparableLevel(group, choice.step),
          evolutions: result.evolutionsCrossed,
          mpAfter: after.current,
          availableAfter: after.available,
          strainLocked: result.comparable >= 6 ? result.comparable : null,
          attuned: pre.echoActive,
          dc: 8 + prof + mod
        });
      }
      case "surge": {
        if (!item) return void ui.notifications.warn(game.i18n.localize("VEYL.MissingCardItem"));
        const result = await activateSurge(identity, item, {
          increments: choice.increments, collapse: choice.collapse
        });
        if (!result.ok) return warnReason(result.reason);
        const after = manaState(identity);
        const echoCollapsed = pre.echoActive && !!choice.collapse;
        return postUsageCard(item, identity, {
          discipline: "surge",
          increments: choice.increments,
          breakdown: result.breakdown,
          echoCollapsed,
          echoReturned: echoCollapsed ? result.breakdown.freedByCollapse : 0,
          mpAfter: after.current,
          availableAfter: after.available,
          attuned: pre.echoActive,
          dc: 8 + prof + mod
        });
      }
      case "echo": {
        // Stale toggle/row (state moved under the click): post nothing; the
        // caller's re-render reconciles the display.
        if (choice.action === "collapse") {
          if (!pre.echoActive) return null;
          const { freed } = await collapseEcho(identity);
          const after = manaState(identity);
          return postUsageCard(item ?? identity, identity, {
            discipline: "echo", echoAction: "collapse", freed,
            mpAfter: after.current, availableAfter: after.available, attuned: false
          });
        }
        if (pre.echoActive) return null;
        const result = await activateEcho(identity, item);
        if (!result.ok) return warnReason(result.reason);
        const after = manaState(identity);
        return postUsageCard(item ?? identity, identity, {
          discipline: "echo", echoAction: "activate", reserved: after.reserved,
          mpAfter: after.current, availableAfter: after.available, attuned: true
        });
      }
    }
    return null;
  } finally {
    inFlight.delete(key);
  }
}

/* -------------------------------------------- */
/*  Receipt card                                */
/* -------------------------------------------- */

/** The receipt's cost line, itemizing each MP once by origin (design §7.6). */
function buildReceiptLine(receipt) {
  switch (receipt.discipline) {
    case "surge": {
      const bd = receipt.breakdown;
      const parts = [game.i18n.format(
        receipt.increments === 1 ? "VEYL.Surge.Receipt.One" : "VEYL.Surge.Receipt.Many",
        { n: receipt.increments, total: bd.mpCost, paid: bd.mpPaid }
      )];
      if (bd.hpPaid > 0) {
        parts.push(game.i18n.format("VEYL.Surge.Receipt.HP", { hp: bd.hpPaid, mp: bd.shortfall }));
      }
      if (receipt.echoCollapsed) {
        parts.push(game.i18n.format("VEYL.Surge.Receipt.Collapsed", { mp: receipt.echoReturned }));
      }
      parts.push(game.i18n.format("VEYL.Surge.Receipt.Remaining", { after: receipt.availableAfter }));
      return parts.join(" — ");
    }
    case "echo":
      return receipt.echoAction === "activate"
        ? game.i18n.format("VEYL.Receipt.EchoActivate", {
            mp: receipt.reserved, after: receipt.availableAfter
          })
        : game.i18n.format("VEYL.Receipt.EchoCollapse", {
            mp: receipt.freed, after: receipt.availableAfter
          });
    default:
      return game.i18n.format("VEYL.Receipt.Use", {
        cost: receipt.cost, step: receipt.step, csl: receipt.csl,
        after: receipt.availableAfter
      });
  }
}

/**
 * Post the born-spent receipt card (design §7.1/§7.3). Called only after a
 * successful engine transition; everything baked here is immutable history —
 * the card's roll buttons recompute their modifiers live in chat.mjs.
 *
 * @param {Item} item      The ability item used (the identity stands in for an
 *                         Echo toggle with no echo ability item).
 * @param {Item} identity  The Magecraft framework identity item.
 * @param {object} receipt Assembled by commitUse.
 * @returns {Promise<ChatMessage>}
 */
export async function postUsageCard(item, identity, receipt) {
  const actor = item.actor;
  const sys = item.system;
  const isAbility = item.type === `${MODULE_ID}.ability`;
  const level = actor.system.details?.level ?? 1;

  // Same summary the reference card renders (meta strip, rich text, amplify);
  // the ladder and full evolution list are not shown on receipts — only the
  // evolutions this use actually crossed (design §7.0).
  const summary = isAbility
    ? await buildAbilitySummary(item, {
        framework: "magecraft", level, strainLocks: [...identity.system.strainLocks]
      })
    : null;
  const TextEditor = foundry.applications.ux.TextEditor.implementation;
  const crossedEvolutions = isAbility
    ? await Promise.all(
        [...(sys.evolutions ?? [])]
          .filter(row => (receipt.evolutions ?? []).includes(row.threshold))
          .sort((a, b) => a.threshold - b.threshold)
          .map(async row => ({
            step: THRESHOLD_STEPS[row.threshold],
            threshold: row.threshold,
            enriched: await TextEditor.enrichHTML(row.text ?? "", {
              secrets: item.isOwner,
              relativeTo: item,
              rollData: item.getRollData?.() ?? {}
            })
          }))
      )
    : [];

  const strainCsl = receipt.strainLocked
    ? game.i18n.localize(`VEYL.CSL.${receipt.strainLocked}`)
    : "";
  const supplements = [];
  if (receipt.strainLocked) {
    supplements.push({
      label: game.i18n.localize("VEYL.Strain.Label"),
      text: game.i18n.format("VEYL.Strain.Supplement", { csl: strainCsl }),
      cls: "veyl-warn"
    });
  }
  if (receipt.discipline === "surge") {
    supplements.push({
      label: game.i18n.localize("VEYL.Burnout.Label"),
      text: game.i18n.format("VEYL.Burnout.Supplement", {
        rounds: receipt.breakdown.burnoutRounds
      }),
      cls: "veyl-warn"
    });
  }

  // Resolution buttons: attack omits data-visibility (owner-only via dnd5e's
  // _displayChatActionButtons); the save is public so targets can roll it.
  const buttons = [];
  const resolution = isAbility ? sys.resolution : "none";
  if (resolution === "attack") {
    buttons.push({
      action: "veyl-attack",
      icon: "fa-solid fa-dice-d20",
      label: game.i18n.localize("VEYL.AttackRoll")
    });
  }
  if (resolution === "save") {
    buttons.push({
      action: "veyl-save",
      visibility: "all",
      icon: "fa-solid fa-shield-heart",
      label: game.i18n.format("VEYL.SaveButton", {
        ability: CONFIG.DND5E?.abilities?.[sys.saveAbility]?.label ?? sys.saveAbility
      }),
      dc: receipt.dc,
      dataset: { ability: sys.saveAbility, dc: receipt.dc }
    });
  }

  const pills = {
    attuned: !!receipt.attuned,
    concentration: isAbility && !!sys.concentration,
    strain: receipt.strainLocked
      ? game.i18n.format("VEYL.Strain.Pill", { csl: strainCsl })
      : ""
  };
  const context = {
    isUse: true,
    name: item.name,
    img: item.img,
    subtitle: `${game.i18n.localize("VEYL.Magecraft")}, `
      + game.i18n.localize(`VEYL.Discipline.${receipt.discipline}`),
    summary,
    crossedEvolutions,
    buttons,
    receiptLine: buildReceiptLine(receipt),
    supplements,
    // Null when no pill applies, so the template skips the footer entirely.
    pills: (pills.attuned || pills.concentration || pills.strain) ? pills : null
  };

  // Immutable creation-time flags (design §7.1); everything else above is
  // baked into the rendered content and never post-hoc mutated.
  const use = {
    discipline: receipt.discipline,
    step: receipt.step ?? null,
    cost: receipt.cost ?? null,
    csl: receipt.csl ?? null,
    evolutions: receipt.evolutions ?? [],
    mpAfter: receipt.mpAfter,
    strainLocked: receipt.strainLocked ?? null,
    attuned: !!receipt.attuned,
    dc: resolution === "save" ? receipt.dc : null,
    saveAbility: resolution === "save" ? sys.saveAbility : null
  };
  if (receipt.echoAction) use.echoAction = receipt.echoAction;
  const flags = {
    itemUuid: item.uuid,
    identityUuid: identity.uuid,
    kind: "use",
    use
  };
  if (receipt.discipline === "surge") {
    const bd = receipt.breakdown;
    flags.surge = {
      increments: receipt.increments,
      totalMP: bd.totalMPValue,
      mpPaid: bd.mpPaid,
      hpPaid: bd.hpPaid,
      echoCollapsed: !!receipt.echoCollapsed,
      echoReturned: receipt.echoReturned ?? 0,
      burnoutRounds: bd.burnoutRounds,
      burnoutEffectId: EFFECT_IDS.burnout
    };
  }

  const content = await foundry.applications.handlebars.renderTemplate(
    `modules/${MODULE_ID}/templates/chat-card.hbs`, context
  );
  return ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { [MODULE_ID]: flags }
  });
}
