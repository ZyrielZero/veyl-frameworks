# MAGECRAFT — Character Creation

*A spellcasting framework for the world of Veyl — D&D 5th Edition (2014 ruleset)*

*These rules describe how to build and play a **magecaster**. Whether Magecraft is implemented as a standalone class, a class feature, or a variant replacing standard spellcasting is determined by your Dungeon Master.*

## Magecraft Ability

When you become a magecaster, choose **Intelligence, Wisdom, or Charisma** as your Magecraft ability. The choice reflects the nature of your magic: theoretical and studied magic favors Intelligence, intuitive or perceptive magic favors Wisdom, and magic drawn from will and self favors Charisma. Use your Magecraft ability whenever a rule refers to your spellcasting modifier.

**Magecraft save DC** = 8 + your proficiency bonus + your Magecraft ability modifier

**Magecraft attack modifier** = your proficiency bonus + your Magecraft ability modifier

## Mana Points

Your magic is fueled by **Mana Points (MP)**. Your maximum is determined by your level, your Magecraft ability modifier, and your proficiency bonus:

**Maximum Mana Points = (level × 3) + (Magecraft ability modifier × level) + proficiency bonus + 5**

*Here, your Magecraft ability modifier is the modifier of your base ability score, unmodified by items or abilities — including your Echo's Attunement.*

Your modifier is counted at every level, so your pool grows as you advance and rewards investment in your Magecraft ability. The flat **+5** is a base spark of Mana that every living thing carries. Even a commoner with no class levels holds a few points of it, so a magecaster is never wholly empty and can sustain an Echo from 1st level. The table below shows a magecaster's Mana Points at the three modifiers you're most likely to play.

| Level | Prof. Bonus | MP (+3 mod) | MP (+4 mod) | MP (+5 mod) |
| --- | --- | --- | --- | --- |
| 1 | +2 | 13 | 14 | 15 |
| 2 | +2 | 19 | 21 | 23 |
| 3 | +2 | 25 | 28 | 31 |
| 4 | +2 | 31 | 35 | 39 |
| 5 | +3 | 38 | 43 | 48 |
| 6 | +3 | 44 | 50 | 56 |
| 7 | +3 | 50 | 57 | 64 |
| 8 | +3 | 56 | 64 | 72 |
| 9 | +4 | 63 | 72 | 81 |
| 10 | +4 | 69 | 79 | 89 |
| 11 | +4 | 75 | 86 | 97 |
| 12 | +4 | 81 | 93 | 105 |
| 13 | +5 | 88 | 101 | 114 |
| 14 | +5 | 94 | 108 | 122 |
| 15 | +5 | 100 | 115 | 130 |
| 16 | +5 | 106 | 122 | 138 |
| 17 | +6 | 113 | 130 | 147 |
| 18 | +6 | 119 | 137 | 155 |
| 19 | +6 | 125 | 144 | 163 |
| 20 | +6 | 131 | 151 | 171 |

### Recovering Mana Points

You regain all expended Mana Points when you finish a **long rest**. When you finish a **short rest**, you regain Mana Points equal to one-third of your maximum, rounded down. You can recover Mana Points from a short rest only **once between long rests**. *Reserved* Mana Points (see Echoes) are not "expended" and are not affected by resting; they return when the Echo sustaining them ends.

## The Cost Progression

Augments and Channels draw their cost from the progression below, adapted from the *Dungeon Master's Guide* Spell Points variant. This progression prices those two disciplines and governs their empowerment. (Echoes instead reserve a fixed amount set by level, and Surges stand outside the progression entirely.) The **Unlock Level** column gives the character level at which each step becomes available to you. The two right-hand columns give the comparable spell level — the benchmark used when designing new abilities (see *Designing Abilities*). An Augment benchmarks one spell level below a Channel of the same cost: because it rides an action you were already taking, part of its price pays for that action economy.

| Unlock Level | Step | MP Cost | Channel — Comparable Spell Level | Augment — Comparable Spell Level |
| --- | --- | --- | --- | --- |
| 1 | 1 | 2 | 1st | Cantrip |
| 3 | 2 | 3 | 2nd | 1st |
| 5 | 3 | 5 | 3rd | 2nd |
| 7 | 4 | 6 | 4th | 3rd |
| 9 | 5 | 7 | 5th | 4th |
| 11 | 6 | 9 | 6th | 5th |
| 13 | 7 | 10 | 7th | 6th |
| 15 | 8 | 11 | 8th | 7th |
| 17 | 9 | 13 | 9th | 8th |

