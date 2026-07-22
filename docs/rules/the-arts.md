# THE ARTS — Character Creation

*A martial-technique framework for the world of Veyl — D&D 5th Edition (2014 ruleset)*

*These rules describe how to build and play an **adept**. Whether the Arts are implemented as a standalone class, a class feature, or a variant replacing standard martial features is determined by your Dungeon Master.*

*The Arts are the martial sibling of Magecraft. The two frameworks share one chassis — a sustained signature, riders on your actions, discrete effects, and a single ultimate — and are priced against the same benchmarks, so an adept and a magecaster sit at the same table as equals. Where Magecraft spends a pool, the Arts spend **themselves**: techniques are expended in the moment and won back in the rhythm of the fight.*

## Arts Ability

When you become an adept, choose **Strength, Dexterity, or Constitution** as your Arts ability. The choice reflects the nature of your art: overwhelming force favors Strength, precision and timing favor Dexterity, and endurance — the art of outlasting — favors Constitution. Use your Arts ability whenever a rule refers to your Arts modifier.

**Arts save DC** = 8 + your proficiency bonus + your Arts ability modifier

**Arts attack modifier** = your proficiency bonus + your Arts ability modifier *(for most adepts this is simply their weapon attack modifier)*

## Techniques and the Ready Cycle

An adept has no pool of points. Your resources are your **techniques** themselves — every Boost and Strike you know is at any moment either **ready** or **spent**. Using a technique spends it; spending techniques to empower another spends those too (see *Empowering Techniques*). A spent technique cannot be used again until you recover it. Your art is never exhausted for the day — only for the moment. The fight is won by how you spend the moment.

## Rally

In combat, you can take the **Rally** action to recover spent techniques: choose a number of your spent techniques equal to **your proficiency bonus** and they become ready. A Rally is not a pause — it is a visible act of your art: the duelist resetting her measure, the brawler cracking his neck and planting his feet, the archer's slow breath as the field goes quiet. When you create your character, define what your Rally looks like and choose one of the following benefits, which you gain each time you Rally:

- **Brace.** You gain temporary hit points equal to your proficiency bonus + your Arts ability modifier.
- **Reposition.** You move up to half your speed without provoking opportunity attacks.
- **Read the Field.** You have advantage on the first attack roll you make before the end of your next turn.

*Each benefit is benchmarked as cantrip-comparable — the Rally's real price is your action, and its real reward is your hand coming back.*

## Recovering Between Fights

When you spend **1 minute** catching your breath outside of combat, all of your spent techniques become ready. The Arts are paced **per encounter**, not per day: you enter every fight whole. The exceptions are techniques locked by **Strain** (see *Empowering Techniques*), which return only on a long rest, and the **Winded** condition that follows your Apex.

## The Step Progression

Boosts and Strikes are empowered along the progression below — the same ladder of comparable spell levels that prices Magecraft, paid in techniques instead of Mana. Using a technique at a given step spends **that technique plus a number of additional ready techniques**, as shown in the Spend column: a step-1 use spends only the technique itself; a step-4 use spends it and three others of your choice. The **Unlock Level** column gives the character level at which each step becomes available — the same schedule on which a magecaster unlocks each Mana cost, and on which a full caster gains each spell level. The two right-hand columns give the comparable spell level, the benchmark used when designing techniques (see *Designing Techniques*). A Boost benchmarks one spell level below a Strike of the same step: because it rides an action you were already taking, part of its price pays for that action economy.

| Unlock Level | Step | Techniques Spent | Strike — Comparable Spell Level | Boost — Comparable Spell Level |
| --- | --- | --- | --- | --- |
| 1 | 1 | 1 | 1st | Cantrip |
| 3 | 2 | 2 | 2nd | 1st |
| 5 | 3 | 3 | 3rd | 2nd |
| 7 | 4 | 4 | 4th | 3rd |
| 9 | 5 | 5 | 5th | 4th |
| 11 | 6 | 6 | 6th | 5th |
| 13 | 7 | 7 | 7th | 6th |
| 15 | 8 | 8 | 8th | 7th |
| 17 | 9 | 9 | 9th | 8th |

The three **tier thresholds** fall at steps 3, 6, and 9 — the same steps where Magecraft's costs jump by 2 — and align with the levels at which 3rd-, 6th-, and 9th-level magic enters the world (character levels 5, 11, and 17). Where a magecaster pays those thresholds in extra Mana, an adept pays them in **breadth**: a step-9 Strike spends nine techniques — for most adepts, everything they have. The higher you reach, the narrower your hand becomes.

