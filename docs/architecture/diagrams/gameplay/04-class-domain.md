# Class diagram — gameplay — domain model of a run (1.0)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.3 §4–§8, §10
> **Related ADRs**: ADR-0002 (Simulation, Random, Pool), ADR-0003 (composition, patterns),
> ADR-0009 (IntentFrame — proposed), ADR-0010 (event bus per run, `DropTable` as data,
> presentation outside the outcome — proposed)
> **Realizes**: UC1 of [01-use-case](../system/01-use-case.md); the structure is placed in
> [03-component](../system/03-component.md) (`Run` component)

## Context

The types of the `Run` component: everything that decides the **outcome** of a run, nothing
that only presents it (`RunPresenter`, ADR-0010). Two views of one model:

- **A — run, world, player, scoring**: who owns what during a run, how rules are applied;
- **B — enemies, bosses, level scripts, events**: how enemies are composed from data and
  stateless strategies, and what the run tells its listeners.

Port signatures are owned by their ADRs and are not repeated. The scene machine is in
`meta/05-state-scenes`; the player's and the boss's lifecycles in `gameplay/05-state-*`.
Attributes shown are the ones the GDD rules need, not an exhaustive field list.

**Stereotype legend**: «interface» and «enumeration» are standard UML; «data» marks an
immutable record loaded from the level scripts (shared by every instance using it); «pooled»
marks a class whose instances come from a `Pool<T>` (ADR-0002) and are recycled, never
allocated in the loop; «utility» marks a stateless function module.

## Diagram A — run, world, player, scoring

