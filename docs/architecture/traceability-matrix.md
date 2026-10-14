# Traceability matrix — UML study (1.0)

> **Scope**: the UML study of [docs/architecture](README.md) against the
> [Game Design Document](../design/game-design-document.md) v0.12, ADR-0001 to ADR-0010,
> ADR-0014, ADR-0015, ADR-0018, ADR-0019 to ADR-0024 (ADR-0011 to ADR-0013 are tooling decisions, and ADR-0016 and ADR-0017 deployment and catalogue decisions, with no UML realization).
> **Purpose**: prove coverage — every use case is realized, every class and component is used,
> nothing is orphaned. Update this file in the same change as any diagram.

Diagram abbreviations: **UC** [01-use-case](diagrams/system/01-use-case.md) · **CMP**
[03-component](diagrams/system/03-component.md) · **CD**
[04-class-domain](diagrams/gameplay/04-class-domain.md) · **SD-tick** [02-sequence-fixed-step-tick](diagrams/gameplay/02-sequence-fixed-step-tick.md) ·
**SD-kill** [02-sequence-enemy-destroyed](diagrams/gameplay/02-sequence-enemy-destroyed.md) ·
**SD-hit** [02-sequence-player-hit](diagrams/gameplay/02-sequence-player-hit.md) · **SD-bomb**
[02-sequence-bomb](diagrams/gameplay/02-sequence-bomb.md) · **SD-boss**
[02-sequence-boss-fight](diagrams/gameplay/02-sequence-boss-fight.md) · **STM-player**
[05-state-player](diagrams/gameplay/05-state-player.md) · **STM-boss**
[05-state-boss](diagrams/gameplay/05-state-boss.md) · **STM-scenes**
[05-state-scenes](diagrams/meta/05-state-scenes.md).

## 1. Use cases → realizations

| Use case | Components (CMP) | Behaviour | Structure (CD) | Covered by text only |
|---|---|---|---|---|
| UC1 Play a run | FrameLoop, SceneMachine, Run, RunPresenter, LevelScripts, SeededRandom, all ports | SD-tick, SD-kill, SD-hit, SD-bomb, SD-boss, STM-player, STM-boss, STM-scenes (`InRun`, `Results`) | every class of CD | intro and level cards (STM-scenes); the slice end (UC1 9a) |
| UC2 Pause the run | FrameLoop, SceneMachine, DeviceInput, WebAudioPlayer | SD-tick (pause decided before the step), STM-scenes (`Paused`, `Count-in`, `Confirm quit`) | — (scene level, no run class) | music ducking (ADR-0009) |
| UC3 Record a high score | SceneMachine, SaveDocument, LocalStorageStore | STM-scenes (`Name entry` → `High scores`) | `RunView.snapshot().score` | insertion rule and storage failure (UC3 text, ADR-0006) |
| UC4 Consult the high scores | SceneMachine, SaveDocument, LocalStorageStore | STM-scenes (`High scores`) | — | unreadable or newer document (UC4 text, ADR-0006) |
| UC5 Configure the game | SceneMachine, SaveDocument, WebAudioPlayer, DeviceInput | STM-scenes (`Options` from title and pause) | — | each option (GDD §9.3); fullscreen in the gesture handler (ADR-0009) |
| UC6 Remap the controls | SceneMachine, DeviceInput, SaveDocument | — | — | slots, swap, capture (UC6 text, GDD §4.2, ADR-0009) |
| UC7 Read the credits | SceneMachine, MessageCatalogue | STM-scenes (`Credits`) | — | mirrors `CREDITS.md` (ADR-0005) |

UC2 to UC7 are realized at the screen level only: they are plain navigation, reads and writes,
whose conditional steps live in the use-case text (proportionality rule of the study).

## 2. Classes of the domain model → where they are used

SD-boss (added with the level brick) uses `Run`, `RunRules`, `World`, `LevelDirector`, `EnemySpawner` (`startBoss`), `HitRules` (`damageBoss`), `CollisionResolver`, `Boss`, `BossState`, `EventBus`, `ScoreKeeper`, `LevelTally` and `RunView` (`outcome`, `tally`); it is not a column below.

