import { PlayerTuning } from '../../src/domain/game/tuning';
import { describe, expect, it } from 'vitest';
import { Pickup, PickupKind } from '../../src/domain/game/pickup';
import { WeaponKind } from '../../src/domain/game/weapon';
import { PlayerState } from '../../src/domain/game/player';
import type { BossSnapshot, PlayerSnapshot, WorldSnapshot } from '../../src/domain/game/run';
import { Bullet } from '../../src/domain/game/bullet';
import {
  CARRIER,
  DIVER,
  Enemy,
  GUNNER,
  HEAVY_FAN,
  HEAVY_RING,
  POPCORN,
} from '../../src/domain/game/enemy';
import { Palette } from '../../src/domain/presentation/palette';
import { RunPresenter } from '../../src/domain/presentation/run-presenter';
import { BossState } from '../../src/domain/game/boss';
import { createGameEvent, EventBus, GameEventKind } from '../../src/domain/game/events';
import type { ReadonlyActiveList } from '../../src/domain/game/active-list';
import { RecordingRender } from '../support/recording-render';
import type { RecordedRect } from '../support/recording-render';
import { IDLE_BOSS } from '../support/boss-snapshot';

function ship(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    position: { x: 120, y: 272 },
    previousPosition: { x: 120, y: 272 },
    state: PlayerState.Vulnerable,
    protectionSteps: 0,
    ...overrides,
  };
}

function bullet(
  x: number,
  y: number,
  previousY: number,
  weapon: WeaponKind = WeaponKind.Spread,
): Bullet {
  const shot = new Bullet();
  shot.position.x = x;
  shot.position.y = y;
  shot.previousPosition.x = x;
  shot.previousPosition.y = previousY;
  shot.width = weapon === WeaponKind.Laser ? 4 : 2;
  shot.height = weapon === WeaponKind.Laser ? 48 : 8;
  shot.weapon = weapon;
  return shot;
}

/** A presenter over a fresh bus; the effect switches on, the blink as given. */
function presenter(render: RecordingRender, blink: boolean, bus = new EventBus()): RunPresenter {
  return new RunPresenter(
    render,
    { blink, hitFlash: true, explosions: true, shake: true, bombFlash: true },
    bus,
  );
}

/** A fixed active list for presenter tests: the presenter only reads `count` and `at`. */
function listOf<T>(items: readonly T[]): ReadonlyActiveList<T> {
  return {
    count: items.length,
    at(index: number): T {
      const item = items[index];
      if (item === undefined) throw new RangeError(`no item at ${String(index)}`);
      return item;
    },
  };
}

function snapshot(
  player: PlayerSnapshot,
  bullets: Bullet[] = [],
  extra: Partial<WorldSnapshot> = {},
): WorldSnapshot {
  return {
    player,
    playerBullets: listOf(bullets),
    enemyBullets: listOf<Bullet>([]),
    enemies: listOf<Enemy>([]),
    pickups: listOf<Pickup>([]),
    boss: IDLE_BOSS,
    weaponKind: WeaponKind.Spread,
    power: 1,
    bombs: 0,
    shield: false,
    lives: 3,
    score: 0,
    multiplier: 1,
    chainRatio: 0,
    ...extra,
  };
}

function hullRects(render: RecordingRender): RecordedRect[] {
  return render.rectsOf(Palette.shipHull);
}

describe('RunPresenter — the cockpit is the hitbox (GDD v0.10 §4.1, playtest of 2026-10-12)', () => {
  const HITBOX = PlayerTuning.hitboxSize;

  it('draws the bright cockpit exactly on the hitbox, centred on the ship', () => {
    const render = new RecordingRender();
    const at = ship({ position: { x: 100, y: 200 }, previousPosition: { x: 100, y: 200 } });
    presenter(render, false).draw(snapshot(at), 1, 16);
    expect(render.rectsOf(Palette.shipCockpit)).toEqual([
      {
        region: 'field',
        x: 100 - HITBOX / 2,
        y: 200 - HITBOX / 2,
        w: HITBOX,
        h: HITBOX,
        colour: Palette.shipCockpit,
      },
    ]);
  });

  it('draws it over the hull and the wings, so the player sees where a bullet counts', () => {
    const render = new RecordingRender();
    presenter(render, false).draw(snapshot(ship()), 1, 16);
    const hull = render.rects.findIndex((r) => r.colour === Palette.shipHull);
    const wing = render.rects.findIndex((r) => r.colour === Palette.shipWing);
    const core = render.rects.findIndex((r) => r.colour === Palette.shipCockpit);
    expect(core).toBeGreaterThan(hull);
    expect(core).toBeGreaterThan(wing);
  });
});