```mermaid
classDiagram
  direction LR

  class Simulation {
    <<interface>>
    +step(dt, frame: Readonly~IntentFrame~) void
  }
  class RunView {
    <<interface>>
    +levelIndex() number
    +outcome() RunOutcome
    +score() number
    +multiplier() number
    +chainTimeLeft() number
    +lives() number
    +bombs() number
    +shield() boolean
    +weapon() WeaponKind
    +powerLevel() number
    +bossHpRatio() number
    +snapshot() WorldSnapshot
  }
  class Run {
    -levelIndex: number
    +step(dt, frame: Readonly~IntentFrame~) void
    ~destroyEnemy(enemy: Enemy, cause: KillCause) void
    ~damageBoss(amount: number) void
  }
  class RunOutcome {
    <<enumeration>>
    PLAYING
    LEVEL_CLEARED
    RUN_CLEARED
    GAME_OVER
  }
  class DifficultyProfile {
    <<data>>
    +lives: number
    +bombsPerLife: number
    +startShieldCharges: number
    +powerLossOnDeath: number
    +enemyHpScale: number
    +bulletSpeedScale: number
    +dropRateScale: number
  }
  class World {
    -playerBullets: Pool~Bullet~
    -enemyBullets: Pool~Bullet~
    -pickups: Pool~Pickup~
    -enemies: Pool~Enemy~
  }
  class WorldView {
    <<interface>>
    +playerPosition() Vec2
    +time() number
  }
  class BulletSpawner {
    <<interface>>
    +spawnEnemyBullet(x, y, vx, vy) void
    +spawnPlayerBullet(x, y, vx, vy, width, height, damage, pierce) void
  }
  class Player {
    -position: Vec2
    -previousPosition: Vec2
    -lives: number
    -bombs: number
    -shield: boolean
    -invulnerableFor: number
    -respawnIn: number
    +move(frame: IntentFrame, dt) void
    +hit() HitOutcome
    +useBomb() boolean
    +collect(kind: PickupKind) boolean
  }
  class PlayerState {
    <<enumeration>>
  }
  note for PlayerState "Values and transitions in 05-state-player"
  class HitOutcome {
    <<enumeration>>
    IGNORED
    ABSORBED
    DIED
    GAME_OVER
  }
  class Weapon {
    -level: number
    -cooldown: number
    +tick(dt, firing: boolean, spawner: BulletSpawner) void
    +powerUp(kind: WeaponKind) boolean
    +powerDown() boolean
  }
  class WeaponKind {
    <<enumeration>>
    SPREAD
    LASER
  }
  class WeaponPattern {
    <<interface>>
    +fire(level, origin: Vec2, spawner: BulletSpawner) void
  }
  class SpreadPattern
  class LaserPattern
  class Bullet {
    <<pooled>>
    -position: Vec2
    -previousPosition: Vec2
    -velocity: Vec2
    -hitbox: Rect
    -damage: number
    -pierceLeft: number
    -alreadyHit: number[3]
    -alreadyHitCount: number
  }
  class Pickup {
    <<pooled>>
    -position: Vec2
    -previousPosition: Vec2
  }
  class PickupKind {
    <<enumeration>>
    P_RED
    P_BLUE
    SHIELD
    BOMB
    ONE_UP
  }
  class Pool~T~ {
    <<interface>>
    +acquire() T | undefined
    +release(item: T) void
    +size: number
  }
  class ScoreKeeper {
    -score: number
    -chainKills: number
    -chainTimer: number
    +multiplier() number
    +tick(dt) void
  }
  class LevelTally {
    +formationsCleared: number
    +bombUsed: boolean
    +lifeLost: boolean
    +bombsLeft: number
  }
  class Boss {
  }
  class Formation {
  }
  class LevelScript {
  }
  note "Boss, Formation, LevelScript and GameEvent are detailed in view B"
  class CollisionResolver {
    <<utility>>
    +resolve(world: World, run: Run) void
  }
  class LevelDirector {
    -scriptTime: number
    -cursor: number
    +tick(dt, world: World) void
  }
  class EventBus {
    <<interface>>
    +subscribe(kind, handler) Unsubscribe
    +publish(event: GameEvent) void
  }
  class GameEvent {
  }

  Simulation <|.. Run
  RunView <|.. Run
  Run --> "1" RunOutcome : outcome
  Run *-- "1" World
  Run *-- "1" ScoreKeeper
  Run *-- "1" LevelDirector
  Run *-- "1" EventBus
  Run --> "1" DifficultyProfile
  Run ..> CollisionResolver : uses each step
  WorldView <|.. World
  BulletSpawner <|.. World
  World *-- "1" Player
  World *-- "0..1" Boss
  World *-- "0..*" Formation
  World --> "0..*" Bullet : active
  World --> "0..*" Pickup : active
  Player *-- "1" Weapon
  Player --> "1" PlayerState : state
  Player ..> HitOutcome
  Weapon --> "1" WeaponKind : kind
  Weapon ..> WeaponPattern : looks up by kind
  WeaponPattern <|.. SpreadPattern
  WeaponPattern <|.. LaserPattern
  Pickup --> "1" PickupKind : kind
  ScoreKeeper *-- "1" LevelTally
  ScoreKeeper ..> EventBus : subscribes first
  EventBus ..> GameEvent : dispatches
  LevelDirector --> "1" LevelScript : walks
```

## Diagram B — enemies, bosses, level scripts, events