| Class (CD) | SD-tick | SD-kill | SD-hit | SD-bomb | STM | GDD |
|---|---|---|---|---|---|---|
| `Simulation`, `Run`, `RunConfig` | ✓ | ✓ | ✓ | ✓ | outcome read by STM-scenes; step 8 by STM-player | §2, §7 |
| `RunView`, `RunOutcome` | ✓ | | | | STM-scenes guards | §9.2 |
| `Random` | | ✓ (drop draw) | | | | §4.6, §7.1 |
| `World` | | ✓ | ✓ | ✓ (`cancelEnemyBullets`) | | §5 |
| `WorldView`, `PlayerShotSpawner`, `EnemyShotSpawner`, `EnemySpawner`, `HitRules`, `RunEvents` | | ✓ (`HitRules`) | ✓ (`HitRules`) | | spawners: CD only (unit tests) | §5.3 |
| `Player`, `PlayerState`, `HitOutcome` | | ✓ (`collect`) | ✓ | ✓ (`useBomb`) | STM-player | §4.1, §4.4, §4.5 |
| `Weapon`, `WeaponKind`, `WeaponLevel`, `ShotSpec` | | | ✓ (`powerDown`) | | | §4.3 |
| `Bullet` | | ✓ (`canHit`, `recordHit`) | ✓ (released) | ✓ (cancelled) | | §4.3 |
| `Pickup`, `PickupKind`, `PickupMotion` | | ✓ (spawned, moved, collected) | ✓ (death release spawned) | ✓ (drops of bomb kills) | STM-player (collection guard) | §4.4, §4.6 |
| `FixedPool<T>` | | ✓ (releases) | ✓ | ✓ | | ADR-0002, ADR-0024 |
| `ScoreKeeper`, `LevelTally`, `TallyTuning` | | ✓ (`formationsCleared`) | ✓ (`lifeLost`) | ✓ (`bombUsed`) | STM-boss (bonuses), STM-scenes (`Results`), SD-boss | §8 |
| `CollisionResolver` | | ✓ (passes 1 and 4) | ✓ (passes 2 and 3) | | | §4.1, §4.6, §5.2 |
| `LevelDirector`, `LevelScript` | | ✓ (`dominantColour`, a formation per pass) | | | STM-boss (`warningAt`, `startBoss`), SD-boss | §7.1, §7.2.2 |
| `ScriptEvent` | | ✓ (cargo) | | | CD rule table (Carrier cargo, load checks, spawns) | §5.2, §7.1, §7.2.1 |
| `EventBus`, `GameEvent`, `GameEventKind` | | ✓ | ✓ | ✓ (`BOMB_USED`) | STM-boss (events) | ADR-0010 |
| `DifficultyProfile` | | ✓ (`dropRateScale`) | ✓ (`bombsPerLife`) | | | §10 |
| `Body`, `Enemy`, `EnemyArchetype`, `EnemyStats`, `SizeTier`, `DropTable` | | ✓ | | ✓ (on-field damage) | | §5.2, §5.3, §5.2.1 |
| `MovementPattern`, `PathMovement`, `DiveMovement`, `EnterHoldLeave`, `CrossMovement`, `SwayMovement` | | | | | STM-boss (phase strategies, Cruiser table) | §5.2, §5.2.1, §6.1 |
| `AttackPattern`, `NoAttack`, `AimedAttack`, `RingAttack`, `FanAttack`, `SequenceAttack` | | | | | STM-boss (phase strategies, Cruiser table) | §5.2, §5.2.1, §6.1 |
| `StrategyFactories` | | | | | CD rule table (Heavy, strategies built from data) | §5.2.1, §6.1 (ADR-0022) |
| `Formation` | | ✓ | | ✓ (bomb kills count) | | §5.2, §4.6 |
| `Boss`, `BossState`, `BossDefinition`, `BossPhaseSpec` | | (via `damageBoss`) | ✓ (boss contact, pass 3) | ✓ (`damageBoss` while `FIGHTING`) | STM-boss, SD-boss | §6, §6.1 |

Every class is used by at least one behaviour diagram or by the GDD rule table of CD. The
movement and attack strategies are exercised per archetype by the level scripts; their behaviour
is a calculation covered by unit tests (ADR-0003), not by a diagram.

## 3. Components → where they appear

