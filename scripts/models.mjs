/**
 * DataModels for the two custom Item subtypes.
 *
 * Finalized on schema day (2026-07-22) against the two rules documents in
 * docs/rules/. Fields hold only what a player authors when designing an
 * identity or ability; everything the rules derive from level, modifier, or
 * proficiency (MP max, DC, attack, costs, holds, Attunement) is computed at
 * render and never stored (project rule 6).
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

/** The three Rally benefit options (Arts identity only). */
export const RALLY_BENEFITS = ["brace", "reposition", "readField"];

/**
 * The four cross-framework discipline pairs. Each pair shares one rule shape,
 * so the ability sheet renders by group, not by individual discipline:
 *  - reserve (Echo/Stance): Signature plus Deepenings; sustained by held resources.
 *  - enhance (Augment/Boost): rides a named trigger; base effect, per step, evolutions.
 *  - active (Channel/Strike): own activation; reaction plus trigger makes a Counter.
 *  - climax (Surge/Apex): base effect, Amplify, Masteries (stored as deepenings).
 */
export const DISCIPLINE_GROUPS = {
  echo: "reserve", stance: "reserve",
  augment: "enhance", boost: "enhance",
  channel: "active", strike: "active",
  surge: "climax", apex: "climax"
};

/** Evolution threshold ordinal (1/2/3) to the step it crosses (3/6/9). */
export const THRESHOLD_STEPS = { 1: 3, 2: 6, 3: 9 };

/** How an ability resolves when used: no roll, an attack roll, or a save. */
export const RESOLUTIONS = ["none", "attack", "save"];

/** Levels at which Echoes, Stances, Surges, and Apexes deepen. */
export const DEEPENING_LEVELS = [10, 15, 20];

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
      sentence: new fields.StringField({ required: true, initial: "" }),
      // Arts only: the chosen Rally benefit and what the Rally looks like.
      // Blank on Magecraft identities (Magecraft recovery is rest-based).
      rallyBenefit: new fields.StringField({
        required: true, blank: true, initial: "", choices: RALLY_BENEFITS
      }),
      rallyDescription: new fields.StringField({ required: true, initial: "" })
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
      // Named trigger: always for Augments and Boosts; for Channels and
      // Strikes only when their activation is a reaction (a Counter).
      trigger: new fields.StringField({ required: true, initial: "" }),
      // Player-chosen only for Channels and Strikes. Rule-fixed elsewhere and
      // coerced on save by the item sheet: Echo "action", Stance "bonus",
      // Surge/Apex "action", Augment/Boost "none" (they ride their trigger).
      activation: new fields.StringField({
        required: true, blank: false, initial: "action",
        choices: ["action", "bonus", "reaction", "none"]
      }),
      // Display-only for now; the engine phase may formalize (rules: any
      // lasting duration uses standard Concentration, Echo/Stance excepted).
      duration: new fields.StringField({ required: true, initial: "" }),
      concentration: new fields.BooleanField({ initial: false }),
      // The base-step (step 1) effect for Augments/Channels/Boosts/Strikes,
      // or the base effect of a Surge/Apex. Unused by Echo/Stance.
      baseEffect: new fields.HTMLField({ required: true, initial: "" }),
      // The per-step scaling line (Augments/Channels/Boosts/Strikes).
      perStep: new fields.StringField({ required: true, initial: "" }),
      // The up-to-three tier-threshold evolutions (Augments/Channels/Boosts/
      // Strikes). threshold 1/2/3 = crossing steps 3/6/9 on the progression.
      evolutions: new fields.ArrayField(new fields.SchemaField({
        threshold: new fields.NumberField({
          required: true, integer: true, min: 1, max: 3, initial: 1
        }),
        text: new fields.HTMLField({ required: true, initial: "" })
      })),
      // Echo/Stance: the Signature, the always-on effect of the player's
      // design. Attunement is formula-derived and never stored.
      signature: new fields.HTMLField({ required: true, initial: "" }),
      // Surge/Apex: what each amplification increment escalates.
      amplify: new fields.HTMLField({ required: true, initial: "" }),
      // Echo/Stance/Surge/Apex: the level 10/15/20 Deepening or Mastery text.
      deepenings: new fields.ArrayField(new fields.SchemaField({
        level: new fields.NumberField({
          required: true, integer: true, initial: 10, choices: DEEPENING_LEVELS
        }),
        text: new fields.HTMLField({ required: true, initial: "" })
      })),
      notes: new fields.StringField({ required: true, initial: "" }),
      // Phase 3 addition (walked against both rules documents 2026-07-22, no
      // conflict): how the ability resolves when used. Any resolution is legal
      // for any discipline (a Signature can force saves), so validateJoint is
      // untouched. Existing items load with the initial, "none".
      resolution: new fields.StringField({
        required: true, blank: false, initial: "none", choices: RESOLUTIONS
      }),
      // The targeted save ability; read only when resolution is "save".
      saveAbility: new fields.StringField({
        required: true, blank: false, initial: "str",
        choices: ["str", "dex", "con", "int", "wis", "cha"]
      })
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
