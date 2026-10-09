# Traceability matrix — UML study (1.0)

> **Scope**: the UML study of [docs/architecture](README.md) against the
> [Game Design Document](../design/game-design-document.md) v0.5, ADR-0001 to ADR-0010,
> ADR-0014 and ADR-0015 (ADR-0011 to ADR-0013 are tooling decisions with no UML realization).
> **Purpose**: prove coverage — every use case is realized, every class and component is used,
> nothing is orphaned. Update this file in the same change as any diagram.

Diagram abbreviations: **UC** [01-use-case](diagrams/system/01-use-case.md) · **CMP**
[03-component](diagrams/system/03-component.md) · **CD**
[04-class-domain](diagrams/gameplay/04-class-domain.md) · **SD-tick** [02-sequence-fixed-step-tick](diagrams/gameplay/02-sequence-fixed-step-tick.md) ·
**SD-kill** [02-sequence-enemy-destroyed](diagrams/gameplay/02-sequence-enemy-destroyed.md) ·
**SD-hit** [02-sequence-player-hit](diagrams/gameplay/02-sequence-player-hit.md) · **STM-player**
[05-state-player](diagrams/gameplay/05-state-player.md) · **STM-boss**
[05-state-boss](diagrams/gameplay/05-state-boss.md) · **STM-scenes**
[05-state-scenes](diagrams/meta/05-state-scenes.md).

## 1. Use cases → realizations

| Use case | Components (CMP) | Behaviour | Structure (CD) | Covered by text only |
|---|---|---|---|---|
| UC1 Play a run | FrameLoop, SceneMachine, Run, RunPresenter, LevelScripts, all ports | SD-tick, SD-kill, SD-hit, STM-player, STM-boss, STM-scenes (`InRun`) | every class of CD | intro and level cards (STM-scenes) |
| UC2 Pause the run | FrameLoop, SceneMachine, DeviceInput, WebAudioPlayer | SD-tick (pause decided before the step), STM-scenes (`Paused`, `Count-in`, `Confirm quit`) | — (scene level, no run class) | music ducking (ADR-0009) |
| UC3 Record a high score | SceneMachine, SaveDocument, LocalStorageStore | STM-scenes (`Name entry` → `High scores`) | `RunView.score()` | insertion rule and storage failure (UC3 text, ADR-0006) |
| UC4 Consult the high scores | SceneMachine, SaveDocument, LocalStorageStore | STM-scenes (`High scores`) | — | unreadable or newer document (UC4 text, ADR-0006) |
| UC5 Configure the game | SceneMachine, SaveDocument, WebAudioPlayer, DeviceInput | STM-scenes (`Options` from title and pause) | — | each option (GDD §9.3); fullscreen in the gesture handler (ADR-0009) |
| UC6 Remap the controls | SceneMachine, DeviceInput, SaveDocument | — | — | slots, swap, capture (UC6 text, GDD §4.2, ADR-0009) |
| UC7 Read the credits | SceneMachine, MessageCatalogue | STM-scenes (`Credits`) | — | mirrors `CREDITS.md` (ADR-0005) |

UC2 to UC7 are realized at the screen level only: they are plain navigation, reads and writes,
whose conditional steps live in the use-case text (proportionality rule of the study).

## 2. Classes of the domain model → where they are used

| Class (CD) | SD-tick | SD-kill | SD-hit | STM | GDD |
|---|---|---|---|---|---|
| `Simulation`, `Run` | ✓ | ✓ | ✓ | outcome read by STM-scenes; step 8 by STM-player | §2, §7 |
| `RunView`, `RunOutcome` | ✓ | | | STM-scenes guards | §9.2 |
| `World` | | ✓ | ✓ | | §5 |
| `WorldView`, `BulletSpawner` | | | | CD only — parameters of the strategies, covered by unit tests | §5.3 |
| `Player`, `PlayerState`, `HitOutcome` | | | ✓ | STM-player | §4.1, §4.4 |
| `Weapon`, `WeaponKind`, `WeaponPattern`, `SpreadPattern`, `LaserPattern` | | | ✓ (`powerDown`) | | §4.3 |
| `Bullet` | | ✓ (`canHit`, `recordHit`) | ✓ (released) | | §4.3 |
| `Pickup`, `PickupKind` | | ✓ (spawned) | ✓ (death release spawned) | | §4.6 |
| `Pool<T>` | | ✓ (releases) | ✓ | | ADR-0002 |
| `ScoreKeeper`, `LevelTally` | | ✓ | ✓ | STM-boss (bonuses) | §8 |
| `CollisionResolver` | | ✓ | ✓ | | §4.1, §5.2 |
| `LevelDirector`, `LevelScript` | | | | STM-boss (`warningAt`) | §7.1 |
| `ScriptEvent` | | | | CD rule table (Carrier cargo, spawns) | §5.2, §7.1 |
| `EventBus`, `GameEvent`, `GameEventKind` | | ✓ | ✓ | STM-boss (events) | ADR-0010 |
| `DifficultyProfile` | | ✓ (`dropRateScale`) | ✓ (`bombsPerLife`) | | §10 |
| `Body`, `Enemy`, `EnemyArchetype`, `EnemyStats`, `DropTable` | | ✓ | | | §5.2, §5.3 |
| `MovementPattern`, `PathMovement`, `DiveMovement`, `EnterHoldLeave` | | | | STM-boss (phase strategies) | §5.2 |
| `AttackPattern`, `NoAttack`, `AimedAttack`, `RingAttack`, `FanAttack` | | | | STM-boss (phase strategies) | §5.2 |
| `Formation` | | ✓ | | | §5.2 |
| `Boss`, `BossDefinition`, `BossPhaseSpec` | | (via `damageBoss`) | | STM-boss | §6 |

Every class is used by at least one behaviour diagram or by the GDD rule table of CD. The
movement and attack strategies are exercised per archetype by the level scripts; their behaviour
is a calculation covered by unit tests (ADR-0003), not by a diagram.

## 3. Components → where they appear

| Component (CMP) | Diagrams |
|---|---|
| Bootstrap | CMP |
| FrameLoop | SD-tick |
| SceneMachine | SD-tick, STM-scenes |
| Run | SD-tick, SD-kill, SD-hit, CD |
| RunPresenter | SD-tick, SD-kill, SD-hit |
| LevelScripts | CD (`LevelScript`, archetypes), STM-boss |
| SaveDocument | STM-scenes (`Boot`, `Name entry`), UC3–UC6 text |
| MessageCatalogue | CMP; implied by UC7 and the cards and menus of STM-scenes |
| SeededRandom | SD-kill (`Random`) |
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
| GDD v0.2–v0.4 rules surfaced by the study | GDD Decision record; CD rule table |
| GDD v0.5 first-playable values (fly-in, clamp, blink, base shot) | STM-player notes (fly-in, blink, one timer), CD rule table and notes (clamp, Spread L1, units, active lists); tests: fly-in and state steps, clamp, cadence of 10 shots per 60 steps, bullet release, blink phase, smoke test (STM-scenes) |

## 5. Known gaps (accepted)

- ~~`RenderPort.setRegion` signature~~ — closed by ADR-0014 (decision 2).
- The options, remapping and high-score flows have no sequence diagram by design (plain reads and
  writes, specified in their use-case text).
- The rescue mechanic (GDD §12) is out of 1.0 and has no realization.
- Device arbitration (ADR-0015 decision 5) has no state diagram: its rule is textual and lives in
  one pure function, unit-tested.
