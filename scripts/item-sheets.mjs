/**
 * Dedicated item sheets for the two custom subtypes.
 *
 * Both subclass dnd5e's ItemSheet5e (verified against dnd5e 5.2.4 source):
 * the entire Phase 1 crash surface was the static TABS conditions, which read
 * dnd5e system metadata our TypeDataModels lack (itemHasEffects reads
 * item.system.constructor.metadata.hasEffects). Replacing TABS and PARTS
 * wholesale removes it, and everything else in the chain is type-agnostic,
 * so subclassing inherits the native window chrome, Play/Edit mode slider,
 * submitOnChange form plumbing, prose-mirror wiring, and the .dnd5e2.sheet.item
 * stylesheet for free (dnd5e scopes item sheet CSS to those generic classes).
 *
 * Classes are built inside registerVeylSheets() at init, not at module
 * evaluation, so the dnd5e base class lookup stays defensive (same pattern as
 * getCharacterSheetClass in main.mjs).
 */

import { MODULE_ID, FRAMEWORK_TABS } from "./tab.mjs";
import {
  LEGAL_ABILITIES, LEGAL_DISCIPLINES, RALLY_BENEFITS, DEEPENING_LEVELS
} from "./models.mjs";

/**
 * The four cross-framework discipline pairs. Each pair shares one rule shape,
 * so the ability sheet renders by group, not by individual discipline:
 *  - reserve (Echo/Stance): Signature plus Deepenings; sustained by held resources.
 *  - enhance (Augment/Boost): rides a named trigger; base effect, per step, evolutions.
 *  - active (Channel/Strike): own activation; reaction plus trigger makes a Counter.
 *  - climax (Surge/Apex): base effect, Amplify, Masteries (stored as deepenings).
 */
const DISCIPLINE_GROUPS = {
  echo: "reserve", stance: "reserve",
  augment: "enhance", boost: "enhance",
  channel: "active", strike: "active",
  surge: "climax", apex: "climax"
};

/**
 * Rule-fixed activations. Channels and Strikes are absent on purpose: they are
 * the only disciplines whose activation is the player's choice.
 */
const FIXED_ACTIVATION = {
  echo: "action", stance: "bonus",
  augment: "none", boost: "none",
  surge: "action", apex: "action"
};

/** Evolution threshold ordinal (1/2/3) to the step it crosses (3/6/9). */
const THRESHOLD_STEPS = { 1: 3, 2: 6, 3: 9 };

/**
 * Build and register both sheet classes. Called from the init hook in
 * main.mjs; module init callbacks run after the system's, so the per-type
 * makeDefault registrations here supersede dnd5e's untyped default.
 */
