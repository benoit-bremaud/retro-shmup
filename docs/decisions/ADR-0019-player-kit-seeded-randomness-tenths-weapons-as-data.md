# ADR-0019: Player kit — seeded randomness per run, damage in tenths, weapons as data

**Status:** Accepted — 2026-10-11. **Partially supersedes ADR-0003** (decision 2: the "weapon
behaviour per level (§4.3)" entry of the Strategy row; weapons become data under decision 1's
tuning-as-data rule) and **ADR-0002** (decision 6: a spawn on a full pickup pool is dropped like
any other, the level simulation tests checking it never happens, instead of a development-build
log). It **refines** ADR-0002 decision 5 (the pickup sway is a closed form of the age and draws
nothing) and ADR-0014 decision 7 (`Math.random` in `main.ts` also draws the run seed). Every other
part of those ADRs stands. Values are GDD v0.8 values (§4.3 to §4.6,
§5.2.1, §7.2.1, §9.2); interim deviations are recorded only in the scene machine
(`meta/05-state-scenes`, player-kit brick additions).

## Context

- The enemies brick left out everything random and everything the player collects: no drop
  roll, no formation reward, no `Formation` count, no death release, no bombs (scene machine,
  interim deviation "drops and formations"). `Run` holds no `Random`; the determinism test
  compares (script, inputs) only. `SeededRandom` exists and is unit-tested but nothing owns it.
- GDD v0.8 gives the Spread fractional damage (1.4, 1.9, 2.4) and the Laser 1.5 and 2.5. With
  floating-point HP, 1.4 + 1.4 + … leaves residues: an enemy can survive with 1e-16 HP, or die
  one shot early or late depending on the order of additions.
- The class diagram planned `WeaponPattern` with two realizations, `SpreadPattern` and
  `LaserPattern`. Both would loop over per-level shot records; only the records differ.
- The Laser passes through enemies: a bolt overlaps a body for several steps and must hit it once;
  ADR-0002 forbids allocation in the loop, so the memory of what a bolt has hit must be fixed.
- Pickups, formations and the death release need a pool, a place in the step order and events.
- The player-kit conception study (2026-10-11) validated each GDD v0.8 rule one at a time with a
  scored recommendation, and the technical batch below as a whole.

## Decision

1. **Seeded randomness per run.** `Run` owns a `SeededRandom` built from a per-run seed:
   `new Run({ script, seed })`. `levelIndex` is 0-based: level 1 is seeded with
   `mix(runSeed, 0)`; each later level reseeds with `mix(runSeed, levelIndex)`, a 32-bit integer mix whose exact form is fixed in code
   review (ADR-0002 decision 5). The seed comes from the composition root (`main.ts`, the only
   module allowed `Math.random`, ADR-0014 decision 7) through the run factory it gives the scene
   machine (`createRun`). `RunConfig` has an optional `createRandom(levelSeed): Random`, called
   once per level, default `new SeededRandom(levelSeed)`: tests pass a factory returning a
   scripted `Random` to force drops, and the per-level reseed keeps working. The determinism test
   compares the event logs of two runs with the same (seed, script, inputs); the log gains
   `PICKUP_SPAWNED` and `PICKUP_COLLECTED`. Presentation keeps its own unseeded generator
   (ADR-0010 decision 1).
2. **HP and damage in tenths of a level-1 shot.** Integers: Popcorn 10, Diver 10, Gunner 80,
   Carrier 40, a bomb 300; a level-2 Spread centre bullet deals 14, a level-4 Laser bolt 25. The
   GDD keeps expressing them in level-1 shots; tests express shots through a helper, never with
   raw tenths.
3. **Weapons as data.** `WEAPONS: Record<WeaponKind, readonly WeaponLevel[]>`, five levels per
   kind; `WeaponLevel = { cooldownSteps, shots: readonly ShotSpec[] }`; a `ShotSpec` carries its
   offset from the ship's centre, its precomputed velocity (the angle's sine and cosine are
   computed once at load, no trigonometry per step), size, damage in tenths and pass-throughs.
   One generic `fire()` loops over the shots of the current level. `Weapon` holds `kind`, `level`
   and the cooldown, with `powerUp(kind): boolean` (true when the level rose) and
   `powerDown(): boolean` (false at level 1). `WeaponPattern`, `SpreadPattern` and `LaserPattern`
   leave the class diagram. The player bullet pool grows from 16 to 80.
