import { describe, expect, it } from 'vitest';
import { CARRIER, GUNNER, HEAVY_RING, POPCORN } from '../../src/domain/game/enemy';
import { GameEventKind } from '../../src/domain/game/events';
import type { GameEvent } from '../../src/domain/game/events';
import type { LevelScript, ScriptEvent } from '../../src/domain/game/level-script';
import { Pickup, PickupKind, PickupMotion } from '../../src/domain/game/pickup';
import { HitOutcome, Player, PlayerState } from '../../src/domain/game/player';
import { Run } from '../../src/domain/game/run';
import { WeaponKind } from '../../src/domain/game/weapon';
import { World } from '../../src/domain/game/world';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { BombFlash, EffectTuning, Shake } from '../../src/domain/presentation/effects';
import { Palette } from '../../src/domain/presentation/palette';
import { RunPresenter } from '../../src/domain/presentation/run-presenter';
import { RecordingRender } from '../support/recording-render';
import { shots } from '../support/shots';
import { testScript } from '../support/script';

const DT = 1 / 60;
const EMPTY: LevelScript = testScript();

function idle(): IntentFrame {
  return createIntentFrame();
}

function pressing(button: number): IntentFrame {
  const frame = createIntentFrame();
  frame.pressed = button;
  return frame;
}

/** A player stepped `steps` times idle: 30 steps fly in, then 90 invulnerable. */
function playerAfter(steps: number): Player {
  const player = new Player();
  const world = new World();
  for (let i = 0; i < steps; i += 1) {
    player.update(idle(), DT, world);
    player.advanceTimers();
  }
  return player;
}

/** A run on an empty script, its ship vulnerable at rest (120, 272). */
function vulnerableRun(): Run {
  const run = new Run({ script: EMPTY });
  for (let i = 0; i < 120; i += 1) run.step(DT, idle());
  expect(run.snapshot().player.state).toBe(PlayerState.Vulnerable);
  return run;
}

function logOf(run: Run, kinds: readonly GameEventKind[]): string[] {
  const log: string[] = [];
  for (const kind of kinds) {
    run.events().subscribe(kind, (e: Readonly<GameEvent>) => {
      log.push(`${String(e.kind)}:${String(e.detail)}`);
    });
  }
  return log;
}

describe('Player — bombs (GDD v0.8 §4.5)', () => {
  it('uses a bomb in control only: not while flying in, nor dead', () => {
    expect(playerAfter(10).useBomb()).toBe(false); // Entering
    const invulnerable = playerAfter(40);
    expect(invulnerable.useBomb()).toBe(true);
    expect(invulnerable.bombs).toBe(1);
    const dead = playerAfter(120);
    dead.hit();
    expect(dead.useBomb()).toBe(false);
  });

  it('does nothing with an empty stock', () => {
    const player = playerAfter(120);
    expect(player.useBomb()).toBe(true);
    expect(player.useBomb()).toBe(true);
    expect(player.useBomb()).toBe(false);
    expect(player.bombs).toBe(0);
  });

  it('makes a vulnerable ship invulnerable for 1 s, its blink starting over', () => {
    const player = playerAfter(120);
    player.useBomb();
    expect([player.state, player.protectionSteps]).toEqual([PlayerState.Invulnerable, 0]);
    for (let i = 0; i < 59; i += 1) player.advanceTimers();
    expect(player.state).toBe(PlayerState.Invulnerable);
    player.advanceTimers();
    expect(player.state).toBe(PlayerState.Vulnerable);
  });

  it('never shortens a protection: max(time left, 1 s)', () => {
    const player = playerAfter(31); // 89 steps of respawn invulnerability left
    player.useBomb();
    for (let i = 0; i < 88; i += 1) player.advanceTimers();
    expect(player.state).toBe(PlayerState.Invulnerable);
    player.advanceTimers();
    expect(player.state).toBe(PlayerState.Vulnerable);
  });
});

describe('Player — a bomb while invulnerable (GDD v0.8 §4.5)', () => {
  it('extends a shorter protection to the bomb duration, 1 s, without restarting the blink', () => {
    const player = playerAfter(100); // 20 steps of respawn invulnerability left
    expect(player.state).toBe(PlayerState.Invulnerable);
    expect(player.protectionSteps).toBe(100);
    player.useBomb();
    expect(player.protectionSteps).toBe(100);
    for (let i = 0; i < 59; i += 1) player.advanceTimers();
    expect(player.state).toBe(PlayerState.Invulnerable);
    player.advanceTimers();
    expect(player.state).toBe(PlayerState.Vulnerable);
  });
});

