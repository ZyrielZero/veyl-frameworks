/**
 * Empowerment and Surge pickers (v0.9, design §6.3).
 *
 * Both are Dialog5e subclasses (native dnd5e2 styling, standard-form content,
 * generic footer for free) and both RETURN the user's choices to the caller —
 * they never spend. use.mjs re-fetches and the engine re-validates at commit,
 * so everything shown here is advisory (design §9): a stale preview refuses at
 * the engine, never half-spends.
 *
 * closeOnSubmit is false on BOTH dialogs (design feasibility fix F1): core
 * _onChangeForm routes every radio/checkbox change through _onSubmitForm, so a
 * closeOnSubmit dialog would vanish on first selection. submitOnChange only
 * stores form state and re-renders the live preview; the explicit footer
 * confirm action resolves the prompt() Promise and closes.
 */

import {
  MP_COSTS, THRESHOLD_STEPS, DISCIPLINE_GROUPS,
  echoReserve, unlockedStep, comparableLevelNumber
} from "./models.mjs";
// READS only (design §2): the dialogs preview from the same engine math the
// commit path uses, so the preview and the eventual spend can never disagree.
import { manaState, checkStrain, surgeCost } from "./engine.mjs";
import { MODULE_ID, comparableLevel } from "./tab.mjs";

/**
 * Shared plumbing for the two pickers: both hold an actor plus identity/item
 * ids and re-fetch by id every read (synthetic-actor delta rebuilds; never
 * cache Item refs — design §2), and both resolve their prompt() Promise from
 * the close event, confirmed or not.
 */
class VeylPickerDialog extends dnd5e.applications.api.Dialog5e {
  constructor(options = {}) {
    super(options);
    this.#actor = options.identity?.actor ?? null;
    this.#identityId = options.identity?.id ?? "";
    this.#itemId = options.item?.id ?? "";
  }

  /** @type {Actor|null} */
  #actor;

  /** @type {string} */
  #identityId;

  /** @type {string} */
  #itemId;

  /** The Magecraft identity item, re-fetched fresh off the actor. */
  get identity() {
    return this.#actor?.items.get(this.#identityId) ?? null;
  }

  /** The ability item being used, re-fetched fresh off the actor. */
  get item() {
    return this.#actor?.items.get(this.#itemId) ?? null;
  }

  /** Whether the footer confirm resolved this dialog (close alone = cancel). */
  confirmed = false;

  /** @override */
  get title() {
    return this.item?.name ?? super.title;
  }

  /**
   * Show the picker and wait for the user. Resolves the subclass's result on
   * confirm, null on any other close (Escape, the window control, a vanished
   * item) — the caller treats null as "cancelled, spend nothing".
   *
   * @param {object} config
   * @param {Item} config.identity  The Magecraft framework identity item.
   * @param {Item} config.item      The ability item being activated.
   * @returns {Promise<*|null>}
   */
  static async prompt({ identity, item }) {
    return new Promise(resolve => {
      const dialog = new this({ identity, item });
      dialog.addEventListener("close", () => resolve(dialog.confirmed ? dialog.result : null), { once: true });
      dialog.render({ force: true });
    });
  }
}

/* -------------------------------------------- */
/*  Empowerment picker                          */
/* -------------------------------------------- */

/**
 * Step selector for Augment/Channel activation. Rows run the full 1-9
 * progression; a row is selectable only when unlocked at the actor's level,
 * affordable from the AVAILABLE pool, and not Strain-locked, with the reason
 * precedence locked-step > strained > insufficient (locked rows stay visible
 * — abilities are known even when unaffordable, design §9). The live preview
 * re-renders the crossed Threshold Evolutions (only those whose step <= the
 * selection) and the cost/strain line on every change.
 */
export class VeylEmpowerDialog extends VeylPickerDialog {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["veyl-empower"],
    window: { subtitle: "VEYL.Empower.Title" },
    position: { width: 420 },
    form: {
      handler: VeylEmpowerDialog.#onSubmit,
      closeOnSubmit: false,
      submitOnChange: true
    },
    actions: { confirm: VeylEmpowerDialog.#onConfirm },
    identity: null,
    item: null
  };

  /** @override */
  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/dialogs/empower.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  /** The currently selected step (null when no step is selectable). */
  #selected = null;

  /** The confirmed choice prompt() resolves with. */
  get result() {
    return this.#selected;
  }

  /* -------------------------------------------- */