describe('RunPresenter — ship and bullets (05-state-scenes, first playable)', () => {
  it('draws the ship in the field region, its hull centred on the interpolated position', () => {
    const render = new RecordingRender();
    const moved = ship({ previousPosition: { x: 100, y: 272 }, position: { x: 110, y: 272 } });
    presenter(render, true).draw(snapshot(moved), 0.5, 16);
    const hull = hullRects(render)[0];
    expect(hull?.region).toBe('field');
    expect((hull?.x ?? 0) + (hull?.w ?? 0) / 2).toBe(105);
  });

  it('covers the ship centre with the hull colour, the smoke test oracle', () => {
    const render = new RecordingRender();
    presenter(render, true).draw(snapshot(ship()), 0, 16);
    const covers = hullRects(render).some(
      (r) => r.x <= 120 && 120 < r.x + r.w && r.y <= 272 && 272 < r.y + r.h,
    );
    expect(covers).toBe(true);
  });

  it('draws each Spread bullet centred on its interpolated position, 2 × 6 (hitbox 2 × 8)', () => {
    const render = new RecordingRender();
    presenter(render, true).draw(snapshot(ship(), [bullet(50, 100, 106)]), 0.5, 16);
    const shot = render.rects.find((rect) => rect.colour === Palette.playerShot);
    expect(shot).toEqual({
      region: 'field',
      x: 49,
      y: 100,
      w: 2,
      h: 6,
      colour: Palette.playerShot,
    });
  });

  it('draws enemy bullets 6 × 6 with a 2 × 2 white core (hitbox 4 × 4, GDD v0.9 §3.2)', () => {
    const render = new RecordingRender();
    const enemyShot = bullet(60, 90, 90);
    presenter(render, true).draw(
      snapshot(ship(), [], { enemyBullets: listOf([enemyShot]) }),
      1,
      16,
    );
    expect(render.rectsOf(Palette.enemyShot)).toEqual([
      { region: 'field', x: 57, y: 87, w: 6, h: 6, colour: Palette.enemyShot },
    ]);
    expect(render.rectsOf(Palette.enemyShotCore)).toEqual([
      { region: 'field', x: 59, y: 89, w: 2, h: 2, colour: Palette.enemyShotCore },
    ]);
  });
});

describe('RunPresenter — invulnerability blink (GDD v0.5 §4.1)', () => {
  it.each([
    [PlayerState.Entering, 0, true],
    [PlayerState.Entering, 9, true],
    [PlayerState.Entering, 10, false],
    [PlayerState.Entering, 29, true],
    [PlayerState.Invulnerable, 30, false],
    [PlayerState.Invulnerable, 39, false],
    [PlayerState.Invulnerable, 40, true],
    [PlayerState.Invulnerable, 119, false],
  ])('%s at protection step %i: visible %s (3 blinks per second)', (state, steps, visible) => {
    const render = new RecordingRender();
    const protectedShip = ship({ state, protectionSteps: steps });
    presenter(render, true).draw(snapshot(protectedShip), 0, 16);
    expect(hullRects(render).length > 0).toBe(visible);
  });

  it('never hides a vulnerable ship', () => {
    const render = new RecordingRender();
    presenter(render, true).draw(snapshot(ship({ protectionSteps: 10 })), 0, 16);
    expect(hullRects(render).length).toBeGreaterThan(0);
  });

  it('keeps the ship visible when the blink effect is switched off', () => {
    const render = new RecordingRender();
    const protectedShip = ship({ state: PlayerState.Entering, protectionSteps: 10 });
    presenter(render, false).draw(snapshot(protectedShip), 0, 16);
    expect(hullRects(render).length).toBeGreaterThan(0);
  });
});

function enemyAt(archetype: typeof POPCORN, x: number, y: number): Enemy {
  const enemy = new Enemy();
  enemy.spawn(archetype, { spawn: { x, y } }, 1, undefined);
  return enemy;
}