```mermaid
classDiagram
  direction LR

  class Body {
    <<interface>>
    +serial: number
    +position: Vec2
    +previousPosition: Vec2
    +hp: number
    +age: number
    +pathProgress: number
    +fireTimer: number
    +diveTarget: Vec2
    +mirror: boolean
  }
  class Enemy {
    <<pooled>>
    -cargo: PickupKind [0..1]
  }
  class EnemyArchetype {
    <<data>>
    +id: string
  }
  class EnemyStats {
    <<data>>
    +hp: number
    +hitbox: Rect
    +sprite: SpriteId
    +score: number
  }
  class DropTable {
    <<data>>
    +kinds: PickupKind[]
    +rate: number
  }
  class MovementPattern {
    <<interface>>
    +tick(self: Body, world: WorldView, dt) void
  }
  class AttackPattern {
    <<interface>>
    +tick(self: Body, world: WorldView, spawn: BulletSpawner, dt) void
  }
  class PathMovement
  class DiveMovement
  class EnterHoldLeave
  class NoAttack
  class AimedAttack
  class RingAttack
  class FanAttack
  class Formation {
    -total: number
    -destroyed: number
    -escaped: number
    +isCleared() boolean
  }
  class Boss {
    -phaseIndex: number
    -timeLeft: number
  }
  class BossDefinition {
    <<data>>
    +timeLimit: number
  }
  class BossPhaseSpec {
    <<data>>
    +hpThreshold: number
    +brokenPart: SpriteId
  }
  class LevelScript {
    <<data>>
    +dominantColour: WeaponKind
    +warningAt: number
  }
  class ScriptEvent {
    <<data>>
    +at: number
    +count: number
    +path: PathId
    +mirror: boolean
    +cargo: PickupKind [0..1]
  }
  class GameEvent {
    -position: Vec2
    -value: number
    -subject: number
    -detail: number
  }
  class GameEventKind {
    <<enumeration>>
    SHOT_FIRED
    ENEMY_HIT
    ENEMY_DESTROYED
    FORMATION_CLEARED
    PICKUP_SPAWNED
    PICKUP_COLLECTED
    PLAYER_HIT
    PLAYER_DIED
    BOMB_USED
    SCORE_AWARDED
    CHAIN_STEPPED
    BOSS_WARNING
    BOSS_PHASE_CHANGED
    BOSS_DESTROYED
    BOSS_FLED
    LEVEL_CLEARED
  }

  Body <|.. Enemy
  Body <|.. Boss
  Enemy --> "1" EnemyArchetype
  Enemy --> "0..1" Formation
  EnemyArchetype *-- "1" EnemyStats
  EnemyArchetype *-- "1" DropTable
  EnemyArchetype --> "1" MovementPattern
  EnemyArchetype --> "1" AttackPattern
  MovementPattern <|.. PathMovement
  MovementPattern <|.. DiveMovement
  MovementPattern <|.. EnterHoldLeave
  AttackPattern <|.. NoAttack
  AttackPattern <|.. AimedAttack
  AttackPattern <|.. RingAttack
  AttackPattern <|.. FanAttack
  Boss --> "1" BossDefinition
  BossDefinition *-- "1" EnemyStats
  BossDefinition *-- "2..3" BossPhaseSpec
  BossPhaseSpec --> "1" MovementPattern
  BossPhaseSpec --> "1" AttackPattern
  LevelScript *-- "1..*" ScriptEvent
  LevelScript *-- "1" BossDefinition
  ScriptEvent --> "1" EnemyArchetype
  GameEvent --> "1" GameEventKind : kind
```

## How each GDD rule is carried