4. **Collisions.**
   - **Pierce memory per bullet**: `alreadyHit`, a fixed array of 3 serials and a count, reset at
     spawn; `canHit(serial)` and `recordHit(serial)`. A bolt with no pass-through left is spent on
     its next hit, so it never needs a fourth entry.
   - **Pass 4, pickups**: after the three hazard passes, live pickups against the ship's 32 × 32
     box, only while the ship can collect (GDD v0.8 §4.6); a ship that died in an earlier pass of
     the step collects nothing.
   - `HitRules` gains `shieldBroken()` and `pickupCollected(pickup)` (the run applies
     `Player.collect` and publishes); `destroyEnemy` takes its cause (shot or bomb).
5. **Pickups.** `Pickup` is pooled — `kind`, `serial`, `origin`, `position`,
   `previousPosition`, `age`, `motion` (`fall` or `release`), `spent` — in an `ActiveList` of 8
   in `World`, swept when spent or when its top edge reaches y 320. Its position is a closed form
   of its age and motion (fall with sway, or the release hop then the slow fall: the rise is linear over 0.8 s whatever its height (clamped at y 24 it simply rises less); x stays at the death x, with no sway, during the rise and the fall), so a replay and
   an interpolated frame never drift. `WorldSnapshot` exposes `pickups`. `PickupTuning` holds the
   GDD values: fall 40 px/s, sway 8 px over 2 s, size 16, release rise 48 px over 0.8 s, release
   fall 20 px/s.
6. **Formations.** `Formation` is pooled (16, the class diagram), owned by `World`. Escapes are
   counted by a pre-pass of `World.sweep` — an entered member fully outside the field marks its
   formation — so the `ActiveList` predicates stay pure functions of one item. `LevelDirector`
   starts a new `Formation` for each pass of a looping row.
7. **Events.** `PICKUP_SPAWNED` (`detail` = kind, published only when `World.spawnPickup`
   returns true — false on a full pool, so the log never holds a pickup that does not exist), `PICKUP_COLLECTED` (`detail` = kind, `value` =
   0 or 1 000), `PLAYER_HIT` (shield absorbed), `BOMB_USED`, `FORMATION_CLEARED`. `ScoreKeeper`
   adds `PICKUP_COLLECTED.value` as it is, never multiplied, and the chain does not move.
   Spawning stays a direct call in the step, never a handler (ADR-0010 decision 4): the death
   release is spawned before `PLAYER_DIED` is published.