| Component (CMP) | Diagrams |
|---|---|
| Bootstrap | CMP (the run factory and its seed, ADR-0019) |
| FrameLoop | SD-tick |
| SceneMachine | SD-tick, STM-scenes, SD-boss (`Results`) |
| Run | SD-tick, SD-kill, SD-hit, SD-bomb, SD-boss, CD |
| RunPresenter | SD-tick, SD-kill, SD-hit, SD-bomb (flash, shake), SD-boss (debris, slow motion), STM-scenes (WARNING, HP bar) |
| LevelScripts | CD (`LevelScript`, archetypes, `BossDefinition`), STM-boss, SD-boss |
| SaveDocument | STM-scenes (`Boot`, `Name entry`), UC3–UC6 text |
| MessageCatalogue | CMP; implied by UC7 and the cards and menus of STM-scenes |
| SeededRandom | SD-kill (`Random`), CD (`Run` owns it); in the code since PR #5 but unused by the game; owned by `Run` from the player-kit brick E-1 (ADR-0019) |
| Canvas2DRenderer, DeviceInput, PerformanceClock | SD-tick (through `RenderPort`, `InputPort`, `Clock`), CMP |
| WebAudioPlayer | SD-kill and SD-hit (SFX through the presenter), CMP |
| LocalStorageStore | STM-scenes (`Boot`, `Name entry`), CMP |

## 4. Decisions → where they are realized

