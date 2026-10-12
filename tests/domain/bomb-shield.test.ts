import { describe, expect, it } from 'vitest';
import { CARRIER, GUNNER, POPCORN } from '../../src/domain/game/enemy';
import { EventBus, GameEventKind } from '../../src/domain/game/events';
import type { GameEvent } from '../../src/domain/game/events';
import type { LevelScript } from '../../src/domain/game/level-script';
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

const DT = 1 / 60;
const EMPTY: LevelScript = { dominantColour: PickupKind.PRed, events: [] };

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

describe('Run — the bomb in step slot 3 (02-sequence-bomb)', () => {
  it('publishes BOMB_USED first, cancels enemy bullets, and strikes on-field enemies once', () => {
    const run = vulnerableRun();
    const world = (run as unknown as { world: World }).world;
    world.spawnEnemyBullet(60, 60, 0, 75);
    world.spawnEnemy({ at: 0, archetype: GUNNER, count: 1, spawn: { x: 60, y: 80 } }, undefined);
    world.spawnEnemy({ at: 0, archetype: POPCORN, count: 1, spawn: { x: 120, y: -40 } }, undefined);
    const outside = world.enemies.at(1);
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
    // The Gunner is gone; the Popcorn still above the field is untouched.
    expect(run.snapshot().enemies.count).toBe(1);
    expect(outside.hp).toBe(shots(1));
    expect(run.snapshot().bombs).toBe(1);
    expect(run.snapshot().player.state).toBe(PlayerState.Invulnerable);
  });

  it("drops a bombed Carrier's cargo and scores the kill", () => {
    const run = vulnerableRun();
    const world = (run as unknown as { world: World }).world;
    world.spawnEnemy(
      { at: 0, archetype: CARRIER, count: 1, spawn: { x: 100, y: 64 }, cargo: PickupKind.Bomb },
      undefined,
    );
    const log = logOf(run, [GameEventKind.PickupSpawned]);
    run.step(DT, pressing(Button.Bomb));
    expect(log).toEqual([`${String(GameEventKind.PickupSpawned)}:${String(PickupKind.Bomb)}`]);
    expect(run.snapshot().score).toBe(500);
  });

  it('does nothing while the ship flies in', () => {
    const run = new Run({ script: EMPTY });
    run.step(DT, pressing(Button.Bomb));
    expect(run.snapshot().bombs).toBe(2);
  });
});

describe('Run — shield and death through the collisions (GDD v0.8 §4.4)', () => {
  it('consumes the bullet the shield absorbed and publishes PLAYER_HIT, no death', () => {
    const run = vulnerableRun();
    const world = (run as unknown as { world: World }).world;
    world.player.collect(PickupKind.Shield);
    world.spawnEnemyBullet(120, 272, 0, 0);
    const log = logOf(run, [GameEventKind.PlayerHit, GameEventKind.PlayerDied]);
    run.step(DT, idle());
    expect(log).toEqual([`${String(GameEventKind.PlayerHit)}:0`]);
    expect(run.snapshot().lives).toBe(3);
    expect(run.snapshot().enemyBullets.count).toBe(0);
  });

  it('keeps a body the shield absorbed alive', () => {
    const run = vulnerableRun();
    const world = (run as unknown as { world: World }).world;
    world.player.collect(PickupKind.Shield);
    world.spawnEnemy({ at: 0, archetype: GUNNER, count: 1, spawn: { x: 120, y: 272 } }, undefined);
    run.step(DT, idle());
    expect(run.snapshot().enemies.count).toBe(1);
    expect(run.snapshot().shield).toBe(false);
  });

  it('releases the lost level as a P before PLAYER_DIED, and resets the bombs', () => {
    const run = vulnerableRun();
    const world = (run as unknown as { world: World }).world;
    world.player.collect(PickupKind.PBlue);
    world.player.useBomb();
    world.player.advanceTimers();
    for (let i = 0; i < 60; i += 1) run.step(DT, idle());
    world.spawnEnemyBullet(120, 272, 0, 0);
    const log = logOf(run, [GameEventKind.PickupSpawned, GameEventKind.PlayerDied]);
    run.step(DT, idle());
    expect(log).toEqual([
      `${String(GameEventKind.PickupSpawned)}:${String(PickupKind.PBlue)}`,
      `${String(GameEventKind.PlayerDied)}:0`,
    ]);
    expect([run.snapshot().power, run.snapshot().bombs]).toEqual([1, 2]);
    expect(run.snapshot().pickups.at(0).motion).toBe(PickupMotion.Release);
  });

  it('releases nothing at level 1', () => {
    const run = vulnerableRun();
    const world = (run as unknown as { world: World }).world;
    world.spawnEnemyBullet(120, 272, 0, 0);
    run.step(DT, idle());
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
    expect(render.camera).toEqual({ x: 4, y: 2 });
    shake.advance(40);
    shake.apply(render);
    expect(render.camera.x).toBeLessThan(0);
    shake.advance(EffectTuning.shakeMs);
    shake.apply(render);
    expect(render.camera).toEqual({ x: 0, y: 0 });
  });

  it('honours its switches: no flash nor shake when they are off', () => {
    const render = new RecordingRender();
    const bus = new EventBus();
    const effects = {
      blink: true,
      hitFlash: true,
      explosions: true,
      shake: false,
      bombFlash: false,
    };
    const presenter = new RunPresenter(render, effects, bus);
    const event = {
      kind: GameEventKind.BombUsed,
      position: { x: 0, y: 0 },
      value: 0,
      subject: 0,
      detail: 0,
    };
    bus.publish(event);
    presenter.applyShake();
    expect(render.camera).toEqual({ x: 0, y: 0 });
  });
});

describe('RunPresenter — the shield ring (GDD v0.8 §4.4)', () => {
  it('draws a 36 × 36 ring of four rectangles around a visible ship holding a charge', () => {
    const run = vulnerableRun();
    const world = (run as unknown as { world: World }).world;
    world.player.collect(PickupKind.Shield);
    const render = new RecordingRender();
    const effects = { blink: true, hitFlash: true, explosions: true, shake: true, bombFlash: true };
    new RunPresenter(render, effects, run.events()).draw(run.snapshot(), 1, 16);
    const ring = render.rectsOf(Palette.shieldRing);
    expect(ring).toHaveLength(4);
    expect(Math.min(...ring.map((r) => r.x))).toBe(102);
    expect(Math.max(...ring.map((r) => r.x + r.w))).toBe(138);
  });
});
