# Design brief — Ejected pilots / rescue pods (signature-mechanic candidate, GDD §12)

| | |
|---|---|
| **Status** | Decision-ready brief, synthesised from a 5-lens study and 3 adversarial critiques (2026-10-07). Annex to `docs/design/game-design-document.md` §12. |
| **Verdict** | **Worth it, narrowed: friendly escape pods only, scripted, reward-only. Not in 1.0 — build it as the 1.1 headline update and prepare two seams in 1.0.** |
| **Confidence** | Medium: the concept, the precedent base and the code path are solid; the pod sprite (first custom animated body from a non-pixel-artist) and the per-level placement are untested. |
| **Owner decisions** | Five decision points accompany this brief (timing, factions, source, reward, narrative frame). |

## 1. Summary & verdict

The owner's idea has two halves. One survives, one does not.

- **Rescue captured pilots (friends eject, catch them)** — worth building. Strong, legible precedent (Defender, Sky Soldiers, Choplifter), a perfect fit for the mechanical-armada fiction (machines do not eject; the only living things aboard are prisoners), a verb the itch.io page can show in a 3-second GIF, and a cost of 3.5–5.5 solo days in its minimal form because it rides the existing pickup pipeline unchanged.
- **Hostile ejectees to avoid (friend/foe discrimination)** — rejected in every form studied (contact hazard, chain-reset-on-touch, shootable "chain fuel", upward-fleeing decoy, "do not shoot" boss part). All five lenses cut it and all three critiques confirm the reasons: at 240×320 with 16 px sprites, 10–40 bullets, 1-hit deaths and an autofire touch model, the player cannot classify a falling body in the ~250 ms available (Hick, two alternatives), colour-blind players cannot at all, and any penalty on a mis-read is attributed to the game. It also breaks the GDD §4.6 invariant ("everything that falls is good to catch") on which the whole pickup economy rests.

**Timing.** The GDD already places the mechanic in 1.x (§11.2, §12, decision record) and the *Ship-able scope* pillar (§1.3) says nothing beyond 3 levels / 3 bosses / 5 roles / 5 pickups / 2 weapons enters 1.0. The critiques add the operational reasons: the pod is the first sprite that must be a custom animated body (no CC0 pack has it), rescue reachability is a recurring tax on every level-script revision, and none of the playtest gates proposed by the lenses can be run by a solo developer without testers or telemetry. Recommendation: ship 1.0 as decided, ship the pod as **1.1 "Rescue your squadron"** (which also gives the itch.io page a reason to resurface), and spend ~0.5 day in 1.0 on two seams (per-type pickup definition table, `pickup:lost` event). If the owner nevertheless chooses 1.0, the minimal cut is exactly §3 + §6.2 with the same 5-day time-box, nothing more.

**What the critiques changed versus the lens recommendations** (anything refuted by ≥ 2 of 3 critics was replaced):