describe('RunPresenter — enemies, enemy bullets and the HUD (enemies brick)', () => {
  it('draws each role in its own colour, none the hull colour (the smoke-test oracle)', () => {
    const render = new RecordingRender();
    const enemies = [enemyAt(POPCORN, 40, 40), enemyAt(DIVER, 80, 40), enemyAt(GUNNER, 160, 80)];
    presenter(render, true).draw(snapshot(ship(), [], { enemies: listOf(enemies) }), 0, 16);
    expect(render.rectsOf(Palette.popcorn)).toEqual([
      { region: 'field', x: 32, y: 32, w: 16, h: 16, colour: Palette.popcorn },
    ]);
    expect(render.drew(Palette.diver)).toBe(true);
    expect(render.rectsOf(Palette.gunner)[0]).toMatchObject({ w: 32, h: 32 });
  });

  it('draws enemy bullets after the ship, so they stay visible over it', () => {
    const render = new RecordingRender();
    const shot = bullet(120, 272, 272);
    shot.width = 4;
    shot.height = 4;
    presenter(render, true).draw(snapshot(ship(), [], { enemyBullets: listOf([shot]) }), 0, 16);
    const hullIndex = render.rects.findIndex((r) => r.colour === Palette.shipHull);
    const shotIndex = render.rects.findIndex((r) => r.colour === Palette.enemyShot);
    expect(shotIndex).toBeGreaterThan(hullIndex);
  });

  it('hides a Dead ship', () => {
    const render = new RecordingRender();
    presenter(render, false).draw(snapshot(ship({ state: PlayerState.Dead })), 0, 16);
    expect(hullRects(render)).toEqual([]);
  });

  it.each([
    [3, 2],
    [2, 1],
    [1, 0],
    [0, 0],
  ])('with %i lives, draws %i reserve-life icons in the left band', (lives, icons) => {
    const render = new RecordingRender();
    presenter(render, true).draw(snapshot(ship(), [], { lives }), 0, 16);
    const drawn = render.rectsOf(Palette.lifeIcon);
    // A life icon is a small ship: two rectangles.
    expect(drawn).toHaveLength(2 * icons);
    for (const icon of drawn) {
      expect(icon.region).toBe('hud');
      expect(icon.x).toBeGreaterThanOrEqual(8);
      expect(icon.x + icon.w).toBeLessThanOrEqual(120 - 8);
    }
  });
});

describe('RunPresenter — pickups (meta/05-state-scenes, player-kit additions)', () => {
  function pickupAt(kind: PickupKind, x: number, y: number): Pickup {
    const pickup = new Pickup();
    pickup.spawn(kind, x, y, 1);
    return pickup;
  }

  it('draws a 16 × 16 capsule in the P colour, marked by shape: three dots or a bar', () => {
    const render = new RecordingRender();
    const red = pickupAt(PickupKind.PRed, 100, 50);
    const blue = pickupAt(PickupKind.PBlue, 140, 60);
    presenter(render, false).draw(snapshot(ship(), [], { pickups: listOf([red, blue]) }), 1, 16);
    expect(render.rectsOf(Palette.pickupRed)).toEqual([
      { region: 'field', x: 92, y: 42, w: 16, h: 16, colour: Palette.pickupRed },
    ]);
    expect(render.rectsOf(Palette.pickupBlue)).toEqual([
      { region: 'field', x: 132, y: 52, w: 16, h: 16, colour: Palette.pickupBlue },
    ]);
    const marks = render.rectsOf(Palette.pickupMark).map((r) => [r.x, r.y, r.w, r.h]);
    expect(marks).toEqual([
      [95, 49, 2, 2],
      [99, 49, 2, 2],
      [103, 49, 2, 2],
      [139, 56, 2, 8],
    ]);
  });
});

describe('RunPresenter — shot colours per weapon (meta/05-state-scenes, player-kit additions)', () => {
  it('draws Spread bullets and Laser bolts each in its own colour, read from the bullet', () => {
    const render = new RecordingRender();
    const shots = [bullet(100, 100, 100), bullet(140, 100, 100, WeaponKind.Laser)];
    presenter(render, false).draw(snapshot(ship(), shots), 1, 16);
    expect(render.rectsOf(Palette.playerShot)).toHaveLength(1);
    expect(render.rectsOf(Palette.laserShot)).toEqual([
      { region: 'field', x: 138, y: 76, w: 4, h: 48, colour: Palette.laserShot },
    ]);
  });
});