## The Four Disciplines

An adept's abilities belong to one of four disciplines, mirroring Magecraft's four. Each has a fixed rule governing how it functions; the specific effect of any given technique is yours to define within that rule.

### Stances

A **Stance** is a single persistent fighting form you sustain by holding techniques in reserve. It is the defining discipline — your standing martial signature, and it grows in power as you advance. While active, it does two things at once, continuously, for as long as you hold it.

- **Assuming your Stance.** Assuming your Stance requires a bonus action. When you assume it, choose a number of your ready techniques as shown below and **hold** them: held techniques count as spent, cannot be used or recovered by any means, and remain held for as long as the Stance is active. They are not lost; they are woven into the form.

| Level | Techniques Held |
| --- | --- |
| 1–4 | 1 |
| 5–9 | 1 |
| 10–14 | 2 |
| 15–19 | 2 |
| 20 | 3 |

- **Attunement (first effect).** While your Stance is active, your Arts ability score increases by an amount equal to **half your level, rounded down**. This increase can raise the score above 20. It does not change your hit point maximum *(a rule that matters only to Constitution-based adepts, and keeps the Stance from doubling as a second pool of Hit Points)*.
- **Signature (second effect).** While your Stance is active, it also imposes a continuous rule or condition of your design: a zone you control, a sense that cannot be slipped, a triggered response, or similar. This is the unique expression of your Stance. It is not a simple flat bonus to a score or roll; it is an always-on effect on the world around you. Both the Attunement and the Signature run the entire time the Stance is held.
- **Deepening (mastery).** At **levels 10, 15, and 20**, your Stance deepens: its Signature gains a new or expanded effect. (Attunement scales separately and automatically by its half-level formula.)
- **Ending your Stance (Release).** You can end your active Stance at any time, requiring no action. When you do, its held techniques become ready **immediately**, available to spend the same turn. Both of its effects end at once, and the Stance cannot be reassumed until you again spend the bonus action — and hold the techniques — to establish it. Release is the adept's nova valve, exactly as Collapse is the magecaster's: the form, or everything the form was holding.

### Boosts

A **Boost** is an enhancement bound to a specific action you take. It cannot act on its own; it shapes an action you were already taking.

- **Named trigger.** Each Boost specifies, when it is created, the action it enhances (its *trigger*) — for example, "when you take the Attack action" or "when you take the Dash action." The Boost takes effect when you take that named action, requiring no separate action of its own.
- **Reach.** A Boost may affect you, the target or targets of its host action, or the area or path that action covers — but nothing beyond what the host action already involves. It cannot reach out to a creature or point the host action does not itself touch.
- **Restriction.** A Boost cannot be used on its own; it functions only as part of its named trigger. You can apply no more than **one Boost** to a single action.
- **Base step.** 1 (spends only itself). May be empowered up the step progression (see *Empowering Techniques*).

### Strikes

A **Strike** is a discrete martial effect with its own activation.

- **Activation.** Using a Strike requires an action, unless its description specifies a bonus action or reaction. Any weapon attacks a Strike involves are made as part of that action. A Strike used as an action replaces your normal Attack action — it does not include your other attacks from Extra Attack unless it says otherwise. This is the adept's standing tension: the full weight of your ordinary attacks carrying a Boost, or one decisive Strike.
- **Target.** A Strike may target yourself, one or more other creatures, an object, or an area, as defined by the technique. Effects that aid other creatures (a warding interposition, a rallying maneuver) are Strikes.
- **Base step.** 1 (spends only itself). May be empowered up the step progression.

**Counters.** A Strike or Boost whose activation is a **reaction** with a named trigger — "when a creature you can see hits you with a melee attack," "when an ally within your reach is targeted by an attack" — is called a **Counter**. Counters follow all normal rules for their discipline; the name marks the adept's signature habit of answering an enemy's action on the enemy's turn. An adept with a Counter ready is dangerous even when it is not their turn.

### Apex

An **Apex** is your most devastating technique — an effect of a wholly different order from your other abilities, capable of turning a battle even at its smallest. You have a single Apex, gained at **5th level**; like your Stance, it is one technique that deepens with mastery, not a collection.