The cost rises by 1 per step, except at the three **tier thresholds** (steps 3, 6, and 9), where it rises by 2. These thresholds align with the character levels at which 3rd-, 6th-, and 9th-level magic becomes available (5th, 11th, and 17th level), and the unlock schedule as a whole mirrors when a full caster gains each spell level.

## The Four Disciplines

A magecaster's abilities belong to one of four disciplines. Each has a fixed rule governing how it functions; the specific effect of any given ability is yours to define within that rule.

### Echoes

An **Echo** is a single persistent effect you sustain by reserving Mana Points. It represents your standing magical signature and grows in power as you advance. It is the defining discipline: while active, it does two things at once, continuously, for as long as you hold it.

- **Activation.** Activating your Echo requires an action and reserves Mana Points (see Reservation). While the Echo remains active, the reserved Mana Points are subtracted from your current Mana Points and cannot be spent or regained until the Echo ends. Reserved points are not lost; they are held.
- **Reservation.** The Mana Points your Echo reserves are set by your level, as shown below. The reservation rises by 5 at levels 5, 10, 15, and 20. A fresh increase takes a real bite of your pool — roughly a quarter of it — easing toward a sixth as you level within the band, until the next increase reasserts the weight. Holding your Echo is always a genuine commitment.

| Level | Reserved MP |
| --- | --- |
| 1–4 | 5 |
| 5–9 | 10 |
| 10–14 | 15 |
| 15–19 | 20 |
| 20 | 25 |

- **Attunement (first effect).** While your Echo is active, your Magecraft ability score increases by an amount equal to **half your level, rounded down**. This increase can raise the score above 20.
- **Signature (second effect).** While your Echo is active, it also imposes a continuous rule or condition of your design: an aura, an ongoing benefit, a triggered response, or similar. This is the unique expression of your Echo. It is not a simple flat bonus to a score or roll; it is an always-on effect on the world around you. Both the Attunement and the Signature run the entire time the Echo is held.
- **Deepening (mastery).** At **levels 10, 15, and 20**, your Echo deepens: its Signature gains a new or expanded effect. (The reservation increase at level 5 is not a Deepening — your Signature does not change then; that is the level your Surge arrives. Attunement scales separately and automatically by its half-level formula.)
- **Ending your Echo (Collapse).** You can end your active Echo at any time, requiring no action. When you do, its reserved Mana Points return to your pool **immediately**, available to spend the same turn. Both of its effects end at once, and the Echo cannot be reactivated until you again spend the Mana Points to establish it.

### Augments

An **Augment** is an enhancement bound to a specific action you take. It cannot act on its own; it shapes an action you were already taking.

- **Named trigger.** Each Augment specifies, when it is created, the action it enhances (its *trigger*) — for example, "when you take the Move action" or "when you cast a spell that deals fire damage." The Augment takes effect when you take that named action, requiring no separate action of its own.
- **Reach.** An Augment may affect you, the target or targets of its host action, or the area or path that action covers — but nothing beyond what the host action already involves. It cannot reach out to a creature or point the host action does not itself touch.
- **Restriction.** An Augment cannot be used on its own; it functions only as part of its named trigger. You can apply no more than **one Augment** to a single action.
- **Base cost.** 2 MP. May be empowered up the cost progression (see *Empowering Abilities*).

### Channels

A **Channel** is a discrete magical effect with its own activation.

- **Activation.** Using a Channel requires an action, unless its description specifies a bonus action or reaction.
- **Target.** A Channel may target yourself, one or more other creatures, an object, or a point in space, as defined by the ability. Effects that aid or restore other creatures (such as healing or warding) are Channels.
- **Base cost.** 2 MP. May be empowered up the cost progression (see *Empowering Abilities*).

### Surges

A **Surge** is your most powerful magic — an effect of a wholly different order from your other abilities, capable of turning a battle even at its smallest. You have a single Surge, gained at **5th level**; like your Echo, it is one ability that deepens with mastery, not a collection.

- **Activation.** Using a Surge requires an action.
- **Cost.** A Surge costs a minimum of **15 MP**. It does **not** use the cost progression — Surges are a category unto themselves, and even a minimum Surge is game-changing. You may amplify a Surge by spending additional Mana Points in increments of **15**, each increment escalating its effect as the Surge describes.
- **Mastery.** At **levels 10, 15, and 20**, your Surge deepens, producing a fundamentally greater effect for the same Mana Point expenditure. A Surge reflects your mastery of your Magecraft, not merely the points poured into it; the same 15 MP yields a far greater effect for a 20th-level magecaster than for a 5th-level one.
- **Burnout.** When you use a Surge, you suffer **Burnout**: for its duration you cannot activate any Magecraft ability of any discipline, your Echo ends immediately if active, and you regain no Mana Points. Burnout lasts **5 rounds for every 15 Mana Points of the Surge's total cost**. The total cost counts every Mana Point spent on the Surge — including points freed by collapsing your Echo and then spent on it — plus the Mana-Point value of any Hit Points paid (every 2 Hit Points counting as 1 Mana Point). No point is ever counted twice.
- **Paying with Hit Points.** If your Mana Points cannot cover a Surge's cost, you may pay the shortfall with Hit Points at a rate of **2 Hit Points per 1 Mana Point** — but only after spending all the Mana Points you can, and only up to the Surge's 15 MP minimum (never to amplify it further).