describe('Player — shield and death (GDD v0.8 §4.4)', () => {
  it('lets the shield absorb a hit: charge spent, 0.5 s of invulnerability, blink restarted', () => {
    const player = playerAfter(120);
    player.collect(PickupKind.Shield);
    expect(player.hit()).toBe(HitOutcome.Absorbed);
    expect([player.shield, player.state, player.protectionSteps, player.lives]).toEqual([
      false,
      PlayerState.Invulnerable,
      0,
      3,
    ]);
    for (let i = 0; i < 30; i += 1) player.advanceTimers();
    expect(player.state).toBe(PlayerState.Vulnerable);
    expect(player.hit()).toBe(HitOutcome.Died);
  });

  it('drops the power by one, never below 1, and resets the bombs to 2 at death', () => {
    const player = playerAfter(120);
    player.collect(PickupKind.PBlue);
    player.collect(PickupKind.Bomb);
    player.useBomb();
    player.useBomb();
    player.useBomb();
    expect(player.bombs).toBe(0);
    expect(player.applyDeathPenalty()).toBe(true);
    expect([player.power, player.weaponKind, player.bombs]).toEqual([1, WeaponKind.Laser, 2]);
    expect(player.applyDeathPenalty()).toBe(false);
    expect(player.power).toBe(1);
  });
});

/** A pickup caught through `Run`'s public `HitRules` side, as the collisions would report it. */
function collect(run: Run, kind: PickupKind): void {
  const pickup = new Pickup();
  pickup.spawn(kind, 0, 0, 1);
  run.rules.pickupCollected(pickup);
}

/** Steps a run idle until `kind` is published, at most `limit` steps; true if it was. */
function stepUntil(run: Run, kind: GameEventKind, limit: number): boolean {
  // A record, not a local: the handler's write is invisible to the type narrowing of a `let`.
  const seen = { value: false };
  run.events().subscribe(kind, () => {
    seen.value = true;
  });
  for (let i = 0; i < limit && !seen.value; i += 1) run.step(DT, idle());
  return seen.value;
}

// A Gunner hovering on the field from 1 s, straight above the resting ship, firing aimed volleys.
const GUNNER_ABOVE: ScriptEvent = {
  at: 0,
  archetype: GUNNER,
  count: 1,
  spawn: { x: 120, y: -16 },
  hover: { x: 120, y: 80 },
};

// The bomb's step: the Gunner has fired, none of its bullets has reached the ship yet.
const BOMB_STEP = 200;

describe('Run — the bomb in step slot 3 (02-sequence-bomb)', () => {
  it('publishes BOMB_USED first, cancels enemy bullets, and strikes on-field enemies once', () => {
    // A Popcorn due on the bomb's step is still above the field when the bomb goes off.
    const run = new Run({
      script: testScript([
        { ...GUNNER_ABOVE, spawn: { x: 60, y: -16 }, hover: { x: 60, y: 80 } },
        { at: BOMB_STEP / 60, archetype: POPCORN, count: 1, spawn: { x: 200, y: -8 } },
      ]),
    });
    for (let i = 0; i < BOMB_STEP; i += 1) run.step(DT, idle());
    expect(run.snapshot().player.state).toBe(PlayerState.Vulnerable);
    expect(run.snapshot().enemyBullets.count).toBeGreaterThan(0);
    const log = logOf(run, [
      GameEventKind.BombUsed,
      GameEventKind.EnemyHit,
      GameEventKind.EnemyDestroyed,
    ]);
    run.step(DT, pressing(Button.Bomb));
    expect(log).toEqual([
      `${String(GameEventKind.BombUsed)}:0`,
      `${String(GameEventKind.EnemyHit)}:0`,
      `${String(GameEventKind.EnemyDestroyed)}:1`,
    ]);
    expect(run.snapshot().enemyBullets.count).toBe(0);
    // The Gunner is gone; the Popcorn spawned above the field is untouched.
    expect(run.snapshot().enemies.count).toBe(1);
    expect(run.snapshot().enemies.at(0).hp).toBe(shots(1));
    expect([run.snapshot().bombs, run.snapshot().player.state]).toEqual([
      1,
      PlayerState.Invulnerable,
    ]);
  });

  it("drops a bombed Carrier's cargo and scores the kill", () => {
    const run = new Run({
      script: testScript([
        { at: 0, archetype: CARRIER, count: 1, spawn: { x: -16, y: 64 }, cargo: PickupKind.Bomb },
      ]),
    });
    for (let i = 0; i < 120; i += 1) run.step(DT, idle());
    const log = logOf(run, [GameEventKind.PickupSpawned]);
    run.step(DT, pressing(Button.Bomb));
    expect(log).toEqual([`${String(GameEventKind.PickupSpawned)}:${String(PickupKind.Bomb)}`]);
    expect(run.snapshot().score).toBe(500);
  });

  it('damages a Heavy that has more HP than the bomb deals, without destroying it', () => {
    // 40 shots of HP against the bomb's 30: 10 shots are left.
    const run = new Run({
      script: testScript([
        {
          at: 0,
          archetype: HEAVY_RING,
          count: 1,
          spawn: { x: 120, y: -24 },
          hover: { x: 120, y: 72 },
        },
      ]),
    });
    for (let i = 0; i < 150; i += 1) run.step(DT, idle());
    expect(run.snapshot().enemies.at(0).hp).toBe(shots(40));
    const log = logOf(run, [GameEventKind.EnemyHit, GameEventKind.EnemyDestroyed]);
    run.step(DT, pressing(Button.Bomb));
    expect(log).toEqual([`${String(GameEventKind.EnemyHit)}:0`]);
    expect(run.snapshot().enemies.count).toBe(1);
    expect(run.snapshot().enemies.at(0).hp).toBe(shots(10));
    expect(run.snapshot().score).toBe(0);
  });

  it('does nothing while the ship flies in', () => {
    const run = new Run({ script: EMPTY });
    run.step(DT, pressing(Button.Bomb));
    expect(run.snapshot().bombs).toBe(2);
  });
});

