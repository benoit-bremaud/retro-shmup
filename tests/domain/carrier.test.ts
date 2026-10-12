import { describe, expect, it } from 'vitest';
import { CARRIER, Enemy, GUNNER, POPCORN } from '../../src/domain/game/enemy';
import { GameEventKind } from '../../src/domain/game/events';
import type { GameEvent } from '../../src/domain/game/events';
import { LevelDirector } from '../../src/domain/game/level-director';
import { LEVEL_1 } from '../../src/domain/game/level-script';
import type { ScriptEvent } from '../../src/domain/game/level-script';
import { CrossMovement } from '../../src/domain/game/movements';
import type { WorldView } from '../../src/domain/game/movements';
import { Pickup, PickupKind } from '../../src/domain/game/pickup';
import { Player } from '../../src/domain/game/player';
import { Run } from '../../src/domain/game/run';
import { createIntentFrame } from '../../src/domain/ports/input-port';
import type { Random } from '../../src/domain/ports/random';
import { HUD_LAYOUTS } from '../../src/domain/presentation/hud-layout';
import { drawHollowSquare, drawPlusIcon, drawShipIcon } from '../../src/domain/presentation/icons';
import { RecordingRender } from '../support/recording-render';
import { shots } from '../support/shots';
import { testScript } from '../support/script';

const VIEW: WorldView = { playerPosition: () => ({ x: 120, y: 272 }) };

function carrierFrom(x: number, y: number): Enemy {
  const enemy = new Enemy();
  enemy.spawn(CARRIER, { spawn: { x, y }, cargo: PickupKind.Shield }, 3, undefined);
  return enemy;
}

/** A `Random` that would always drop: proves a cargo replaces the roll. */
const ALWAYS: Random = { next: () => 0, seed: () => undefined };

describe('CARRIER — the archetype (GDD v0.8 §5.2.1)', () => {
  it('is 32 × 32, 4 level-1 shots of HP, 500 points, no attack, no roll, a cargo', () => {
    expect(CARRIER.stats).toMatchObject({ width: 32, height: 32, hp: shots(4), score: 500 });
    expect([CARRIER.drops.rate, CARRIER.carriesCargo]).toEqual([0, true]);
  });
});

describe('CrossMovement — the Carrier crossing (GDD v0.8 §5.2.1)', () => {
  it('crosses rightwards at 60 px/s from a spawn left of the centre, y unchanged', () => {
    const carrier = carrierFrom(-16, 64);
    carrier.age = 60;
    CrossMovement.tick(carrier, VIEW, 1 / 60);
    expect(carrier.position).toEqual({ x: 44, y: 64 });
  });

  it('crosses leftwards from a spawn right of the centre', () => {
    const carrier = carrierFrom(256, 64);
    carrier.age = 120;
    CrossMovement.tick(carrier, VIEW, 1 / 60);
    expect(carrier.position).toEqual({ x: 136, y: 64 });
  });
});

describe('Level script — cargo checks at load (GDD v0.8 §5.2.1)', () => {
  const row = (extra: Partial<ScriptEvent>): ScriptEvent => ({
    at: 0,
    archetype: CARRIER,
    count: 1,
    spawn: { x: -16, y: 64 },
    cargo: PickupKind.Shield,
    ...extra,
  });

  it.each([
    [
      'a Carrier without a cargo',
      { at: 0, archetype: CARRIER, count: 1, spawn: { x: -16, y: 64 } },
    ],
    ['a cargo on a Gunner', row({ archetype: GUNNER, hover: { x: 60, y: 80 } })],
    ['a cargo on a Popcorn', row({ archetype: POPCORN })],
    ['a Carrier spawning on the field', row({ spawn: { x: 0, y: 64 } })],
    ['a Carrier touching the left edge by 1 px', row({ spawn: { x: -15, y: 64 } })],
    ['a Carrier touching the right edge by 1 px', row({ spawn: { x: 255, y: 64 } })],
    ['a Carrier above the field, which would never cross it', row({ spawn: { x: -16, y: -16 } })],
    ['a Carrier below the field', row({ spawn: { x: -16, y: 336 } })],
  ])('rejects %s (RangeError)', (_label, event) => {
    expect(() => new LevelDirector(testScript([event]))).toThrow(RangeError);
  });

  it('accepts a Carrier fully outside the field, on either side', () => {
    const events = [row({}), row({ spawn: { x: 256, y: 64 }, cargo: PickupKind.Bomb })];
    expect(() => new LevelDirector(testScript(events))).not.toThrow();
  });

  it('puts level 1 Carriers at 28 s with a Shield and at 78 s, high, with the 1-UP', () => {
    const carriers = LEVEL_1.events.filter((e) => e.archetype === CARRIER);
    expect(carriers.map((e) => [e.at, e.spawn.x, e.spawn.y, e.cargo])).toEqual([
      [28, -16, 64, PickupKind.Shield],
      [78, -16, 48, PickupKind.OneUp],
    ]);
  });
});