export function registerVeylSheets() {
  const Base = globalThis.dnd5e?.applications?.item?.ItemSheet5e;
  if (!Base) {
    console.error(`${MODULE_ID} | dnd5e ItemSheet5e not found; item sheets not registered.`);
    return;
  }

  class VeylItemSheetBase extends Base {
    static DEFAULT_OPTIONS = {
      classes: ["veyl-item-sheet"],
      actions: {
        addArrayRow: VeylItemSheetBase.#addArrayRow,
        deleteArrayRow: VeylItemSheetBase.#deleteArrayRow
      },
      position: { width: 560, height: 620 },
      window: { resizable: true }
    };

    /**
     * No dnd5e tabs: every TABS condition assumes dnd5e system data (the
     * Phase 1 hasEffects TypeError), so these sheets are a single always
     * visible body part under the shared dnd5e header.
     */
    static TABS = [];

    /** @override */
    tabGroups = {};

    /** Localized label of the item's framework. */
    _frameworkLabel() {
      const tab = FRAMEWORK_TABS.find(t => t.id === this.item.system.framework);
      return game.i18n.localize(tab?.label ?? this.item.system.framework);
    }

    /**
     * Subtitle line rendered by dnd5e's header template (play mode only; in
     * edit mode the header shows the name input, as dnd5e itself does).
     */
    _subtitle() {
      return this._frameworkLabel();
    }

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
      context = await super._preparePartContext(partId, context, options);
      if (partId === "header") context.subtitles = [{ label: this._subtitle() }];
      return context;
    }

    /** @inheritDoc */
    async _onFirstRender(context, options) {
      await super._onFirstRender(context, options);
      // PrimarySheetMixin appends a create-child button wired to activities,
      // advancement, and effects; none of those exist on these sheets.
      this.element.querySelector(".create-child")?.remove();
    }

    /** Enrich one HTML field for display, following dnd5e's enrichment options. */
    async _enrich(value) {
      const TextEditor = foundry.applications.ux.TextEditor.implementation;
      return TextEditor.enrichHTML(value ?? "", {
        secrets: this.item.isOwner,
        relativeTo: this.item,
        rollData: this.item.getRollData?.() ?? {}
      });
    }

    /**
     * Append a blank row to the ArrayField named by data-array (dnd5e's
     * uses.recovery pattern, parameterized). Every rendered row resubmits with
     * the form, so replacing the whole array is lossless.
     */
    static #addArrayRow(event, target) {
      const path = target.dataset.array;
      const rows = foundry.utils.getProperty(this.item.system.toObject(), path) ?? [];
      return this.submit({ updateData: { [`system.${path}`]: [...rows, {}] } });
    }

    /** Remove the row identified by the closest data-index. */
    static #deleteArrayRow(event, target) {
      const path = target.dataset.array;
      const rows = foundry.utils.getProperty(this.item.system.toObject(), path) ?? [];
      const index = Number(target.closest("[data-index]")?.dataset.index);
      if (Number.isNaN(index)) return;
      rows.splice(index, 1);
      return this.submit({ updateData: { [`system.${path}`]: rows } });
    }
  }

  /** Sheet for the identity item (veyl-frameworks.framework). */
  class VeylFrameworkSheet extends VeylItemSheetBase {
    static PARTS = {
      header: { template: "systems/dnd5e/templates/items/header.hbs" },
      body: {
        template: `modules/${MODULE_ID}/templates/framework-sheet.hbs`,
        scrollable: [""]
      }
    };

    /** @override */
    _subtitle() {
      const craft = this.item.system.craftName;
      return craft ? `${this._frameworkLabel()}, ${craft}` : this._frameworkLabel();
    }

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
      context = await super._preparePartContext(partId, context, options);
      if (partId !== "body") return context;
      const fw = this.item.system.framework;
      context.isArts = fw === "arts";
      context.frameworkOptions = FRAMEWORK_TABS.map(t => ({
        value: t.id, label: game.i18n.localize(t.label)
      }));
      context.abilityOptions = (LEGAL_ABILITIES[fw] ?? []).map(value => ({
        value, label: CONFIG.DND5E?.abilities?.[value]?.label ?? value
      }));
      context.rallyOptions = RALLY_BENEFITS.map(value => ({
        value, label: game.i18n.localize(`VEYL.Rally.${value}`)
      }));
      return context;
    }

    /** @inheritDoc */
    _processFormData(event, form, formData) {
      const submitData = super._processFormData(event, form, formData);
      const sys = submitData.system ?? {};
      const fw = sys.framework ?? this.item.system.framework;
      const legal = LEGAL_ABILITIES[fw] ?? [];
      const ability = sys.ability ?? this.item.system.ability;
      if (!legal.includes(ability)) {
        // The form only offered the previous framework's triad, so a framework
        // switch submits a stale ability that validateJoint would reject.
        // Carry the choice across by position (int/str, wis/dex, cha/con).
        const other = LEGAL_ABILITIES[fw === "magecraft" ? "arts" : "magecraft"];
        foundry.utils.setProperty(
          submitData, "system.ability", legal[other.indexOf(ability)] ?? legal[0]
        );
      }
      return submitData;
    }
  }

  /** Sheet for the ability item (veyl-frameworks.ability). */
  class VeylAbilitySheet extends VeylItemSheetBase {
    static PARTS = {
      header: { template: "systems/dnd5e/templates/items/header.hbs" },
      body: {
        template: `modules/${MODULE_ID}/templates/ability-sheet.hbs`,
        scrollable: [""]
      }
    };

    /** @override */
    _subtitle() {
      const label = game.i18n.localize(`VEYL.Discipline.${this.item.system.discipline}`);
      return `${this._frameworkLabel()}, ${label}`;
    }

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
      context = await super._preparePartContext(partId, context, options);
      if (partId !== "body") return context;
      const sys = this.item.system;
      const group = DISCIPLINE_GROUPS[sys.discipline];

      context.frameworkOptions = FRAMEWORK_TABS.map(t => ({
        value: t.id, label: game.i18n.localize(t.label)
      }));
      context.disciplineOptions = (LEGAL_DISCIPLINES[sys.framework] ?? []).map(value => ({
        value, label: game.i18n.localize(`VEYL.Discipline.${value}`)
      }));
      context.activationOptions = ["action", "bonus", "reaction"].map(value => ({
        value, label: game.i18n.localize(`VEYL.Activation.${value}`)
      }));
      context.thresholdOptions = [1, 2, 3].map(value => ({
        value, label: game.i18n.format("VEYL.ThresholdStep", { step: THRESHOLD_STEPS[value] })
      }));
      context.levelOptions = DEEPENING_LEVELS.map(value => ({
        value, label: game.i18n.format("VEYL.DeepeningLevel", { level: value })
      }));

      // Section visibility per discipline group. A select change submits, the
      // item updates, and the re-render branches here: dnd5e's own conditional
      // field mechanism, no custom listeners.
      context.show = {
        activation: group === "active",
        trigger: group === "enhance" || (group === "active" && sys.activation === "reaction"),
        duration: group === "enhance" || group === "active",
        baseEffect: group !== "reserve",
        perStep: group === "enhance" || group === "active",
        evolutions: group === "enhance" || group === "active",
        signature: group === "reserve",
        amplify: group === "climax",
        deepenings: group === "reserve" || group === "climax"
      };
      context.groupHint = `VEYL.Hint.${group}`;

      context.enriched = {
        baseEffect: await this._enrich(sys.baseEffect),
        signature: await this._enrich(sys.signature),
        amplify: await this._enrich(sys.amplify)
      };
      context.evolutionRows = await Promise.all((context.source.evolutions ?? [])
        .map(async (row, index) => ({
          index,
          prefix: `system.evolutions.${index}.`,
          threshold: row.threshold,
          text: row.text,
          enriched: await this._enrich(row.text)
        })));
      context.deepeningRows = await Promise.all((context.source.deepenings ?? [])
        .map(async (row, index) => ({
          index,
          prefix: `system.deepenings.${index}.`,
          level: row.level,
          text: row.text,
          enriched: await this._enrich(row.text)
        })));
      return context;
    }

    /** @inheritDoc */
    _processFormData(event, form, formData) {
      const submitData = super._processFormData(event, form, formData);
      const sys = submitData.system ?? {};
      const fw = sys.framework ?? this.item.system.framework;
      const legal = LEGAL_DISCIPLINES[fw] ?? [];
      let discipline = sys.discipline ?? this.item.system.discipline;
      if (!legal.includes(discipline)) {
        // Same stale-select problem as the identity sheet: carry the choice
        // across by position (echo/stance, augment/boost, channel/strike,
        // surge/apex).
        const other = LEGAL_DISCIPLINES[fw === "magecraft" ? "arts" : "magecraft"];
        discipline = legal[other.indexOf(discipline)] ?? legal[0];
        foundry.utils.setProperty(submitData, "system.discipline", discipline);
      }
      // Keep the stored activation rule-consistent (the Time column on the
      // framework tab reads it): fixed for every discipline except Channels
      // and Strikes, where "none" is never legal.
      const fixed = FIXED_ACTIVATION[discipline];
      const activation = sys.activation ?? this.item.system.activation;
      if (fixed) foundry.utils.setProperty(submitData, "system.activation", fixed);
      else if (activation === "none") foundry.utils.setProperty(submitData, "system.activation", "action");
      return submitData;
    }
  }

  const { DocumentSheetConfig } = foundry.applications.apps;
  const types = {
    framework: VeylFrameworkSheet,
    ability: VeylAbilitySheet
  };
  // Remove dnd5e's crashing default from our types entirely (it registers
  // ItemSheet5e with makeDefault and no types filter, so it covers module
  // subtypes too), then register ours as the per-type defaults.
  DocumentSheetConfig.unregisterSheet(Item, "dnd5e", Base, {
    types: Object.keys(types).map(t => `${MODULE_ID}.${t}`)
  });
  for (const [subtype, cls] of Object.entries(types)) {
    DocumentSheetConfig.registerSheet(Item, MODULE_ID, cls, {
      types: [`${MODULE_ID}.${subtype}`],
      makeDefault: true,
      label: `VEYL.Sheet.${subtype === "framework" ? "Framework" : "Ability"}`
    });
  }
}
