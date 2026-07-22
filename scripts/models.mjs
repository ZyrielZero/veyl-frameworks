/**
 * DataModels for the two custom Item subtypes.
 *
 * These are the SCAFFOLD drafts from the spec. Schema day (Phase 2) walks both
 * rules documents field by field before these are considered final; until then,
 * treat every field here as provisional. They exist now so the subtypes register
 * and the Phase 1 exit test can run.
 */

const fields = foundry.data.fields;

export const FRAMEWORKS = ["magecraft", "arts"];

export const LEGAL_ABILITIES = {
  magecraft: ["int", "wis", "cha"],
  arts: ["str", "dex", "con"]
};

export const LEGAL_DISCIPLINES = {
  magecraft: ["echo", "augment", "channel", "surge"],
  arts: ["stance", "boost", "strike", "apex"]
};

/** Identity item: one per framework held ("Magecraft, Severance"). */
export class FrameworkData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      framework: new fields.StringField({
        required: true, blank: false, initial: "magecraft", choices: FRAMEWORKS
      }),
      craftName: new fields.StringField({ required: true, initial: "" }),
      // Validated against framework in validateJoint below.
      ability: new fields.StringField({
        required: true, blank: false, initial: "int",
        choices: ["int", "wis", "cha", "str", "dex", "con"]
      }),
      // The one-sentence expression of the magic or art (flavor-first anchor).
      sentence: new fields.StringField({ required: true, initial: "" })
    };
  }

  static validateJoint(data) {
    const legal = LEGAL_ABILITIES[data.framework] ?? [];
    if (!legal.includes(data.ability)) {
      throw new Error(
        `veyl-frameworks | Ability "${data.ability}" is not legal for framework "${data.framework}" (legal: ${legal.join(", ")}).`
      );
    }
  }
}

/** Ability item: one per Echo/Augment/Channel/Surge/Stance/Boost/Strike/Apex known. */
export class AbilityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      framework: new fields.StringField({
        required: true, blank: false, initial: "magecraft", choices: FRAMEWORKS
      }),
      discipline: new fields.StringField({
        required: true, blank: false, initial: "channel",
        choices: [...LEGAL_DISCIPLINES.magecraft, ...LEGAL_DISCIPLINES.arts]
      }),
      // Augments, Boosts, and Counter triggers.
      trigger: new fields.StringField({ required: true, initial: "" }),
      activation: new fields.StringField({
        required: true, blank: false, initial: "action",
        choices: ["action", "bonus", "reaction", "none"]
      }),
      // Benchmark bookkeeping (comparable spell level).
      comparableLevel: new fields.NumberField({
        required: true, integer: true, min: 0, initial: 0
      }),
      baseEffect: new fields.HTMLField({ required: true, initial: "" }),
      // The per-step scaling line.
      perStep: new fields.StringField({ required: true, initial: "" }),
      // The three tier-threshold evolutions.
      evolutions: new fields.ArrayField(new fields.SchemaField({
        threshold: new fields.NumberField({
          required: true, integer: true, min: 1, max: 3, initial: 1
        }),
        text: new fields.HTMLField({ required: true, initial: "" })
      })),
      notes: new fields.StringField({ required: true, initial: "" })
    };
  }

  static validateJoint(data) {
    const legal = LEGAL_DISCIPLINES[data.framework] ?? [];
    if (!legal.includes(data.discipline)) {
      throw new Error(
        `veyl-frameworks | Discipline "${data.discipline}" is not legal for framework "${data.framework}" (legal: ${legal.join(", ")}).`
      );
    }
  }
}