8. **Player.** `Player.collect(kind): number` returns the bonus — 0, or 1 000 when the effect
   could not apply; a P of the other colour at level 5 both switches and pays (the class
   diagram's `boolean` could not say both). The caps — power 5, bombs 5, lives 9, the 1 000
   bonus — are constants. The knobs — `lives`, `bombsPerLife`, `dropRateScale` — move
   to a `DifficultyProfile` holding the `NORMAL` subset the brick reads,
   which replaces `PlayerTuning.lives`. The power lost on death stays a rule (one level), not a
   knob, until a profile needs another value (YAGNI; GDD §10 names it as a later knob).
9. **Timers and the bomb slot.** The player's state timer is set with a duration per cause:
   fly-in 0.5 s, respawn invulnerability 1.5 s (the 2 s of GDD §4.1 with the fly-in), shield
   0.5 s, bomb max(time left, 1 s). `Player.useBomb(): boolean` applies the guard of GDD v0.8 §4.5
   (a `Bomb` press, a bomb in stock, `Vulnerable` or `Invulnerable`). `HitOutcome` gains
   `ABSORBED`. `Run.step` fills its slot (3): a used bomb is applied after the player moves and
   before anything else moves or collides.
10. **Enemy data.** `EnemyArchetype.id` gains `'carrier'` and the archetype gains
    `drops: DropTable` (`{ kinds, rate }`, ADR-0010 decision 5); `ScriptEvent.cargo` is optional,
    and the load check throws a `RangeError` for a Carrier without a cargo, a cargo on another
    archetype, or a Carrier whose spawn box overlaps the field; `LevelScript.dominantColour` gives the formation P. The Carrier moves by a new
    stateless `CrossMovement`, a closed form of the age: spawn x < 120 → it moves right,
    otherwise left.
11. **Presentation data.** Palette tokens, each a value no other token uses, for the pickups, the
    Carrier, the Laser bolts, the shield ring, the bomb flash, the power pips and the HUD icons.
    `HudLayout` gains `bombs`, `weapon {x, y, pipX, pipSpacing}` and `shield` for both screen
    kinds. `EffectSettings` gains `shake` and `bombFlash`.

## Alternatives considered

Scored in the player-kit study on GDD fidelity, determinism, no allocation, KISS, testability and
cost; the owner validated the top scores as a batch.

- **One generator seeded once per session, or per level only** — rejected: two runs of one
  session would not be comparable, and a level could not be replayed from the run seed alone.
- **`Math.random` behind a domain import** — rejected: forbidden in `src/domain` (ADR-0002,
  ADR-0003), and it would make every drop untestable.
- **Floating-point HP with an epsilon** — rejected: the residue still depends on the order of
  additions, and every comparison carries the epsilon.
- **Integer damage scaled ×100** — rejected: no GDD value needs hundredths; tenths keep the
  numbers readable.
- **`WeaponPattern` with `SpreadPattern` and `LaserPattern`** — rejected: two implementations of
  "loop over records" is a Strategy without a second behaviour (ADR-0003: each pattern needs its
  force).
- **A continuous Laser beam** — rejected in GDD v0.8 §4.3: segment collisions, a new shape and
  damage per step.
- **A per-step set of hit serials** — rejected: allocation in the loop.
- **Counting escapes inside the `ActiveList` predicate** — rejected: a predicate with a side
  effect on another object.
- **`collect(kind): boolean`** — rejected: "applied" cannot say "switched and paid".
- **A full `DifficultyProfile` now** — rejected: knobs no code reads yet (YAGNI); they arrive with
  their bricks.

## Consequences

- The brick ships in five PRs (owner decision), each merge playable: E-0 this design; E-1
  randomness, pickups and their sources; E-2 the weapon tables; E-3 the Carrier; E-4 the bomb,
  the shield and the death rule. The Carrier lands before the bomb, so Shield and Bomb are
  catchable as soon as they exist. The detail is in the scene machine's build order.
- Tests implied: a drop forced by a scripted `Random` and refused for r ≥ rate × dropRateScale; one draw per
  Gunner kill choosing both the drop and the colour; the formation P at the last member, once,
  per pass; the sway and the release hop as closed forms; collection guards (not while `Dead`,
  not after Game over, none in a death step); two pickups in one step applied in order; a full
  pickup pool dropping the spawn; the cap bonus flat and outside the chain; the Spread and Laser
  tables (stream count, angles, cooldowns 6 and 4 steps, damage in tenths, a Popcorn dying in one
  hit at every level); a bolt hitting N + 1 bodies, each once; bomb guard, one-step reach, on-field
  only, `max(time left, 1 s)`; shield absorbing a bullet and a body; the death effects at the
  death step; script load checks for the cargo; determinism with a seed.
- The bomb's `Bomb` intent, wired with no effect since the devices brick (ADR-0018 Consequences),
  gets its effect in E-4; the touch bomb stays the second-finger tap (GDD v0.8 §4.2).
- The first-time pickup labels wait for the bitmap fonts (screens brick); `PICKUP_SPAWNED`
  already carries what they need.

## References

- GDD v0.8 §4.3, §4.4, §4.5, §4.6, §5.2.1, §7.2.1, §9.2, §9.3, §9.4, §10; ADR-0002, ADR-0003,
  ADR-0009, ADR-0010, ADR-0014, ADR-0018; `docs/architecture/diagrams/gameplay/04-class-domain.md`,
  `02-sequence-bomb.md`, `meta/05-state-scenes.md` (player-kit brick additions).
- David Blackman and Sebastiano Vigna, "A PRNG Shootout" — <https://prng.di.unimi.it/>.
- Robert Nystrom, *Game Programming Patterns*, "Object Pool" —
  <https://gameprogrammingpatterns.com/object-pool.html>.
- Michael Nygard, "Documenting Architecture Decisions" (ADR format).