describe('RunPresenter — the Heavy (level brick, F-1)', () => {
  it.each([HEAVY_RING, HEAVY_FAN])('draws the $id in the Heavy colour, 56 × 48', (heavy) => {
    const render = new RecordingRender();
    const enemy = enemyAt(heavy, 120, 72);
    presenter(render, false).draw(snapshot(ship(), [], { enemies: listOf([enemy]) }), 1, 16);
    expect(render.rectsOf(Palette.heavy)).toEqual([
      { region: 'field', x: 92, y: 48, w: 56, h: 48, colour: Palette.heavy },
    ]);
  });
});

describe('RunPresenter — the Carrier and the other pickups (player-kit additions)', () => {
  it('draws the Carrier in its own colour', () => {
    const render = new RecordingRender();
    const carrier = enemyAt(CARRIER, 60, 64);
    presenter(render, false).draw(snapshot(ship(), [], { enemies: listOf([carrier]) }), 1, 16);
    expect(render.rectsOf(Palette.carrier)).toHaveLength(1);
  });

  it.each([
    [PickupKind.Shield, Palette.shieldPickup, 4],
    [PickupKind.Bomb, Palette.bombPickup, 2],
    [PickupKind.OneUp, Palette.oneUpPickup, 2],
  ])('draws pickup kind %i as its own 16 × 16 shape', (kind, colour, parts) => {
    const render = new RecordingRender();
    const pickup = new Pickup();
    pickup.spawn(kind, 100, 50, 1);
    presenter(render, false).draw(snapshot(ship(), [], { pickups: listOf([pickup]) }), 1, 16);
    const rects = render.rectsOf(colour);
    expect(rects).toHaveLength(parts);
    expect(Math.min(...rects.map((r) => r.x))).toBe(92);
    expect(Math.max(...rects.map((r) => r.x + r.w))).toBe(108);
  });
});

describe('RunPresenter — shot opacity (GDD v0.9 §3.2)', () => {
  it('draws player shots at 60 % opacity, so the enemy bullets read first', () => {
    // 0x99 / 0xff = 60 %.
    expect(Palette.playerShot).toMatch(/^#[0-9a-f]{6}99$/);
    expect(Palette.laserShot).toMatch(/^#[0-9a-f]{6}99$/);
    expect(Palette.enemyShot).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('RunPresenter — the boss as grey boxes (F-2a)', () => {
  const FIGHTING = { ...IDLE_BOSS, state: BossState.Fighting, serial: 5 };

  function drawn(boss: BossSnapshot, alpha = 1, bus = new EventBus()): RecordingRender {
    const render = new RecordingRender();
    presenter(render, false, bus).draw(snapshot(ship(), [], { boss }), alpha, 16);
    return render;
  }

  it.each([BossState.Idle, BossState.Warning])('draws nothing of the boss in %s', (state) => {
    expect(drawn({ ...FIGHTING, state }).drew(Palette.boss)).toBe(false);
  });

  it.each([BossState.Entering, BossState.Fighting, BossState.Destroyed, BossState.Fleeing])(
    'draws the 112 × 48 body in %s, in the field region',
    (state) => {
      const body = drawn({ ...FIGHTING, state, position: { x: 100, y: 56 } }).rectsOf(Palette.boss);
      expect(body).toEqual([
        { region: 'field', x: 44, y: 32, w: 112, h: 48, colour: Palette.boss },
      ]);
    },
  );

  it('interpolates the body between its previous and current positions', () => {
    const body = drawn(
      {
        ...FIGHTING,
        previousPosition: { x: 100, y: 56 },
        position: { x: 110, y: 58 },
      },
      0.5,
    ).rectsOf(Palette.boss)[0];
    expect([(body?.x ?? 0) + 56, (body?.y ?? 0) + 24]).toEqual([105, 57]);
  });

  it('draws the turret in phase 1 and no longer from phase 2', () => {
    expect(drawn(FIGHTING).rectsOf(Palette.bossTurret)).toHaveLength(1);
    expect(drawn({ ...FIGHTING, phase: 1 }).rectsOf(Palette.bossTurret)).toHaveLength(0);
  });

  it('flashes white when its serial is hit', () => {
    const bus = new EventBus();
    const render = new RecordingRender();
    const view = presenter(render, false, bus);
    const hit = createGameEvent(GameEventKind.EnemyHit);
    hit.subject = 5;
    bus.publish(hit);
    view.draw(snapshot(ship(), [], { boss: FIGHTING }), 1, 16);
    expect(render.drew(Palette.boss)).toBe(false);
    expect(render.rectsOf(Palette.hitFlash)).toHaveLength(1);
  });
});