## Durations and Concentration

A Magecraft ability may resolve at once or have a lasting duration, as its description defines. An ability with an ongoing duration requires **Concentration**, using the standard rules for spells: you can concentrate on only one such effect at a time, and taking damage may force a Constitution saving throw to maintain it. Treat a Concentration-requiring ability exactly as you would a spell of the comparable level.

Your **Echo is the exception**. It is sustained by its reserved Mana Points, not by Concentration, so it never occupies your Concentration, is never broken by damage, and can run alongside a separate effect you are concentrating on.

## Empowering Abilities

When you activate an Augment or Channel, you may spend additional Mana Points to **empower** it, raising its cost one or more steps along the cost progression. Each step increases the ability's effect as described in that ability (for example, additional damage, range, duration, or targets). You may empower an ability up to the highest step your current Mana Points can pay for, and no higher than the highest step your character level has unlocked (see the *Unlock Level* column of the cost progression).

**Threshold Evolution.** The cost progression rises by 2 at three points — the steps costing **5, 9, and 13**. When you empower an Augment or Channel *across* one of these thresholds, it does not merely grow larger: it gains an **additional, distinct effect**, defined for that ability when it is created. Each Augment and Channel therefore has a base form and up to three evolutions, unlocked by empowering it across the 5-, 9-, and 13-cost thresholds in turn. (This applies only to Augments and Channels; Echoes and Surges instead deepen with character level, as described in their entries.)

**Strain.** Magic of the sixth comparable level and beyond taxes even a prepared mind. When you activate an Augment or Channel whose comparable spell level is **6th or higher**, you cannot activate another ability at that same comparable spell level until you finish a long rest. Each comparable level of 6th and above can therefore be reached **once per day**, whether through a Channel or an Augment. Your Echo is unaffected, and Surges are exempt — Burnout is their price.

## Abilities Known

A magecaster's magic is **innate**. From the start — as even a commoner does — you know **one Echo, one Augment, and one Channel** (whether you have the Mana Points to use them is another matter). Your Echo is your single defining signature; you never gain a second one, it only deepens.

At each **even level** (2, 4, 6, … 20), you learn **one additional Augment or Channel**, and you must **alternate** between the two types: if you learn an Augment at one even level, your next even-level ability must be a Channel, and so on. Over a full career this brings you to **six Augments and six Channels**.

You gain your single **Surge** at **5th level**. Like your Echo, it is one ability that deepens with mastery rather than a collection.

| You Know | Count by 20th Level |
| --- | --- |
| Echo | 1 (deepens) |
| Augments | 6 |
| Channels | 6 |
| Surge | 1 (deepens) |

## Designing Abilities

Magecraft is built so that the **rules stay fixed and the flavor stays open**. Two players can build magic that accomplishes the same thing through entirely different means, and both remain balanced, because every ability is held to the same two standards.

**1. It obeys its discipline.** An Augment fires from a named trigger, shaping an action you take and reaching no further than that action itself does; it never stands alone. A Channel is a complete effect with its own activation, which you may direct at others. An Echo is your single sustained signature, paid for by reserved Mana Points, granting Attunement plus a continuous rule of your design. A Surge is a single overwhelming effect followed by Burnout. These rules define the *shape* of an ability and are not negotiable.

**2. Its power matches its cost.** Use the *Comparable Spell Level* columns of the cost progression as a benchmark — the Channel column for Channels, the Augment column for Augments. A Channel costing 5 MP should be roughly as strong as a 3rd-level spell; an Augment at the same cost, roughly a 2nd-level spell, its remaining value carried by the action it rides. When you design a new ability, find its cost on the progression and compare its effect to an official spell of the comparable level. If it substantially outperforms that benchmark, raise its cost or reduce its effect, in consultation with your DM.

Within those two standards, the *expression* of an ability — what it looks like, what it represents, and how it fits your character — is entirely your own. Begin by writing a single sentence describing what your magic truly is, and ensure every ability you design is a faithful expression of that sentence.