| Lens recommendation | Critique outcome | Replaced by |
|---|---|---|
| Hostile ejectees, any form | Refuted 3/3 | Cut entirely |
| Pods from boss phase breaks (66 % / 33 %) | Refuted 2/3 | Carrier only; never during boss fights |
| `EjectTable` RNG rolls on Gunner / Heavy | Refuted 2/3 (YAGNI, RNG denominator) | Script-chosen Carrier cargo, zero RNG |
| Homing drift toward the ship (10 px/s) | Refuted 3/3 (it is the Diver's motion grammar) | Straight fall; existing 32×32 collection box |
| Slower fall (60 %) + render above bullets | Refuted 3/3 | Same 40 px/s as pickups; pickup layer, below bullets |
| Letter on the pod (Sky Soldiers) / collapse pickups into 4 families | Refuted 3/3 | The pod is a body, the five pickups are untouched |
| Rescues replace or feed the 1-UP economy (N = 3 / 8 / 10) | Refuted 2/3 | Flat points only; 1-UP rule unchanged |
| 300 × chain / 5 000 × chain / chain refresh / "Full squadron" +10 000 | Refuted 3/3 | +1 000 flat, no chain interaction, no all-or-nothing bonus |
| Portrait strip / 9 named pilots / roll-call scene / 3 endings | Refuted 3/3 | HUD `PILOTS n/m`, one tally line, one conditional ending |
| White 1–3 Hz beacon wired to the photosensitivity toggle | Refuted (readability critic) | Amber hue pulse ≤ 2 Hz, never white, stays on under the toggle |
| 5 testers × 3 sessions, 70 % / 15 % thresholds | Refuted 3/3 (no testers, no telemetry) | Five checks the owner can run alone (§7) |
| L3 "captured fighter, do not shoot" boss part | Refuted 3/3 | Cut |
| Pods immune to shots and bombs · deterministic placement · reward-only · UML-first · photosensitivity wiring | Upheld 3/3 (corrections folded in) | Kept |

## 2. Precedents (short)

| Game | What it shows | Lesson applied | Source |
|---|---|---|---|
| Defender (Williams, 1981) | Whole loop on catching falling humanoids (500 + 500 pts, survival bonus); losing all ten blows up the planet | Rescue can carry a game; global punishment is its most-cited frustration | strategywiki.org/wiki/Defender/Gameplay |
| Sky Soldiers (SNK, 1988) | Vertical shmup whose only pickup is a parachuting pilot | Closest formal precedent: the ejectee rides the pickup pipeline | en.wikipedia.org/wiki/Sky_Soldiers |
| Choplifter (Brøderbund, 1982) | Rescued vs lost hostage counts as the score | Count-based tally, no text; crushing hostages is the recurring complaint | en.wikipedia.org/wiki/Choplifter |
| Galaga (Namco, 1981) | Captured fighter: friend state signalled by context, one object, sparse screen | The "friend among enemies" beat needs a near-empty screen and no autofire | strategywiki.org/wiki/Galaga/Gameplay |
| Dropzone (1984), Rescue on Fractalus! (1984) | Lookalike hostile ejectees as a deliberate trap / horror beat | Only works in slow, sparse games, never under 30 bullets | en.wikipedia.org/wiki/Dropzone · en.wikipedia.org/wiki/Rescue_on_Fractalus! |
| Dangun Feveron (Cave, 1998) | Hundreds of falling cyborgs; counter resets to 1 on a single miss | Density and reset-on-miss are the cited pain points | shmups.wiki/library/Fever_SOS |
| Operation Wolf (1987), Raiden II fairy | "Do not shoot the friendly" | Unplayable with autofire; friendlies must be shot-transparent | hardcoregaming101.net/operation-wolf · shmups.wiki/library/Raiden_II |
| Sky Force Reloaded (2016) | Dwell-time rescues in a vertical scroller | Called "agonising": catch on touch, never fight the scroll | pushsquare.com/reviews/ps4/sky_force_reloaded |
| Ace Combat 7 vs War Thunder | Ejecting pilots as non-targets vs shootable | Tone: a portfolio game never lets you shoot a person in distress (AP I, Art. 42) | ihl-databases.icrc.org/en/ihl-treaties/api-1977/article-42 |

## 3. Proposed mechanic spec (minimal version = the 1.1 deliverable)

### 3.1 Fiction

The armada is mechanical; its crews are machines and never eject. The only living things aboard are **captured allied pilots**, carried in **Carrier** transports. Destroying a prisoner transport releases one **escape pod**. Catch it to bring the pilot home. Nine pilots per run (3 per level).

### 3.2 Entities

| Entity | Definition |
|---|---|
| **Escape pod** | A sixth `PickupType` (`Pilot`). Same pool, same collision, same render layer, same fall speed as the five pickups. Differs only by sprite, animation, two SFX, an `Emerging` phase and its collect effect. |
| **Prisoner transport** | An ordinary Carrier whose script-chosen cargo (GDD §5.2: "Shield, Bomb or 1-UP as chosen by the level script") is `Pilot`. No new enemy role, no new field. |
| **Rescue tally** | `{ rescued, held }` per level and per run. `held` is derived statically from the level script (count of Carriers carrying `Pilot`), so the denominator is deterministic. |

### 3.3 Spawn rules

- **Source: Carrier only.** Popcorn and Divers are drones (fiction, and 5–8 pods per formation would be noise). Gunner and Heavy are not sources in the minimal version. **Bosses never** release pods: a phase break (pattern switch, part flying off, shake, flash) is the worst moment for a new read, and a boss pod creates a "wait to be positioned" stall against the 90 s timer.
- **Count: 3 per level, 9 per run** *(initial)*. Script-fixed, **zero RNG**. A `Pilot` Carrier that leaves the screen alive releases nothing and counts as "not rescued".
- **Cargo replacement, not addition.** The flagged Carrier drops the pod *instead of* a Shield / Bomb / 1-UP, so two falling objects never overlap at the same point. The level's other Carriers keep their items; the 1-UP Carrier stays where the script puts it.
- **Script lint** (one unit test per level script): `Pilot` only on Carrier events · ≤ 3 per level · ≥ 12 s between two `Pilot` Carriers (max 1 pod on screen) · crossing line at y ≤ 110 px (upper third, ≥ 5 s of fall time) · no `Pilot` Carrier in the 6 s before a Heavy spawn nor after the boss WARNING event.
- **First pod of the run (level 1):** after the Shield Carrier at 28 s (which already teaches "catch it before it leaves"), in a window where only Popcorn formations are scheduled ±6 s. The existing first-appearance label (GDD §7.3) floats `PILOT` above it for 1 s: no tutorial needed.

### 3.4 Friend/foe ratio

**100 % allies, 0 hostiles, in every version.** No per-pod roll. If the owner wants the "crews bail out" flavour on hostile ships, it is a cosmetic particle variant inside the existing explosion (zero collision, zero gameplay), never an entity.

### 3.5 Movement *(initial values)*

| Phase | Duration | Motion |
|---|---|---|
| Spawn | Carrier death + 0.3 s | Spawned at the Carrier's death position after the explosion's bright frames, so the parent's flash never hides it |
| `Emerging` | 0.5 s | vy from −48 px/s easing to +40 px/s (rises ~8 px, then falls): the first visible motion is unlike any pickup |
| `Falling` | until y > 280 px | 40 px/s straight down, exactly like every pickup, with the same slight sway (a 40 % speed delta is not readable at a glance, and a slower pod lingers into the next wave) |
| `Leaving` | last 40 px (~1 s) | Same motion; distress beep once (audible on phones, where the bottom band may sit under the thumb) |
| Exit | y > 320 px | `pickup:lost` |

On screen ≈ 6.5 s from a Carrier line at y ≈ 80. Max 1 pod on screen, guaranteed by the script lint rather than a runtime cap.

### 3.6 Interactions (every pair, explicit)

| With | Rule |
|---|---|
| Player ship | **Rescue** on contact with the full 32×32 ship sprite (the existing pickup collection box, not the 4×4 hitbox). +1 000 pts, counter +1, rescue chime, score pop-up. |
| Player bullets / laser | **No collision** (pickup layer), identical to the five pickups. Shots visibly pass through, as they already do for every pickup: no new rule to learn, and autofire can never kill a pilot. |
| Enemy bullets | No collision. |
| Bombs | No effect (a bomb cancels enemy bullets and damages enemies; pickups are untouched). |
| Enemies, Divers | No collision. |
| Screen bottom | Pod removed, `pickup:lost`; counts as not rescued; **no other penalty** (no score loss, no chain effect, no life effect). |
| Player death | The pod keeps falling; the death-released P pickup is independent. |
| Pause / level end | Frozen / discarded like any pickup. |
| Chain multiplier | **None.** A rescue neither increments, refreshes nor resets the chain. The Carrier kill itself chains as usual. |

### 3.7 Scoring hooks

- **At collection:** +1 000 *(initial; ≈ one Heavy, GDD §5.2)*, flat, **not** chain-multiplied. Tune once the level-1 economy is playable.
- **Level results:** one informational tally line `PILOTS RESCUED 2/3`. No all-or-nothing bonus: a 10 000 "full squadron" bonus turns every missed pod into a dive through bullets, which is the frustration path the reward-only rule exists to prevent.
- **Ending card:** run total `n/9` selects one of two 2-sentence variants (§3.9). No other reward; the 1-UP rule (GDD §4.4) is unchanged.

### 3.8 HUD

- Left side band (GDD §9.2, outside the play field): one item `PILOTS 2/3` (8×8 pod glyph + text) under the bomb counter; on narrow screens it joins the top strip. No portraits, no greyed slots: a persistent failure flag on screen is a penalty in disguise.
- The `+1000` pop-up reuses the existing floating score pop-up.

### 3.9 Narrative (inside "minimal narration")

- Intro card (1.1): "The armada took your squadron. Go get them." / "L'armada a capturé votre escadrille. Allez la chercher."
- Ending card, two variants, neutral tone: `9/9` → "Nine went in. Nine came home." · otherwise → "The armada is dust. {count} of nine came home." (ICU plural in the catalogue). No guilt-trip variant.
- Optional: level title-card suffix "3 PILOTS HELD" (one key).
- i18n: 5 keys × 2 languages (`pickup.pilot.label`, `hud.pilots`, `tally.pilotsRescued`, `intro.body`, `ending.body` with two variants).

### 3.10 Visual & audio language (works without colour)

- **Silhouette first.** 16×16 cell: rounded capsule body ~8×12 px with a **wide beacon ring 16×3 px on top** (wider at the top than tall). Nothing else that falls has this outline: P pickups are lettered capsules, Shield a ring, Bomb a "B", 1-UP a ship icon; Popcorn and Divers are angular ships. It is a body, never a glyph.
- **Animation:** 3-frame ring wobble / thruster flicker at 4 Hz (shape animation, no luminance change).
- **Beacon:** 2×2 px **hue pulse amber ↔ orange at ≤ 2 Hz**, never white, never luminance-only. It is not a flash, so it **stays on when the white-flash toggle is off**: a safety setting must never remove gameplay information. No extra spawn flash (the explosion already is one).
- **Colour:** hull in neutral light grey (no falling object is grey); beacon hue chosen **last**, after the bullet palette is fixed, avoiding red / blue / cyan / yellow / green (the five pickups), white (stars, flashes) and the bullet hues. Gate: greyscale screenshot at ×1 and ×3 in which the pod is identifiable among the five pickups, 20 bullets and a Popcorn formation by outline alone.
- **Z-order:** pickup layer, **below** enemy bullets and player shots. A sprite drawn above bullets hides them, and "it came out from behind the pod" is the least fair death possible.
- **Audio** (jsfxr, 2 new SFX ids): `podDistress` — short two-note descending beep at spawn and once more on `Leaving`; `rescue` — two-note ascending chime (~440 → 660 Hz, 120 ms), a timbre distinct from the single-blip pickup sound. Gamepad: 60 ms light rumble on rescue, nothing on loss.

### 3.11 Accessibility

- No information by colour alone: outline + shape animation + beacon + unique SFX + first-appearance label.
- Blink ≤ 2 Hz and hue-based (under WCAG 2.3.1, independent of the white-flash toggle); under `prefers-reduced-motion` the ring wobble may freeze, the beacon pulse stays.
- Touch: full-sprite collection box, audible `Leaving` cue, first pod in the upper third; the ship already follows the finger with a vertical offset (GDD §4.2).
- Verify with Chrome DevTools "Emulate vision deficiencies" (deuteranopia, protanopia, tritanopia, achromatopsia) on the greyscale test screenshot.

## 4. Variants considered

| Variant | Status | Why |
|---|---|---|
| **A. Owner's original** — random ejection from any ship, friends and foes, catch one / avoid the other | **Rejected** | First falling object that hurts; unreadable at 16 px under bullets; unfair to colour-blind players; autofire makes "avoid" meaningless; RNG breaks the tally and the deterministic scripts; "sometimes" is fine for drops but not for a counted roster |
| B. Friends + hostile pod as shootable 1-HP chain fuel, contact = chain reset | Rejected (3/3) | Still a classification task under threat; an invisible punishment (one HUD digit); second sprite set and faction logic; once shootable, the dilemma vanishes |
| C. Friends + hostile ejectee fleeing upward, non-collidable | Rejected (3/3) | A Diver that runs away: new sprite, zero decision, keeps the "shooting ejected crew" tone problem |
| **D. Friends only, Carrier-scripted, reward-only, flat score** | **Recommended** (this spec) | Preserves the §4.6 invariant, zero RNG, zero new entity class, one sprite, honest tally |
| E. Rescues replace the 1-UP pickup (every N = 1 life) | Not recommended (2/3) | Reopens a fixed rule; N is a guess (3 / 8 / 10); gates lives behind catch skill on a single Normal profile; platform-dependent on touch |
| F. Pod carries a pickup letter (Sky Soldiers model) | Rejected (3/3) | Sub-4 px glyph on a moving body; value unknown until caught; needs 4–5 pod art variants |
| G. Pods from boss phase breaks | Rejected (2/3) | Worst moment for a new read; stall against the 90 s timer; hooks into the three riskiest state machines |
| H. L3 captured allied fighter as a "do not shoot" boss part (Galaga) | Rejected (3/3) | Impossible under autofire; a punishment on the final boss |
| I. Roster — 9 named pilots, portraits, roll-call scene, 3 endings | Deferred to 1.2 at most; portraits never | 8×8 faces are unreadable; visor-colour identity is colour-only; a new scene; 1–2 weeks of content |
| J. Machine-hazard pod (drone core, never a person) | Not planned | Only with external playtest evidence that 1.1 players want a risk layer |

## 5. Risks & mitigations

| Risk | Mitigation in this spec |
|---|---|
| The pod is the first custom animated body sprite for a non-pixel-artist; no CC0 pack has it | Draw it on day 1 of the 1.1 branch; greyscale + CVD gate; if it fails, stop and park the feature (deletion rule written in `PROJECT_LOG.md` before the first commit) |
| Chase deaths blamed on the pod | Flat score (chasing is never the optimal line), no chain interaction, no miss penalty, upper-third placement, no pod within 6 s of a Heavy or in boss fights |
| Pod read as a Diver | No homing, straight fall, rounded outline + ring vs angular ships, Emerging kick |
| Bullet occlusion | Pickup layer, below bullets |
| Pickup paranoia / §4.6 invariant | No falling object ever hurts; the pod is a pickup |
| Scope creep ("one more small thing") | Explicit never-planned list (§6.3), 5-day time-box, one PR |
| Recurring tuning tax on level scripts | 3 pods per level only; script-lint test fails on structural violations; headless simulation counts rescued/lost per level |
| Photosensitivity regression | Beacon is a hue pulse, not a flash; no new white flash; verified with the toggle off |
| Palette exhaustion (red, blue, cyan, yellow, green, white already taken) | Grey hull, outline-first design, hue chosen after the bullet palette |
| Touch: catch under the thumb, non-integer phone scaling | Vertical finger offset (GDD §4.2), full-sprite collection box, audible `Leaving` cue, one phone run in the acceptance checks |
| Store-page lock-in | Title, key art and GIF are not rebuilt around the pod before it ships; 1.1 refreshes the page |
| Determinism | Zero RNG in the mechanic; existing seeded simulation tests cover replay |

## 6. Scope (1.0 vs 1.x) and production cost

### 6.1 In 1.0 — seams only (≈ 0.5 day, no pod)

- Pickup behaviour driven by a per-type definition table (sprite, frames, SFX, collect effect, `emerge` flag) rather than `switch` statements, so a sixth type is one row (the GDD §5.3 "data, not classes" principle applied to pickups).
- `pickup:lost` emitted for every pickup leaving the bottom edge (also useful for the 1.x end-of-run statistics).
- Carrier cargo chosen by the level script: already decided (§5.2), nothing to do.
- Nothing else: no flag, no sprite, no strings.

### 6.2 1.1 "Rescue your squadron" — minimal cut (= §3), time-boxed 5 days

| Item | Estimate |
|---|---|
| GDD revision PR (§4.6 row, §8 line, §9.2 / §9.5 additions, §12 → adopted, decision record) | 0.25 d |
| UML (use case, class delta, pickup state update, sequence) | 0.5 d |
| Code (type, definition row, Emerging phase, lint rules, ScoreSystem / HUD / results / ending handlers, i18n) | 1 d |
| Tests (≈ 8 unit + 3 script-lint + 2 headless-simulation scenarios) | 0.5 d |
| Art: pod 3 frames + HUD glyph (**the swing**) | 0.5–2 d |
| SFX × 2 | 0.1 d |
| Script placement + tuning on 3 levels | 0.5 d (+ ~30 min per later script revision) |
| **Total** | **3.5–5.5 d** |

Deletion rule (in `PROJECT_LOG.md` before the first commit): sprite fails the greyscale/CVD check by end of day 1 → stop; not merged by day 5 → branch parked, feature stays a 1.2 candidate.

### 6.3 1.2+ candidates (each its own PR, each gated on 1.1 reception)

Scripted pods from Heavy (released 0.5 s after its own drop with a 24 px offset; only if 9 per run feels thin) · "N PILOTS HELD" title cards if not done in 1.1 · a one-line roll call on the ending card · cosmetic ejection debris in hostile explosions · end-of-run statistics line.

**Never planned:** hostile ejectees in any form, boss pods, homing, lettered pods, pickup-family collapse, 1-UP coupling, all-or-nothing bonus, chain interaction, portraits.

## 7. Acceptance checks the owner can run alone

1. Greyscale screenshot at ×1 and ×3: the pod is identifiable by outline among the 5 pickups, 20 bullets and a Popcorn formation.
2. The same screenshot under DevTools vision-deficiency emulation (4 modes).
3. Headless simulation: level 1 with a scripted "catch everything" input → 3/3; idle input → 0/3 and three `pickup:lost`; identical counts on two runs with the same seed.
4. Dev overlay: rescued/lost per level and deaths within 1 s of a pod spawn, over 3 keyboard runs of level 1 by the owner: ≥ 2/3 rescued per run, zero deaths attributable to occlusion.
5. One run on an Android phone (touch): ≥ 2/3 rescued; distress beep audible on `Leaving`; white-flash toggle off → beacon still visible.

## 8. Architecture & UML impact

### 8.1 Classes / types (named exports, no `any`)

| Element | Change |
|---|---|
| `PickupType` | + `Pilot` |
| `PickupDefinition` | Per-type table (new in 1.0 as a seam, or existing): `{ type, sprite, frames, spawnSfx?, collectSfx, emerge: boolean, effect: PickupEffect }`; `Pilot` row has `emerge: true`, `effect: 'rescue'` |
| `Pickup` (pooled entity) | Optional `Emerging` phase (0.5 s, vy −48 → +40 px/s) driven by `definition.emerge`; `Leaving` threshold (y > 280) emits `pickup:leaving` once; **no `Pilot`-specific branch** |
| `SpawnEvent` (Carrier) | No schema change: `carrying: PickupType` accepts `Pilot` |
| `LevelScriptValidator` | New rule set `rescueRules` (§3.3 lint) |
| `RescueTally` | New value object `{ rescued: number; held: number }`; `LevelResult.rescue`, `RunResult.rescue` (sum) |
| `ScoreSystem` | On `pickup:collected` with `Pilot`: `+RESCUE_POINTS`, no `ChainTracker` call |
| `Hud` | + pilots item |
| `ResultsScene`, `EndingScene` | + tally line; + variant selection on `RunResult.rescue` |
| `MessageCatalogue` | + 5 keys (EN / FR) |
| `AudioPort` SFX ids | + `podDistress`, `rescue` |
| `DifficultyProfile` | Unchanged (the mechanic is not rate-based) |

Not added: no `Ejectee` class, no `Faction` enum, no `EjectTable`, no second player hitbox, no render layer, no RNG consumer, no feature flag (1.1 is a release, not a toggle).

### 8.2 Events (event bus)

| Event | Payload | Status | Subscribers |
|---|---|---|---|
| `pickup:spawned` | `{ type, position }` | existing | Audio (`podDistress` for `Pilot`) |
| `pickup:collected` | `{ type, position }` | existing | ScoreSystem (+1 000, no chain), Hud (counter), Audio (`rescue`), game feel (pop-up) |
| `pickup:leaving` | `{ type }` | **new**, all pickups | Audio (`podDistress` for `Pilot`) |
| `pickup:lost` | `{ type }` | **new**, all pickups | RescueTally (`Pilot` only) |
| `level:completed` | `{ result: LevelResult }` | existing; payload + `rescue` | ResultsScene |

### 8.3 States

Pickup state machine (updated for all pickups; `Emerging` only when `definition.emerge`):

```
[*] → Emerging (0.5 s) → Falling → Leaving (y > 280) → Lost (y > 320) → [*]
      Emerging | Falling | Leaving → Collected (ship contact) → [*]
```

Scene state machine, boss state machines and the chain state machine are **unchanged**.

### 8.4 Diagrams to add or update (Mermaid, before any code)

- `docs/architecture/diagrams/rescue-pods/01-use-case.md` — actor Player, goal **"Rescue captured pilot"** (actor-initiated; "pod ejects" is a trigger, not a use case); `<<include>>` Destroy Carrier, `<<extend>>` Catch pickup; grouped in the Collect domain, not by component.
- `02-class.md` — the §8.1 delta against the existing pickup / enemy / score classes.
- `03-state.md` — the pickup state machine above.
- `04-sequence.md` — Carrier carrying `Pilot` destroyed → explosion → delayed spawn → Emerging / Falling → (a) ship contact → `pickup:collected` → ScoreSystem / Hud / Audio; (b) bottom exit → `pickup:lost` → RescueTally → ResultsScene.
- Existing use-case and class diagrams gain the use case and the `Pilot` row; component and data-flow diagrams are unchanged.

### 8.5 Fixed decisions touched (revised explicitly in the 1.1 GDD PR, per CLAUDE.md "validated decisions are not reopened silently")

- §4.6 pickup table: six rows. The §4.6 invariant "everything that falls is good to catch" is **preserved**.
- §3.4 intro / ending text: still two sentences each; the ending gains one conditional variant.
- §8 tally: one informational line. §9.2 HUD: one item. §9.5 SFX: two ids.
- §12 → "adopted in 1.1, narrowed"; decision-record row updated.
- Untouched: the 1-UP rule, bombs, chain, `DifficultyProfile`, the touch model, determinism, the no-allocation rule (pool reused), and the art and rules of the five existing pickups.

## 9. Open questions

| # | Question | When |
|---|---|---|
| 1 | Beacon hue once the bullet palette exists; can the owner draw a pod that passes the greyscale/CVD gate, or is this the first commissioned sprite? | Day 1 of the 1.1 branch |
| 2 | `RESCUE_POINTS` (1 000 initial) once the level-1 economy is playable | Vertical-slice playtests |
| 3 | 3/3/3 pods per level or a 2/3/4 ramp (9 per run either way)? | Level-script authoring |
| 4 | First `Pilot` Carrier of level 1: before the 45 s Heavy or after it leaves? | Level-script authoring |
| 5 | "N PILOTS HELD" on title cards in 1.1 or 1.2? | 1.1 GDD PR |
| 6 | Commercial title: choose it independently of the mechanic; re-evaluate a rescue-flavoured title (e.g. "Nine Lights", "Bring Them Home") only when 1.1 ships and the store page is refreshed | Before the custom-asset phase / at 1.1 |
| 7 | Cosmetic "ejection debris" in hostile explosions, to keep the owner's "crews bail out" flavour at zero gameplay cost? | 1.2 |