- **Activation.** Using your Apex requires an action.
- **Cost.** Your Apex spends **every ready technique you have**, with a minimum of **3**. If fewer than 3 of your techniques are ready, you may pay **10 Hit Points per missing technique** to reach the minimum — but only after spending every ready technique you can, and only up to the minimum (never beyond it). The Apex stands outside the step progression: it is a category unto itself, and even a minimum Apex is battle-turning.
- **Amplify.** You may amplify your Apex by paying **30 Hit Points** per amplification, each amplification escalating its effect as the Apex describes. Thirty Hit Points is precisely what a magecaster's 15-Mana Surge amplification costs when paid in blood (2 Hit Points per Mana Point) — an adept's reserve simply *is* their body.
- **Mastery.** At **levels 10, 15, and 20**, your Apex deepens, producing a fundamentally greater effect for the same cost. An Apex reflects your mastery of your art, not merely the techniques poured into it; the same expenditure yields a far greater effect for a 20th-level adept than for a 5th-level one.
- **Winded.** When you use your Apex, you become **Winded**: for the duration you cannot use any Arts technique of any discipline, you cannot Rally, your Stance ends immediately if active and cannot be reassumed, and your spent techniques cannot become ready by any means. Winded lasts **5 rounds, plus 5 rounds for each amplification**. It is the mirror of a magecaster's Burnout — the legend, and then the bill.

## Durations and Concentration

An Arts technique may resolve at once or have a lasting duration, as its description defines. A technique with an ongoing duration requires **Concentration**, using the standard rules for spells: you can concentrate on only one such effect at a time, and taking damage may force a Constitution saving throw to maintain it. Treat a Concentration-requiring technique exactly as you would a spell of the comparable level.

Your **Stance is the exception**. It is sustained by its held techniques, not by Concentration, so it never occupies your Concentration, is never broken by damage, and can run alongside a separate effect you are concentrating on.

## Empowering Techniques

When you use a Boost or Strike, you may spend additional ready techniques to **empower** it, raising it one or more steps along the step progression. Each step increases the technique's effect as described in that technique (for example, additional damage, targets, distance, or duration). You may empower a technique up to the highest step your ready techniques can pay for, and no higher than the highest step your character level has unlocked (see the *Unlock Level* column). Techniques spent as fuel are ordinary expenditures — they can be recovered by Rallying as usual.

**Threshold Evolution.** When you empower a Boost or Strike *across* one of the three tier thresholds — steps **3, 6, and 9** — it does not merely grow larger: it gains an **additional, distinct effect**, defined for that technique when it is created. Each Boost and Strike therefore has a base form and up to three evolutions, unlocked by empowering it across the 3-, 6-, and 9-step thresholds in turn. (This applies only to Boosts and Strikes; Stances and Apexes instead deepen with character level, as described in their entries.)

**Strain.** Techniques of the sixth comparable level and beyond tax even a conditioned body. When you use a Boost or Strike whose comparable spell level is **6th or higher**, you cannot use another technique at that same comparable level until you finish a long rest. Each comparable level of 6th and above can therefore be reached **once per day**, whether through a Strike or a Boost — the same ceiling a magecaster faces. Your Stance is unaffected, and your Apex is exempt: Winded is its price.

## Techniques Known

An adept's art is **trained into the body** — as innate to them as a magecaster's magic is to the magecaster. From the start you know **one Stance, one Boost, and one Strike**. Your Stance is your single defining form; you never learn a second one, it only deepens.

At each **even level** (2, 4, 6, … 20), you learn **one additional Boost or Strike**, and you must **alternate** between the two types: if you learn a Boost at one even level, your next even-level technique must be a Strike, and so on. Over a full career this brings you to **six Boosts and six Strikes**.

You gain your single **Apex** at **5th level**. Like your Stance, it is one technique that deepens with mastery rather than a collection.

| You Know | Count by 20th Level |
| --- | --- |
| Stance | 1 (deepens) |
| Boosts | 6 |
| Strikes | 6 |
| Apex | 1 (deepens) |

## Designing Techniques

The Arts are built so that the **rules stay fixed and the flavor stays open**. Two players can build arts that accomplish the same thing through entirely different means, and both remain balanced, because every technique is held to the same two standards.