describe('Run — shield and death through the collisions (GDD v0.8 §4.4)', () => {
  it('lets the shield take the first aimed bullet: PLAYER_HIT, no life lost', () => {
    const run = new Run({ script: testScript([GUNNER_ABOVE]) });
    collect(run, PickupKind.Shield);
    const died = logOf(run, [GameEventKind.PlayerDied]);
    expect(stepUntil(run, GameEventKind.PlayerHit, 600)).toBe(true);
    expect(died).toEqual([]);
    expect([run.snapshot().lives, run.snapshot().shield]).toEqual([3, false]);
  });

  it('releases the lost level as a P before PLAYER_DIED, and resets the bombs', () => {
    const run = new Run({ script: testScript([GUNNER_ABOVE]) });
    collect(run, PickupKind.PBlue);
    collect(run, PickupKind.Bomb);
    expect([run.snapshot().power, run.snapshot().bombs]).toEqual([2, 3]);
    const log = logOf(run, [GameEventKind.PickupSpawned, GameEventKind.PlayerDied]);
    expect(stepUntil(run, GameEventKind.PlayerDied, 600)).toBe(true);
    expect(log).toEqual([
      `${String(GameEventKind.PickupSpawned)}:${String(PickupKind.PBlue)}`,
      `${String(GameEventKind.PlayerDied)}:0`,
    ]);
    expect([run.snapshot().power, run.snapshot().bombs]).toEqual([1, 2]);
    expect(run.snapshot().pickups.at(0).motion).toBe(PickupMotion.Release);
  });

  it('releases a red P when the ship dies holding the Spread', () => {
    const run = new Run({ script: testScript([GUNNER_ABOVE]) });
    collect(run, PickupKind.PRed);
    expect([run.snapshot().power, run.snapshot().weaponKind]).toEqual([2, WeaponKind.Spread]);
    const log = logOf(run, [GameEventKind.PickupSpawned]);
    expect(stepUntil(run, GameEventKind.PlayerDied, 600)).toBe(true);
    expect(log).toEqual([`${String(GameEventKind.PickupSpawned)}:${String(PickupKind.PRed)}`]);
    expect(run.snapshot().pickups.at(0).kind).toBe(PickupKind.PRed);
  });

  it('releases nothing at level 1', () => {
    const run = new Run({ script: testScript([GUNNER_ABOVE]) });
    expect(stepUntil(run, GameEventKind.PlayerDied, 600)).toBe(true);
    expect(run.snapshot().pickups.count).toBe(0);
  });
});