| Rule (GDD v0.3) | Where it lives |
|---|---|
| Two weapons × 5 levels, Spread first, switch keeps the level (§4.3) | `Weapon.powerUp(kind)`; `kind` selects the stateless `WeaponPattern`; `cooldown` carries the rate |
| Laser width and piercing (§4.3) | fast player bullets with `hitbox`, `pierceLeft`, and `alreadyHit` — the **serials** of the bodies already hit, enemies and boss alike — so one body is hit once per bullet, even when a pooled enemy is reused or the bullet overlaps a large boss for several steps |
| One hit = one life, shield charge, invulnerability (§4.4) | `Player.hit(): HitOutcome` — `IGNORED` while invulnerable, `ABSORBED` by the shield |
| Death: −1 level and release, none at level 1 (§4.4) | `Weapon.powerDown(): boolean`; on `true` the run spawns the release pickup directly |
| Bombs per life, cap, empty stock, hit the boss (§4.5) | `Player.useBomb(): boolean`; the run cancels `enemyBullets` and damages enemies and boss |
| Pickup at its cap → 1 000 points (§4.6) | `Player.collect(kind): boolean` = applied; `PICKUP_COLLECTED` carries the kind in `detail` and "applied" in `value`; `ScoreKeeper` adds 1 000 when not applied |
| Pickup collection box 32 × 32, player hitbox 4 × 4 (§4.1, §4.6) | `CollisionResolver` tests pickups against the full sprite box and bullets / bodies against the hitbox |
| First-time pickup labels (§7.3) | `PICKUP_SPAWNED` carries the kind in `detail`; `RunPresenter` remembers which kinds it has labelled this run (presentation only, ADR-0010) |
| Contact hits the player (§5.2) | `CollisionResolver`: player hitbox (4 × 4) against enemy and boss hitboxes |
| Roles as data lines (§5.2, §5.3) | `EnemyArchetype` = `EnemyStats` + `DropTable` + one movement + one attack |
| Carrier cargo set by the script (§5.2) | `ScriptEvent.cargo` → `Enemy.cargo`, which overrides the `DropTable` roll (ADR-0010) |
| Formation guarantee, bomb kills count (§5.2) | `Formation` counts destroyed and escaped; one `Run.destroyEnemy(enemy, cause)` path for shots and bombs updates `Enemy.formation`; the boss has its own `Run.damageBoss` path (no formation) |
| Boss phases, timer, flee, broken parts (§6) | `Boss.phaseIndex`, `timeLeft`; `BossPhaseSpec.hpThreshold`, `brokenPart`; lifecycle in `05-state-boss` |
| Boss bonus 10 000 + 100 × seconds left (§6) | `BOSS_DESTROYED` carries the seconds left in `value`; `ScoreKeeper` scores it |
| Deterministic script, WARNING, boss entry (§6, §7.1) | `LevelDirector` walks `LevelScript.events` by `scriptTime`; publishes `BOSS_WARNING` at `warningAt` |
| Chain: 2 s window, step every 5 kills, ×8 cap, reset on death (§8) | `ScoreKeeper.chainKills`, `chainTimer`, `multiplier()` |
| Tally: full formations, no bomb, no miss, bombs left (§8) | `LevelTally`, reset at each level |
| Difficulty knobs (§10) | `DifficultyProfile`; the HUD caps (9 lives, 5 bombs, level 5) are constants, not knobs |

## Notes

- **Composition, not inheritance** (ADR-0003): the only generalizations are interface
  realizations. `Body` is the movable, damageable state shared by `Enemy` and `Boss`, so the same
  stateless strategies drive both. GDD §5.2 roles as data lines: Popcorn = `PathMovement` + `NoAttack` (the leader
  of some formations uses `AimedAttack` with a single volley); Diver = `DiveMovement` +
  `NoAttack`; Gunner = `EnterHoldLeave` + `AimedAttack` + drop {P, 30 %}; Carrier = `PathMovement`
  (a straight crossing) + `NoAttack` + cargo; Heavy = `EnterHoldLeave` (long hold) + `RingAttack`
  or `FanAttack` + drop {Bomb or Shield, 60 %}.
- **Strategies are stateless**; per-enemy scratch state (path progress, fire timer, dive target)
  lives on `Body`, so archetypes are shared data and nothing is allocated per spawn. Boss phases
  are data that swap the strategies — this is how ADR-0003's "BossPhase" State is realized.
- **One owner per object**: `Run` owns `World`, `World` owns `Player` and the pools; active
  bullets, pickups and enemies are references into the pools.
- **Events**: one reusable `GameEvent` object per kind (ADR-0010) — handlers never keep it and
  never publish an event of the kind they handle; `subject` is the serial of the body concerned
  (white flash, explosion size). `ScoreKeeper` subscribes first and is the only handler allowed
  to change state. Spawns (death release, formation P,
  cargo) are direct calls inside `Run.step`, never handlers.
- **Interpolation**: every moving object keeps `previousPosition`; `RunView.snapshot()` exposes
  previous and current positions so `RunPresenter` interpolates with `alpha` (ADR-0002) without
  allocating.
- **HUD data**: `RunView` exposes everything the HUD shows (GDD §9.2), read by `RunPresenter`
  each frame without allocation.
- **`destroyEnemy` and `damageBoss` have package visibility** (`~`): `CollisionResolver` and the bomb path of `Run`
  share it; it is not part of the run's public contract.
- **Not modelled**: geometric helpers (`Vec2`, `Rect`), ids (`SpriteId`, `PathId`), `KillCause`
  (shot or bomb), `WorldSnapshot` (the read-only view returned to the presenter).