**1. It obeys its discipline.** A Boost fires from a named trigger, shaping an action you take and reaching no further than that action itself does; it never stands alone. A Strike is a complete effect with its own activation, which you may direct at others. A Stance is your single sustained form, paid for by held techniques, granting Attunement plus a continuous rule of your design. An Apex is a single overwhelming effect followed by being Winded. These rules define the *shape* of a technique and are not negotiable.

**2. Its power matches its step.** Use the *Comparable Spell Level* columns of the step progression as a benchmark — the Strike column for Strikes, the Boost column for Boosts. A Strike at step 3 should be roughly as strong as a 3rd-level spell; a Boost at the same step, roughly a 2nd-level spell, its remaining value carried by the action it rides. When you design a new technique, find its step on the progression and compare its effect to an official spell of the comparable level. If it substantially outperforms that benchmark, raise its step or reduce its effect, in consultation with your DM.

**Riders over dice.** Martial technique is at its best when the benchmark is met with *consequence* rather than raw damage: a foe staggered, thrown, pinned, marked, denied its reaction, dragged out of position. A Strike that deals a 3rd-level spell's damage is legal; a Strike that deals a 2nd-level spell's damage and puts the enemy exactly where your allies need it is better Art. Let damage ride the weapon; let the technique buy the situation.

Within those two standards, the *expression* of a technique — what it looks like, what tradition it descends from, and how it fits your character — is entirely your own. The fighting arts of Veyl are many: the closed-fist schools that treat the body as the only honest weapon, the shield-lines whose members hold ground as a vocation, the red styles that spend fury like coin, the duelists' courts, the horse-archers' wind-forms, the quiet needlework of the pressure-point killers, the paired-blade dances, the ghost-step arts that treat distance as negotiable. Begin by writing a single sentence describing what your art truly is, and ensure every technique you design is a faithful expression of that sentence.

## Appendix: Design Notes for the DM

*This appendix is not part of the player-facing rules. It records the provenance, the balance mathematics, and the open questions of the current draft. Adopt, adapt, or ignore as suits the table.*

### 1. Provenance

The Arts are deliberately modeled on the *Path of War* system for Pathfinder 1e (Dreamscarred Press), itself descended from D&D 3.5's *Tome of Battle: The Book of Nine Swords*. The elements carried over are the ones that define that system's feel: a per-encounter economy rather than a per-day one; techniques that are expended in use and won back through a mid-combat recovery action that is itself a characterful turn (Path of War's warlord gambles for his maneuvers, its warder digs in, its stalker centers himself — hence the customizable Rally); always-on stances; the boost-plus-attack turn (Path of War's swift-action boost maps to a rider on the 5e Attack action); counters as reactions (its immediate actions); and riders that scale faster than dice. Path of War's designers priced initiators deliberately above core martials to bring them level with casters — community consensus places them at solid tier 3, "competent, versatile, and fun" rather than broken. The Arts aim at the same target relative to Magecraft, and the sections below check that aim with arithmetic.

### 2. The core parity check — daily throughput

The common currency is the **comparable spell level (CSL)** — Magecraft's own benchmark unit. The table below models a standard adventuring day of six 4-round encounters with two Rallies per fight, greedy play, Strain respected on both sides, Stance/Echo up. Magecraft figures use its own appendix method (usable pool plus one short rest, spent at best ratio); the wizard column is PHB slot levels plus Arcane Recovery. The Arts model reproduces Magecraft's published figure at 20th level (~144 CSL at a +5 modifier), which validates the method.

| Level | Wizard (slot levels/day) | Magecraft (+4 mod) | Magecraft (+5 mod) | Arts (riders) |
| --- | --- | --- | --- | --- |
| 5 | 19 | 31 | 36 | 24 |
| 11 | 53 | 70 | 81 | 48 |
| 17 | 80 | 108 | 125 | 74 |
| 20 | 99 | 125 | 144 | 80 |

Read naively, the Arts run at roughly 75–85% of a wizard and 55–65% of Magecraft. But the Arts column counts only its *riders* — every one of those comparable levels lands on top of a full martial chassis swinging weapons at will, which the caster columns must pay for out of their totals. At 20th level a fighter chassis under Attunement sustains ~62 damage per round before any technique — call it a 4th-to-6th-level single-target spell every round, at will. Priced that way, total combat contribution converges: the adept's ~83 damage-plus-control round against the magecaster's ~6 CSL round (a *disintegrate*-class effect, save-gated but versatile). The deliberate residual differences: Magecraft holds the higher ceiling and the wider toolbox (area effects, utility, healing); the Arts hold consistency (attack-gated rather than save-gated, no pool to drain) and durability. That is Path of War's intended relationship between initiator and caster, reproduced.