describe('Pickup — the death release hop (GDD v0.8 §4.4)', () => {
  it('rises 48 px linearly over 0.8 s, then falls at 20 px/s, with no sway', () => {
    const world = new World();
    world.spawnPickup(PickupKind.PRed, 100, 272, PickupMotion.Release);
    const pickup = world.pickups.at(0);
    for (let i = 0; i < 24; i += 1) world.movePickups();
    expect(pickup.position).toEqual({ x: 100, y: 272 - 24 });
    for (let i = 0; i < 24; i += 1) world.movePickups();
    expect(pickup.position.y).toBeCloseTo(224, 9);
    for (let i = 0; i < 60; i += 1) world.movePickups();
    expect(pickup.position.y).toBeCloseTo(244, 9);
    expect(pickup.position.x).toBe(100);
  });

  it('never rises above y 24', () => {
    const pickup = new Pickup();
    pickup.spawn(PickupKind.PRed, 100, 50, 1, PickupMotion.Release);
    expect(pickup.riseTo).toBe(24);
  });

  it('stays on the field until about 4 s after the ship is back in control', () => {
    const world = new World();
    world.spawnPickup(PickupKind.PRed, 120, 272, PickupMotion.Release);
    // Control returns 2 s after the death (1.5 s death sequence + 0.5 s fly-in).
    for (let i = 0; i < 120 + 236; i += 1) {
      world.movePickups();
      world.sweep();
    }
    expect(world.pickups.count).toBe(1);
  });
});

describe('Effects — bomb flash and shake (GDD v0.8 §9.4)', () => {
  it('tints the field for about 300 ms', () => {
    const flash = new BombFlash();
    const render = new RecordingRender();
    flash.trigger();
    flash.draw(render, 240, 320);
    expect(render.rectsOf(Palette.bombFlash)).toHaveLength(1);
    flash.advance(EffectTuning.bombFlashMs);
    render.clear();
    flash.draw(render, 240, 320);
    expect(render.drew(Palette.bombFlash)).toBe(false);
  });

  it('starts a new flash only 1/3 s after the previous one started (under 3 per second)', () => {
    const flash = new BombFlash();
    const render = new RecordingRender();
    flash.trigger();
    flash.advance(310);
    flash.trigger(); // 310 ms after: refused
    flash.draw(render, 240, 320);
    expect(render.drew(Palette.bombFlash)).toBe(false);
    flash.advance(30);
    flash.trigger(); // 340 ms after: accepted
    flash.draw(render, 240, 320);
    expect(render.drew(Palette.bombFlash)).toBe(true);
  });

  it('shakes 4 px, changing side, fading out to (0, 0) after 300 ms', () => {
    const shake = new Shake();
    const render = new RecordingRender();
    shake.trigger();
    shake.apply(render);
    expect(render.camera).toEqual({ x: 4, y: 0 });
    shake.advance(40);
    shake.apply(render);
    expect(render.camera.x).toBeLessThan(0);
    shake.advance(EffectTuning.shakeMs);
    shake.apply(render);
    expect(render.camera).toEqual({ x: 0, y: 0 });
  });

  it.each([
    [false, false],
    [true, true],
  ])('honours its switches: with them %s, a bomb flashes and shakes: %s', (on, seen) => {
    const run = vulnerableRun();
    const render = new RecordingRender();
    const effects = {
      blink: true,
      hitFlash: true,
      explosions: true,
      shake: on,
      bombFlash: on,
      slowMotion: on,
    };
    const presenter = new RunPresenter(render, effects, run.events());
    run.step(DT, pressing(Button.Bomb));
    presenter.applyShake();
    presenter.draw(run.snapshot(), 1, 16);
    expect(render.drew(Palette.bombFlash)).toBe(seen);
    expect(render.camera.x !== 0).toBe(seen);
  });
});

describe('RunPresenter — the shield ring (GDD v0.8 §4.4)', () => {
  it('draws a 36 × 36 ring of four rectangles around a visible ship holding a charge', () => {
    const run = vulnerableRun();
    collect(run, PickupKind.Shield);
    const render = new RecordingRender();
    const effects = {
      blink: true,
      hitFlash: true,
      explosions: true,
      shake: true,
      bombFlash: true,
      slowMotion: true,
    };
    new RunPresenter(render, effects, run.events()).draw(run.snapshot(), 1, 16);
    const ring = render.rectsOf(Palette.shieldRing);
    expect(ring).toHaveLength(4);
    expect(Math.min(...ring.map((r) => r.x))).toBe(102);
    expect(Math.max(...ring.map((r) => r.x + r.w))).toBe(138);
  });
});