  /**
   * Whether a step is currently legal, from live state. Used by the confirm
   * path and the footer; the row build carries the individual flags for its
   * blocked labels.
   */
  #stepSelectable(step) {
    const identity = this.identity;
    const item = this.item;
    if (!identity || !item || !step) return false;
    const state = manaState(identity);
    if (step > unlockedStep(state.level)) return false;
    if (checkStrain(identity, DISCIPLINE_GROUPS[item.system.discipline], step).locked) return false;
    return MP_COSTS[step] <= state.available;
  }

  /**
   * Why the current selection is no longer legal, with the rows' reason
   * precedence (locked-step > strained > insufficient); insufficient also
   * covers the no-selection and vanished-item cases. Only called when
   * #stepSelectable already said no.
   */
  #staleReasonKey() {
    const identity = this.identity;
    const item = this.item;
    const step = this.#selected;
    if (!identity || !item || !step) return "VEYL.Reason.InsufficientMP";
    const state = manaState(identity);
    if (step > unlockedStep(state.level)) return "VEYL.Reason.LockedStep";
    const group = DISCIPLINE_GROUPS[item.system.discipline];
    if (checkStrain(identity, group, step).locked) return "VEYL.Reason.Strained";
    return "VEYL.Reason.InsufficientMP";
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContentContext(context, options) {
    const identity = this.identity;
    const item = this.item;
    if (!identity || !item) return context;
    const state = manaState(identity);
    const group = DISCIPLINE_GROUPS[item.system.discipline];
    const cap = unlockedStep(state.level);

    const steps = [];
    for (let step = 1; step <= 9; step++) {
      const cost = MP_COSTS[step];
      const unlocked = step <= cap;
      const affordable = cost <= state.available;
      const strainLocked = checkStrain(identity, group, step).locked;
      steps.push({
        step,
        cost,
        csl: comparableLevel(group, step),
        cslNumber: comparableLevelNumber(group, step),
        unlocked,
        affordable,
        strainLocked,
        selectable: unlocked && affordable && !strainLocked,
        threshold: step % 3 === 0,
        crossesThresholds: Object.values(THRESHOLD_STEPS).filter(s => s <= step),
        blockedLabel: !unlocked ? game.i18n.localize("VEYL.Blocked.LockedStep")
          : strainLocked ? game.i18n.localize("VEYL.Blocked.Strained")
          : !affordable ? game.i18n.localize("VEYL.Blocked.InsufficientMP")
          : ""
      });
    }

    // Keep the selection legal across re-renders (spends elsewhere can shrink
    // the pool under an open dialog); default to the lowest selectable step.
    if (!steps.some(s => s.step === this.#selected && s.selectable)) {
      this.#selected = steps.find(s => s.selectable)?.step ?? null;
    }
    for (const s of steps) s.selected = s.step === this.#selected;
    const selected = steps.find(s => s.selected) ?? null;

    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const enrich = value => TextEditor.enrichHTML(value ?? "", {
      secrets: item.isOwner,
      relativeTo: item,
      rollData: item.getRollData?.() ?? {}
    });
    // Only evolutions whose threshold step <= the selection (design §6.3,
    // fixing phase-3.md deviation 2: nothing beyond what this cast crosses).
    context.evolutionPreview = await Promise.all(
      [...(item.system.evolutions ?? [])]
        .filter(row => selected && THRESHOLD_STEPS[row.threshold] <= selected.step)
        .sort((a, b) => a.threshold - b.threshold)
        .map(async row => ({
          step: THRESHOLD_STEPS[row.threshold],
          enriched: await enrich(row.text)
        }))
    );

    context.mp = state;
    context.steps = steps;
    context.strainWarning = !!selected && selected.cslNumber >= 6;
    context.costPreview = selected
      ? game.i18n.format("VEYL.Empower.CostPreview", {
          cost: selected.cost,
          before: state.available,
          after: state.available - selected.cost
        }) + (context.strainWarning
          ? ` ${game.i18n.format("VEYL.Empower.StrainLock", { csl: selected.csl })}`
          : "")
      : game.i18n.localize("VEYL.Empower.NoneSelectable");
    return context;
  }

  /** @override */
  async _prepareFooterContext(context, options) {
    context.buttons = [{
      action: "confirm",
      icon: "fa-solid fa-bolt",
      label: "VEYL.Empower.Confirm",
      type: "button",
      disabled: !this.#stepSelectable(this.#selected)
    }];
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Live-preview submit: store the selection, re-render. Never closes (F1).
   * @this {VeylEmpowerDialog}
   */
  static async #onSubmit(event, form, formData) {
    const step = Number(formData.object.step);
    if (Number.isInteger(step) && step >= 1 && step <= 9) this.#selected = step;
    this.render();
  }

  /**
   * Footer confirm: advisory staleness re-check (the engine re-validates the
   * actual spend regardless), then resolve-and-close.
   * @this {VeylEmpowerDialog}
   */
  static async #onConfirm(event, target) {
    if (!this.#stepSelectable(this.#selected)) {
      ui.notifications.warn(game.i18n.localize(this.#staleReasonKey()));
      return void this.render();
    }
    this.confirmed = true;
    this.close();
  }
}

/* -------------------------------------------- */
/*  Surge picker                                */
/* -------------------------------------------- */

/**
 * Amplify selector and payment preview for the Surge. Increment rows run
 * 1..floor(pool / 15) so an unfundable amplification is never offered
 * (ambiguity #7 strict: HP only ever covers the 15 MP minimum's shortfall);
 * the whole breakdown comes from engine surgeCost so preview and spend share
 * one source of truth. HP payment is not opt-in — the warning appears
 * whenever a shortfall exists at 1 increment, escalating (without blocking)
 * when it would drop the caster to exactly 0 HP; an uncoverable shortfall
 * disables confirm entirely. The Burnout preview is always shown — Burnout is
 * the price, never a surprise. When the Echo is up, an inline offer collapses
 * it first so its reserve funds the Surge (the engine folds that collapse
 * into the one spend write).
 */
export class VeylSurgeDialog extends VeylPickerDialog {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["veyl-surge"],
    window: { subtitle: "VEYL.Discipline.surge" },
    position: { width: 420 },
    form: {
      handler: VeylSurgeDialog.#onSubmit,
      closeOnSubmit: false,
      submitOnChange: true
    },
    actions: { confirm: VeylSurgeDialog.#onConfirm },
    identity: null,
    item: null
  };

  /** @override */
  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/dialogs/surge.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  /** Chosen amplification increments (1 = the base Surge). */
  #increments = 1;

  /** Whether to collapse the Echo first so its reserve funds the Surge. */
  #collapseFirst = false;

  /** The confirmed choice prompt() resolves with. */
  get result() {
    return { increments: this.#increments, collapse: this.#collapseFirst };
  }

  /* -------------------------------------------- */

  /** Live breakdown for the current form state (engine surgeCost, pure read). */
  #breakdown() {
    const identity = this.identity;
    if (!identity) return null;
    return surgeCost(identity, { increments: this.#increments, collapse: this.#collapseFirst });
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContentContext(context, options) {
    const identity = this.identity;
    if (!identity) return context;
    const state = manaState(identity);
    const collapse = this.#collapseFirst && state.echoActive;
    const pool = state.available + (collapse ? echoReserve(state.level) : 0);
    // Row 1 always renders (the HP-shortfall path lives there); further rows
    // only while fully MP-fundable, so an illegal amplification is never
    // offered rather than merely disabled (exit test T-G3).
    const maxIncrements = Math.max(1, Math.floor(pool / 15));
    if (this.#increments > maxIncrements) this.#increments = maxIncrements;

    context.options = [];
    for (let n = 1; n <= maxIncrements; n++) {
      const bd = surgeCost(identity, { increments: n, collapse });
      context.options.push({
        n,
        totalCost: bd.mpCost,
        amplifyLabel: n === 1
          ? game.i18n.localize("VEYL.Surge.Base")
          : game.i18n.format("VEYL.Surge.AmplifyN", { n: n - 1 }),
        legal: bd.legal,
        selected: n === this.#increments,
        // Rows past 1 are fully funded by construction, so the only illegal
        // row is the base Surge with an HP shortfall the actor cannot cover.
        blockedLabel: bd.legal ? "" : game.i18n.localize("VEYL.Blocked.InsufficientHP")
      });
    }

    const bd = surgeCost(identity, { increments: this.#increments, collapse });
    context.increments = this.#increments;
    context.mpAvailable = state.available;
    context.echo = { active: state.echoActive, reserve: echoReserve(state.level) };
    context.collapseFirst = this.#collapseFirst;
    context.mpFromPool = bd.mpPaid;
    context.mpFreedByCollapse = bd.freedByCollapse;
    context.mpShort = bd.shortfall;
    context.hpCost = bd.hpPaid;
    context.hpAfter = bd.hpAfter;
    context.totalCost = bd.mpCost;
    context.burnoutRounds = bd.burnoutRounds;
    context.legal = bd.legal;
    // hpAfter of exactly 0 is legal but escalates the warning text (§13 Q1).
    context.hpWarningKey = bd.hpAfter === 0 ? "VEYL.Surge.HPWarningZero" : "VEYL.Surge.HPWarning";
    return context;
  }

  /** @override */
  async _prepareFooterContext(context, options) {
    context.buttons = [{
      action: "confirm",
      icon: "fa-solid fa-fire",
      label: "VEYL.Surge.Confirm",
      type: "button",
      disabled: !(this.#breakdown()?.legal ?? false)
    }];
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Live-preview submit: store increments and the collapse choice, re-render.
   * Never closes (F1).
   * @this {VeylSurgeDialog}
   */
  static async #onSubmit(event, form, formData) {
    const increments = Number(formData.object.increments);
    if (Number.isInteger(increments) && increments >= 1) this.#increments = increments;
    this.#collapseFirst = !!formData.object.collapseFirst;
    this.render();
  }

  /**
   * Footer confirm: advisory staleness re-check (the engine re-validates the
   * actual spend regardless), then resolve-and-close.
   * @this {VeylSurgeDialog}
   */
  static async #onConfirm(event, target) {
    const bd = this.#breakdown();
    if (!(bd?.legal ?? false)) {
      // Same reason split the engine applies to an illegal breakdown (§4).
      ui.notifications.warn(game.i18n.localize(
        (bd && this.#increments > 1 && bd.shortfall > 0)
          ? "VEYL.Reason.AmplifyShortfall"
          : "VEYL.Reason.InsufficientHP"
      ));
      return void this.render();
    }
    this.confirmed = true;
    this.close();
  }
}