| Decision | Realized in |
|---|---|
| ADR-0001 RenderPort, ADR-0010 HUD region | SD-tick (`setRegion`), CMP |
| ADR-0002 fixed step, clamp, interpolation, pools, seeded Random | SD-tick, SD-kill, CD (`previousPosition`, pools) |
| ADR-0003 composition, Strategy, Observer, ports, layout | CD, CMP |
| ADR-0006 save document | UC3–UC5 text, STM-scenes |
| ADR-0009 intent frame, gestures, audio mix | SD-tick (`read(frame)`), STM-scenes (pause rules), CMP |
| ADR-0010 outcome vs presentation | SD-tick (time scale), SD-kill (handler rules), CD (`Body`, events) |
| ADR-0014 logical screen, regions, `dt` in seconds | SD-tick (`step(1/60 s)`), CMP (Canvas2DRenderer) |
| ADR-0015 portrait screen, devices together, injected browser objects, default bindings | CMP (Bootstrap, Canvas2DRenderer, DeviceInput), STM-scenes (first-playable subset, build order); tests: layout choice, pointer mapping, arbitration function, keyboard and gamepad rules, lost focus, default bindings (ADR-0015 Consequences) |
| ADR-0018 taps, takeover, rounding, listeners | CMP (DeviceInput, Bootstrap), STM-scenes (devices brick additions); tests: HUD tap wins over a field tap and the first tap wins within a region, pointer mapping floored in both layouts at pixel ratio 2, touch first finger and offset, second-finger bomb, pen and `pointercancel`, a mouse move over the HUD or letterbox never takes the ship, a left click on the HUD never steers, a right click bombs on the field only, stick rounded toward zero never above length 1, fixed A/B/Start roles kept after a remap, gamepad loss pauses and never resumes, layout change drops the tap and pauses (not at boot), renderer `resize` resets region and camera without `restore()`, sequence-ordered arbitration; the pixel-ratio listener and the page CSS are covered by the smoke test only |
| GDD v0.2–v0.4 rules surfaced by the study | GDD Decision record; CD rule table |
| GDD v0.5 first-playable values (fly-in, clamp, blink, base shot) | STM-player notes (fly-in, blink, one timer), CD rule table and notes (clamp, Spread L1, units, active lists); tests: fly-in and state steps, clamp, cadence of 10 shots per 60 steps, bullet release, blink phase, smoke test (STM-scenes) |
| GDD v0.6 enemy values and script rows (§5.2.1, §7.2.1), chain window, game-over time, reserve-life icons | STM-scenes (enemies brick additions, scene traits, frozen scenes, interim deviations), SD-kill and SD-hit (mark, then release at step 6), SD-tick (frozen scenes at alpha 1), CD rule table and notes (`HitRules`, spawners, `spent`, `entered`, `armed`, `ActiveList`, events, HUD data); tests: pool caps and dropped requests, S curve and mirror, Diver target captured at the dive, Gunner entry, hold and 3 bullets per hover (GDD v0.11), zero aim vector, entered-then-outside despawn, destroyed once with two bullets in one step, chain at the 5th and 6th kill and at +120 / +121 steps, death and respawn, game over after 3 s or Confirm, script loop at 45 s, frozen scenes at alpha 1 with effects frozen, re-entrant publish throws, determinism with effects on and off, enemy hitboxes 16 × 16 / 16 × 16 / 32 × 32, enemy bullets 4 × 4 at 75 px/s, hit flash about 33 ms and explosion about 0.3 s of wall time, at most 16 explosions with the oldest recycled, one life icon per reserve life, formation refused members still earn the P, chain bar full right after a kill and empty when the chain breaks, script rows checked at load (interval), an effect recorded in the last step of a multi-step frame drawn once at age 0, no effect aged by a frame that ran a frozen step (count-in handoff), a collected pickup released at step 6, peak enemy bullets ≤ 40 over the whole level script, a lone Popcorn never forms a formation and a Popcorn group outside 5 to 8 is rejected at load, a formation whose last rank is refused still earns its P once, the formation pool never empties over a level script; with hit-stop (later brick), a hit-stop born in a 30 Hz frame still freezes the next frame |
| GDD v0.7 devices brick (§4.2 pause button, Start as confirm, mouse cursor and takeover; §4.4 Game over and title locks; §9.1 rotation pause; §9.2 portrait strip) | STM-scenes (devices brick additions, scene × input table, build order), CMP (Bootstrap, DeviceInput); tests: screen choice table, portrait field clip and strip positions, pause button drawn only in Playing, Paused and Count-in, pause tap in Playing (before the step) and Count-in, any tap resumes from Paused, Start in Count-in returns to Paused, Game over and title locks at step 60 / 61, smoke test (portrait then rotation) |
| ADR-0019 run seed, tenths, weapons as data, pickups, formations, bomb slot | CD (`RunConfig`, `Random`, `WeaponLevel`, `ShotSpec`, `Pickup`, `Formation`, `EnemySpawner`, `HitRules`, rule table and notes), SD-kill (seeded draw, pierce memory, collection pass), SD-hit (release motion, `ABSORBED`), SD-bomb (slot 3), STM-player (a timer per cause), CMP (Bootstrap, Run, SeededRandom), STM-scenes (player-kit brick additions, build order) |
| GDD v0.8 player kit (§4.3 Spread and Laser tables; §4.4 release hop, shield, death effects at once; §4.5 bomb guard and one step; §4.6 pickup rules and P colours; §5.2.1 Carrier; §7.2.1 Carrier rows; §9.2 HUD items; §9.3, §9.4 bomb flash and shake) | CD rule table, SD-kill (both diagrams), SD-hit, SD-bomb, STM-player, STM-scenes (player-kit brick additions); tests: a drop forced by a scripted `Random` and none at r ≥ rate × scale, one draw choosing a Gunner's drop and colour, the formation P of the dominant colour at the last member once per pass (also above the field), sway and release hop as closed forms with x0 clamped, collection while `Entering`, `Invulnerable` and `Vulnerable` only and none in a death step, two pickups in one step applied in order (the last P sets the weapon), a spawn on a full pickup pool dropped, a pickup lost at the bottom, the cap bonus flat and outside the chain, an other-colour P at level 5 switches and pays, Spread streams, angles, cooldowns 6 and 4 steps and damage in tenths, a Popcorn dying in one hit at every level, a Laser bolt hitting N + 1 bodies each once with full damage, the cooldown kept across a switch, power down without a kind change, the release on the last life, bombs reset at the death step, bomb guard (not `Entering`, `Dead`, after Game over), one bomb per press, bullets cancelled and on-field enemies hit once (off-field ones untouched), bomb kills scored, chained and counted, `max(time left, 1 s)`, shield absorbing a bullet (spent) and a body (survives) with the blink restarted, a Carrier crossing at 60 px/s from either side with its cargo, cargo load checks (`RangeError`), the HUD items at their positions in both layouts, a bomb burst flashing at most 3 times per second, determinism with (seed, script, inputs) including `PICKUP_SPAWNED` and `PICKUP_COLLECTED` |
| ADR-0020 pointer fire (held left button, steering finger, autofire option) | STM-scenes (design revision v0.9, build order); tests: touch holds `Fire` only while a finger steers (lift and `pointercancel` drop it, a second finger adds none), the mouse holds `Fire` from a left press on the field until the left bit is lost (up, move, cancel, lost focus), a left press or hold on the HUD never fires, the right button never fires, both samples `autofire = false`; with the options brick, the option restores the v0.8 samples and the arbitration mask |
| ADR-0021 hall of fame entry (name, optional country, allowlist, preselection on confirmation) | UC3 and UC4 text, STM-scenes (design revision v0.9, build order); tests with the screens brick: `parseSaveDocument` keeps a valid entry with and without a country, drops a 9-character, lowercase, all-space or untrimmed name and a country `fr`, `ZZ` or `FRA`, accepts `???`; the preselection from `fr-FR` gives `FR`, from `fr` none and is not stored without confirmation |
| GDD v0.9 (§3.2 shot proportions; §7.1, §10 difficulty ramp; §8, §9.1, §9.8 named top 10 and country; §4.2, §9.3 pointer fire and autofire option) | STM-scenes (design revision v0.9, build order), UC3 and UC4 text (name, country), ADR-0020, ADR-0021; tests: enemy bullets drawn 6 × 6 with the core while the hitbox stays 4 × 4, Spread drawn 2 × 6 at 60 % opacity with a 2 × 8 hitbox (presenter, mocked `RenderPort`); with the screens brick, `parseSaveDocument` drops a name outside A–Z, 0–9, space or longer than 8 (except `???`) and a country outside the allowlist, the preselection from `fr-FR` gives `FR` and a language without region gives none |
| ADR-0022 strategy factories, the boss outside the enemy pool, level list, `damageBoss`, events, `LevelTally`, `Results`, the one-level slice | CD (`StrategyFactories`, `Body.volleys`, `SizeTier`, `Boss`, `BossState`, `BossDefinition`, `EnemySpawner.startBoss`, `HitRules.damageBoss`, `RunConfig.levels`, `LevelTally`, `TallyTuning`, rule table and notes), STM-boss, SD-boss, SD-bomb (boss only while fighting), SD-kill and SD-hit (tally hooks), STM-scenes (level brick additions, build order F-0 to F-3), UC1 9a; tests: listed in ADR-0022 Consequences — the Gunner unchanged after the refactor, the Heavy's movement, ring turning every other volley and fan, the Cruiser's sway and phases, two thresholds in one bomb, no damage before `FIGHTING`, contact only in `ENTERING` and `FIGHTING`, flee on timer, destruction winning a tie, the flat bonus from the seconds shown, the tally lines, the `warningAt` − 4 s load check, the level simulation at ≤ 16 enemies and ≤ 40 enemy bullets with determinism, the `Results` lock, lines and 8 s exit to the next card or the title, the `hud` font drawing a space and still throwing on any other character outside its set |
| ADR-0023 boss fight: `fire`/`tick` patterns, group sequences, movement age, `BossTuning`, boss view `stateSteps`, F-2 in three PRs, `Run` size checkpoint | CD (`AttackPattern.fire`, `StrategyFactories.sequenceAttack(groups)`, `Body.volleys`/`age` notes, `Boss.movementPhase`, `BossDefinition` without a bonus, boss view note), STM-boss (Cruiser table, sway continuity, end of the sequence), STM-scenes (build order F-2-0 to F-2c); tests, listed in ADR-0023 Consequences: `fire` per count, phase 1 and phase 2 sequences (ring turned by 11.25° per volley, the triple from 3 s on every second volley), the sway through a phase change from both directions, the seeded replay through the boss; built in F-2a in `tests/domain/{attack-patterns,sway,boss,boss-run,collision,score-keeper,level-director,level-simulation,scene-machine,run-presenter}.test.ts` |
| ADR-0024 retire the `Pool<T>` interface: `FixedPool<T>` is the pool contract | CD (`FixedPool~T~` replaces `Pool~T~`, the «pooled» stereotype, `World`'s pools); code: the interface and its unused `size` removed by the refactor PR that follows; tests: `fixed-pool.test.ts` unchanged apart from the `size` case; review check: no new interface over a single implementation (Knip in `make verify` and CI flags unused exports) |
| GDD v0.10 §9.2 boss HP bar and seconds, §9.7 WARNING blink (F-2b) | CD (`drawBossBar`, `drawWarning`, `BossHudTuning`, boss view `stateSteps`), STM-boss (presentation note), STM-scenes (build order F-2b); tests: `boss-hud.test.ts` (frame, fill, 66 % tick, right-aligned seconds, states, blink twice in 3 s, steady when off, EN / FR), `run-presenter.test.ts`, `scene-machine.test.ts` (banner, pause, swap for the bar) |
| GDD v0.10 §9.4 explosions (tiers, boss, debris), slow motion; §9.3 / §9.7 switches (F-2c) | STM-boss (presentation note), STM-scenes (build order F-2c); tests: `effects.test.ts` (fragments per tier and positions by age, boss core, never white, ring recycles the oldest), `run-presenter.test.ts` (ship explosion, switch off draws nothing, boss chain 1 + 6 at ≥ 1/3 s, debris at the turret, time scale 0.5 for 0.5 s, frozen frames, switch off), `level-simulation.test.ts` (effects on / off determinism), `frame-loop.test.ts` (scale 0.5) |
| GDD v0.10 §8 tally and Results, §9.1 the slice end; ADR-0022 decisions 7 to 9 (F-3) | CD (`LevelTally`, `TallyTuning`, `RunView.tally()`, built-in-F-3 note), STM-scenes (`Results`, built in F-3, pending-pause interim deviation), SD-boss (the tally); tests: `level-tally.test.ts` (each line, a bomb-completed formation, a shield absorb keeping the no-miss, bombs left at `LEVEL_CLEARED`, no boss bonus), `score-keeper.test.ts` (total added flat once, chain unchanged), `tally-run.test.ts` (`RunView.tally()`, a level with a bombed formation, a death and the boss), `results.test.ts` (header, a line every 30 steps, right alignment, grouped digits, 0 for a missed bonus, EN / FR), `scene-machine.test.ts` (1 s lock, 8 s exit, confirm or tap after the lock, title lock), `canvas2d-renderer.test.ts` and `render-port-contract.test.ts` (the `hud` space), `level-simulation.test.ts` (the tally in the seeded replay) |
| GDD v0.10 (§5.2.1 Heavy; §6, §6.1 warning, Cruiser, boss HUD; §7.1, §7.2, §7.2.2 the 120 s level 1; §8 tally and Results; §9.1 the slice end; §9.2 HP bar and seconds; §9.3, §9.4 slow-motion switch, debris; §9.7 WARNING blink) | STM-boss (Cruiser table), SD-boss, CD rule table, STM-scenes (level brick additions), UC1 9 and 9a; tests: the WARNING banner visible 0.75 s of each 1.5 s, the HP bar fill and tick and the seconds from `ENTERING` (presenter, mocked `RenderPort`), slow motion off under reduced motion and never changing the step count |
| GDD v0.11 level-1 balance (#45): §4.6, §5.2, §5.2.1 drop rates and Gunner period, §6.1 Cruiser HP, §7.2.1 rows | CD rule table (drops, `aimedAttack` period), STM-boss (Cruiser HP and phase-2 threshold); tests: `pickups.test.ts` (Gunner P below 10 %, Heavy Bomb or Shield below 30 %, nothing at the rate), `heavy.test.ts`, `enemy.test.ts` (3 bullets per hover at 1, 2 and 3 s), `boss.test.ts` and `boss-run.test.ts` (5 000 tenths, phase 2 at 3 300), `tally-run.test.ts`, `level-director.test.ts` (8-member formations at 0 s and 50 s, the 92 s and 93 s Divers, rows per pass), `level-simulation.test.ts` (Bomb drop replayed on seed 3) |
| GDD v0.12 level-1 balance, second iteration (#45): §4.6, §5.2 and §5.2.1 formation P, §6 and §6.1 Cruiser HP, §7.2, §7.2.1 and §7.2.2 rows without the P | CD (`ScriptEvent.paysP`, `Formation` reward, `rewardIfCleared`), STM-boss (Cruiser HP and phase-2 threshold); tests to change in the tuning PR: `boss.test.ts` and `boss-run.test.ts` (14 500 tenths, phase 2 at 9 570), `tally-run.test.ts`, `level-simulation.test.ts`, and new `level-script` / `run-rules` / `level-director` cases for the flag (design only in this PR: the rows stay unrealized until the tuning PR) |

## 5. Known gaps (accepted)

- ~~`RenderPort.setRegion` signature~~ — closed by ADR-0014 (decision 2).
- The options, remapping and high-score flows have no sequence diagram by design (plain reads and
  writes, specified in their use-case text).
- The rescue mechanic (GDD §12) is out of 1.0 and has no realization.
- Device arbitration (ADR-0015 decision 5) has no state diagram: its rule is textual and lives in
  one pure function, unit-tested.