describe('Run — the cargo drops at 100 % (GDD v0.8 §5.2)', () => {
  it('drops its cargo where it dies, without drawing a random number', () => {
    let draws = 0;
    const run = new Run({
      createRandom: () => ({
        next: () => {
          draws += 1;
          return ALWAYS.next();
        },
        seed: () => undefined,
      }),
    });
    const log: string[] = [];
    run.events().subscribe(GameEventKind.PickupSpawned, (e: Readonly<GameEvent>) => {
      log.push(`${String(e.detail)}@${String(e.position.x)},${String(e.position.y)}`);
    });
    const carrier = carrierFrom(-16, 64);
    carrier.position.x = 100;
    run.destroyEnemy(carrier);
    expect(log).toEqual([`${String(PickupKind.Shield)}@100,64`]);
    expect(draws).toBe(0);
  });
});

describe('Player — Shield, Bomb and 1-UP with the cap rule (GDD v0.8 §4.6)', () => {
  it('takes one shield charge, then pays 1 000 for another', () => {
    const player = new Player();
    expect(player.shield).toBe(false);
    expect(player.collect(PickupKind.Shield)).toBe(0);
    expect(player.shield).toBe(true);
    expect(player.collect(PickupKind.Shield)).toBe(1000);
  });

  it('starts with 2 bombs, adds one per Bomb up to 5, then pays 1 000', () => {
    const player = new Player();
    expect(player.bombs).toBe(2);
    for (let i = 0; i < 3; i += 1) expect(player.collect(PickupKind.Bomb)).toBe(0);
    expect(player.bombs).toBe(5);
    expect(player.collect(PickupKind.Bomb)).toBe(1000);
    expect(player.bombs).toBe(5);
  });

  it('adds a life per 1-UP up to 9, then pays 1 000', () => {
    const player = new Player();
    for (let i = 0; i < 6; i += 1) expect(player.collect(PickupKind.OneUp)).toBe(0);
    expect(player.lives).toBe(9);
    expect(player.collect(PickupKind.OneUp)).toBe(1000);
  });

  it('scores a capped pickup through the run, flat', () => {
    const run = new Run();
    const shield = new Pickup();
    shield.spawn(PickupKind.Shield, 0, 0, 1);
    run.pickupCollected(shield);
    run.pickupCollected(shield);
    expect([run.snapshot().shield, run.snapshot().score]).toEqual([true, 1000]);
  });
});

describe('Icons — the player-kit shapes (GDD v0.8 §9.2)', () => {
  it.each([
    [
      'ship',
      drawShipIcon,
      [
        [3, 0, 2, 8],
        [0, 5, 8, 2],
      ],
    ],
    [
      'plus',
      drawPlusIcon,
      [
        [3, 0, 2, 8],
        [0, 3, 8, 2],
      ],
    ],
    [
      'hollow square',
      drawHollowSquare,
      [
        [0, 0, 8, 1],
        [0, 7, 8, 1],
        [0, 1, 1, 6],
        [7, 1, 1, 6],
      ],
    ],
  ] as const)('draws the 8 × 8 %s', (_label, draw, rects) => {
    const render = new RecordingRender();
    render.setRegion('hud');
    draw(render, 0, 0, 8, '#000001');
    expect(render.rects.map((r) => [r.x, r.y, r.w, r.h])).toEqual(rects);
  });

  it('places bombs and the shield at the GDD v0.8 positions', () => {
    expect(HUD_LAYOUTS.landscape.bombs).toEqual({ x: 8, y: 66, spacing: 12 });
    expect(HUD_LAYOUTS.landscape.shield).toEqual({ x: 368, y: 100 });
    expect(HUD_LAYOUTS.portrait.bombs).toEqual({ x: 76, y: 19, spacing: 12 });
    expect(HUD_LAYOUTS.portrait.shield).toEqual({ x: 172, y: 5 });
  });
});

describe('Carrier — crossing and escaping in a run (GDD v0.8 §5.2)', () => {
  it.each([
    ['left to right', { x: -16, y: 64 }],
    ['right to left', { x: 256, y: 64 }],
  ])('crosses %s and leaves, dropping nothing when it escapes', (_label, spawn) => {
    const run = new Run({
      script: testScript([
        { at: 0, archetype: CARRIER, count: 1, spawn, cargo: PickupKind.Shield },
      ]),
    });
    const log: number[] = [];
    run.events().subscribe(GameEventKind.PickupSpawned, (e) => log.push(e.kind));
    run.events().subscribe(GameEventKind.EnemyDestroyed, (e) => log.push(e.kind));
    const idle = createIntentFrame();
    run.step(1 / 60, idle);
    expect(run.snapshot().enemies.count).toBe(1);
    // 240 + 32 px at 60 px/s: about 4.5 s; nothing is fired.
    for (let i = 0; i < 300; i += 1) run.step(1 / 60, idle);
    expect(run.snapshot().enemies.count).toBe(0);
    expect(log).toEqual([]);
  });

  it('forgets its cargo when its pool slot spawns another role', () => {
    const enemy = carrierFrom(-16, 64);
    expect(enemy.cargo).toBe(PickupKind.Shield);
    enemy.spawn(GUNNER, { spawn: { x: -16, y: 80 }, hover: { x: 60, y: 80 } }, 4, undefined);
    expect(enemy.cargo).toBeUndefined();
  });
});