## Appendix: Design Notes for the DM

*This appendix is not part of the player-facing rules. It records the open balance questions in the current draft, with proposed patches. Adopt, adapt, or ignore as suits the table.*

### 1. The pool is well calibrated — better than it first looks

With the Echo up, the usable pool (maximum minus reservation) tracks the DMG Spell Points totals almost exactly at a +4 modifier: 64 vs. 64 at 10th level, 95 vs. 94 at 15th, 110 vs. 107 at 17th, and 126 vs. 133 at 20th. A +5 modifier runs roughly 10–15% over. The reservation is doing real work as a balancing tax, and Collapse is correctly priced as the nova valve: dropping the Echo trades your Attunement and Signature for a burst of points. The raw numbers are sound.

### 2. Top-tier volume — resolved by the Strain rule (new in this draft)

The DMG Spell Points variant this progression is adapted from carries a companion restriction: "You can use spell points to create one slot of each level of 6th or higher. You can't create another slot of the same level until you finish a long rest." It exists because a point pool otherwise funds repeated top-tier casts — playtest reports of the variant describe casters "novaing all the time." Magecraft previously had no such cap: at 20th level with a +5 modifier, a day's Mana (Echo up, one short rest) is about 203 MP, enough for **fifteen** 9th-level-comparable Channels against a standard caster's single 9th-level slot.

The **Strain** rule in *Empowering Abilities* adopts the DMG restriction, keyed to comparable spell level so the Channel and Augment columns share one budget. The math of the change is telling: because the cost progression's levels-per-MP ratio is nearly flat, total daily throughput barely moves (roughly 140 comparable spell levels with or without the cap at +5). What changes is the *distribution* — 9th-level-comparable casts drop from fifteen per day to one, while sustained mid-tier casting is untouched. Strain removes the encounter-breaking spike without touching the fantasy of a deep pool. Against a 20th-level wizard's ~99 slot-levels per day (with Arcane Recovery), a Strained magecaster still runs about 25–40% hotter, concentrated at 5th-comparable and below — a deliberate, tunable margin rather than a broken one.

**Optional loosening:** if the cap feels tight at the very top, allow a second 6th-comparable activation at 19th level and a second 7th at 20th — this exactly reproduces the PHB full-caster slot table (2/2/1/1 at level 20).

### 3. Attunement scaling

Attunement is modest early and dominant late: from a base score of 20, the save DC runs +1 over a standard caster at 5th level, +2 at 10th, +3 at 15th, and +5 at 20th (DC 24 vs. 19, attack +16 vs. +11). A five-point DC gap at 20th means enemies fail roughly 25 percentage points more of their saves. Because Attunement feeds every DC, attack roll, and check for a 25 MP reservation, it is the strongest single effect in the system.

**Options if this proves too strong:** cap the Attunement bonus at the magecaster's proficiency bonus; or let it raise the score for checks and prerequisites but not the save DC. If the intent is that a magecaster at full Echo simply outclasses a standard caster, keep it as written — but decide that on purpose.

### 4. Short-rest recovery compounds the volume

The DMG Spell Points variant recovers nothing on a short rest; Magecraft recovers a third of maximum once per day. On its own this is comparable to a warlock's pact-slot rhythm — and with Strain now capping the top tiers, the recovered points can only flow into mid-tier casting, so the recovery is comfortable to keep as written.

### 5. The Collapse-into-Surge nova

Collapse costs no action and returns reserved MP immediately, so the intended endgame turn is: collapse the Echo, pour everything into an amplified Surge, and accept a long Burnout. The Burnout rules already anticipate this (collapsed points count toward its duration), so it reads as intended design — just be aware the pattern exists, and that Burnout scaling (5 rounds per 15 MP) is the safety valve. A 45 MP Surge means 15 rounds — a minute and a half — of no magic at all.

### Editorial changes made in this draft

Four small fixes were applied to the source text. First, the Unlock Level gate existed only as a table column; a sentence in *Empowering Abilities* now states the rule explicitly. Second, *Designing Abilities* still referenced a single benchmark column; it now points to the split Channel and Augment columns and explains the one-level offset. Third, the Echo's Reservation section called the level-5 increase a "deepening" while the Deepening rule lists only levels 10, 15, and 20; this draft treats level 5 as a reservation increase only (it is the level the Surge arrives). Fourth, Burnout's duration was reworded to make clear that Echo-collapsed points and Hit-Point payments count once toward the total, never twice, and the redundant "rounded down" was dropped (all Surge totals are multiples of 15). All tables were re-verified against the formulas.

---

*Magecraft · Veyl*