### 3. Day-shape sensitivity — the honest caveat

Because the Arts refresh per encounter, their daily output scales with the number of fights while Magecraft's pool does not. On a **3-encounter day** the Arts deliver ~51 rider-CSL at 20th against Magecraft's unchanged 144 — the magecaster can pour a whole day's pool into three fights and dominate, exactly as 5e casters already dominate short days. On an **8-encounter grind** the gap nearly closes (76 vs 144, with the chassis argument carrying the rest, and the magecaster increasingly rationing). The Arts are calibrated for the DMG's six-to-eight encounter day. If your table runs one or two big fights per day, expect the magecaster to outshine — and consider the standard remedies (pacing, or letting Strain's once-per-day locks span multiple days) before touching the frameworks themselves.

### 4. Attunement — flagged identically to Magecraft's

Attunement is the Arts' strongest single effect, exactly as Magecraft's notes flag for the Echo. From a base score of 20, a 20th-level adept under Stance sits at 30 (+10 modifier): worth about **+30 sustained damage per round** on a four-attack chassis (62 vs 33) plus five points of save DC — the same magnitude as the magecaster's five-point DC edge, expressed in the martial currency. This is intended symmetry: if one framework keeps full Attunement, both should. The same patch options apply and should be adopted (or declined) **in both frameworks together**: cap the Attunement bonus at proficiency bonus; or let it raise the score for checks and prerequisites but not attack rolls and DCs. Note also the deliberate carve-out that Attunement never changes hit point maximum — without it, a Constitution adept's Stance would be worth ~100 phantom Hit Points at 20th, which no Echo can match.

### 5. The Release-into-Apex nova

Release costs no action and readies held techniques immediately, so the intended endgame turn mirrors Magecraft's Collapse-into-Surge move for move: drop the Stance, pour the whole hand into the Apex, accept the bill. The symmetry holds down the line — both novas surrender Attunement first (the Apex is rolled at the lower modifier, one more reason it is a closing move); Winded mirrors Burnout's scaling (5 rounds per tier of cost); and amplification is priced at Burnout's own blood rate of 2 Hit Points per Mana-equivalent, i.e. 30 HP per 15-Mana increment. A twice-amplified Apex costs 60 Hit Points and 15 rounds of being an ordinary soldier. The legend and the bill, in that order — on both sides of the table.

### 6. Tunable dials

**Rally amount.** Recovery equal to proficiency bonus is the load-bearing number: at 20th level, varying it from 3 to 6 swings daily throughput from 62 to 80 CSL. Proficiency was chosen so the recovery scales with tier on the same curve as the step costs. If the Arts feel hot at your table, drop Rally to "proficiency bonus minus 1 (minimum 2)" before touching anything else; if flat, allow one free Rally per encounter as a bonus action at 11th level.

**The held-techniques table.** The Stance's hold (1/1/2/2/3) tracks the Echo's reservation as a fraction of resources — 50% of the hand at 1st level falling to ~25% at 20th, against the Echo's 38% falling to 19%. The adept's early hold bites harder because a technique is a coarser coin than a Mana Point; this is intended (the Stance is identity before it is power, exactly as the Echo is), but a table that finds 1st-level play too thin can waive the hold until 2nd level with no downstream effect.

**Fungibility.** Which techniques to hold in the Stance and which to spend as fuel is player's choice, made at the moment. Watch for a player who always holds their least-used techniques and effectively erases the cost — if that pattern grates, rule that held techniques are chosen when the Stance is first designed. The math above is indifferent between the two rulings.

### Editorial notes

This framework was drafted against *Magecraft: Character Creation* as the fixed reference: the ability triad, DC and attack formulas, unlock schedule, threshold steps, Strain wording, alternating even-level learning, deepening levels (10/15/20), Concentration rules, and the two design standards are mirrored clause for clause, diverging only where a pool-less economy demands it (the Ready Cycle replacing Mana, Rally replacing the short-rest recovery, held techniques replacing reserved points, Hit Points as the Apex's amplification currency). All tables were verified against the formulas, and the throughput model was validated by reproducing Magecraft's own published 20th-level figure before being applied to the Arts.

---

*The Arts · Veyl*
