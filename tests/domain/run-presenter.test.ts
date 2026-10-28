import { describe, expect, it } from 'vitest';
import { Pickup, PickupKind } from '../../src/domain/game/pickup';
import { PlayerTuning } from '../../src/domain/game/tuning';
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
import { SPRITE_FLASH_FRAME } from '../../src/domain/ports/render-port';
import type { EffectSettings } from '../../src/domain/options';
import { CRUISER_TURRET } from '../../src/domain/game/cruiser';
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
function presenter(
  render: RecordingRender,
  blink: boolean,
  bus = new EventBus(),
  switches: Partial<EffectSettings> = {},
): RunPresenter {
  return new RunPresenter(
    render,
    {
      blink,
      hitFlash: true,
      explosions: true,
      shake: true,
      bombFlash: true,
      slowMotion: true,
      championName: true,
      graze: true,
      ...switches,
    },
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
    playerShots: 0,
    enemyShots: 0,
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

  it('draws the HP bar and the seconds with the boss, after the field and before the HUD', () => {
    const render = drawn({ ...FIGHTING, hpRatio: 0.5, secondsLeft: 42 });
    expect(render.rectsOf(Palette.bossBarFill)).toEqual([
      { region: 'field', x: 9, y: 5, w: 111, h: 2, colour: Palette.bossBarFill },
    ]);
    expect(render.texts.filter((text) => text.region === 'field' && text.y === 12)).toHaveLength(2);
  });

  it('draws no bar before the boss enters', () => {
    expect(drawn({ ...FIGHTING, state: BossState.Warning }).drew(Palette.bossBarFrame)).toBe(false);
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

describe('RunPresenter — the boss fight game feel (GDD v0.10 §9.4, F-2c)', () => {
  const FRAME_MS = 16.7;
  const MEDIUM_CORE = 32 * 0.55;
  const BOSS_CORE = 112 * 0.3;

  function publish(bus: EventBus, kind: GameEventKind, x: number, y: number, detail = 0): void {
    const event = createGameEvent(kind);
    event.position.x = x;
    event.position.y = y;
    event.detail = detail;
    bus.publish(event);
  }

  /** Cores born this frame: a burst is drawn at age 0 on the frame after it is recorded. */
  function newCores(render: RecordingRender, side: number): RecordedRect[] {
    return render.rectsOf(Palette.explosionHot).filter((rect) => Math.abs(rect.w - side) < 1e-6);
  }

  it('draws the graze spark at the bullet on BULLET_GRAZED (GDD v0.31 §9.4)', () => {
    const bus = new EventBus();
    const render = new RecordingRender();
    const view = presenter(render, false, bus);

    publish(bus, GameEventKind.BulletGrazed, 132, 272);
    view.draw(snapshot(ship()), 1, FRAME_MS);

    const sparks = render.rectsOf(Palette.grazeSpark);
    expect(sparks).toHaveLength(4);
    expect(sparks.every((rect) => Math.hypot(rect.x - 132, rect.y - 272) < 8)).toBe(true);
  });

  it('draws no graze spark with the graze switch off', () => {
    const bus = new EventBus();
    const render = new RecordingRender();
    const view = presenter(render, false, bus, { graze: false });

    publish(bus, GameEventKind.BulletGrazed, 132, 272);
    view.draw(snapshot(ship()), 1, FRAME_MS);

    expect(render.drew(Palette.grazeSpark)).toBe(false);
  });

  it('explodes the ship on PLAYER_DIED (medium tier, at the event position)', () => {
    const bus = new EventBus();
    const render = new RecordingRender();
    const view = presenter(render, false, bus);
    publish(bus, GameEventKind.PlayerDied, 80, 200);
    view.draw(snapshot(ship({ state: PlayerState.Dead })), 1, FRAME_MS);
    expect(newCores(render, MEDIUM_CORE)).toEqual([
      expect.objectContaining({ x: 80 - MEDIUM_CORE / 2, y: 200 - MEDIUM_CORE / 2 }),
    ]);
  });

  it('draws no explosion of any kind with the explosions switch off', () => {
    const bus = new EventBus();
    const render = new RecordingRender();
    const view = presenter(render, false, bus, { explosions: false });
    publish(bus, GameEventKind.PlayerDied, 80, 200);
    publish(bus, GameEventKind.BossPhaseChanged, 120, 60, 1);
    publish(bus, GameEventKind.BossDestroyed, 120, 60);
    for (let i = 0; i < 180; i += 1) view.draw(snapshot(ship()), 1, FRAME_MS);
    expect(render.drew(Palette.explosionHot)).toBe(false);
    expect(render.drew(Palette.explosionCool)).toBe(false);
  });

  it('chains 1 boss burst then 5 medium ones on the hull, at least 1/3 s apart', () => {
    const bus = new EventBus();
    const render = new RecordingRender();
    const view = presenter(render, false, bus);
    publish(bus, GameEventKind.BossDestroyed, 120, 60);
    const starts: number[] = [];
    let bossBursts = 0;
    for (let frame = 0; frame < 300; frame += 1) {
      render.clear();
      view.draw(snapshot(ship()), 1, FRAME_MS);
      bossBursts += newCores(render, BOSS_CORE).length;
      const cores = newCores(render, MEDIUM_CORE);
      for (const core of cores) {
        expect(Math.abs(core.x + core.w / 2 - 120)).toBeLessThanOrEqual(56);
        expect(Math.abs(core.y + core.h / 2 - 60)).toBeLessThanOrEqual(24);
        starts.push(frame * FRAME_MS);
      }
    }
    expect(bossBursts).toBe(1);
    expect(starts).toHaveLength(5);
    expect(starts[0]).toBeGreaterThanOrEqual(1000 / 3);
    for (let i = 1; i < starts.length; i += 1) {
      expect((starts[i] ?? 0) - (starts[i - 1] ?? 0)).toBeGreaterThanOrEqual(1000 / 3);
    }
    // All five inside the destroyed sequence: 2 s of simulation, stretched by the 0.5 s of slow
    // motion at half speed to 2.25 s of wall time.
    expect(starts[4]).toBeLessThanOrEqual(2250);
  });

  it('throws no turret debris on a later phase change: the turret breaks once, into phase 2', () => {
    const bus = new EventBus();
    const render = new RecordingRender();
    const view = presenter(render, false, bus);
    publish(bus, GameEventKind.BossPhaseChanged, 120, 60, 2);
    view.draw(snapshot(ship()), 1, FRAME_MS);
    expect(render.drew(Palette.explosionHot)).toBe(false);
  });

  it('bursts debris where the turret was on the phase change', () => {
    const bus = new EventBus();
    const render = new RecordingRender();
    const view = presenter(render, false, bus);
    publish(bus, GameEventKind.BossPhaseChanged, 120, 60, 1);
    view.draw(snapshot(ship()), 1, FRAME_MS);
    const fragments = render.rectsOf(Palette.explosionHot);
    expect(fragments).toHaveLength(10);
    for (const fragment of fragments) {
      expect(fragment.x + 1).toBe(120 + CRUISER_TURRET.offsetX);
      expect(fragment.y + 1).toBe(60 + CRUISER_TURRET.offsetY);
    }
  });

  it('runs at half speed for 0.5 s of wall time after BOSS_DESTROYED, then full speed', () => {
    const bus = new EventBus();
    const view = presenter(new RecordingRender(), false, bus);
    expect(view.timeScale()).toBe(1);
    publish(bus, GameEventKind.BossDestroyed, 120, 60);
    expect(view.timeScale()).toBe(0.5);
    for (let i = 0; i < 100; i += 1) view.draw(snapshot(ship()), 1, 0); // frozen frames
    expect(view.timeScale()).toBe(0.5);
    view.draw(snapshot(ship()), 1, 499);
    expect(view.timeScale()).toBe(0.5);
    view.draw(snapshot(ship()), 1, 1);
    expect(view.timeScale()).toBe(1);
  });

  it('completes the chain inside the sequence even at 10 frames per second', () => {
    // Codex review of #43: each burst waits for the frame after its 1/3 s, so slow frames stretch
    // the chain; five bursts still end inside the 2.25 s of wall time of the destroyed sequence.
    const bus = new EventBus();
    const render = new RecordingRender();
    const view = presenter(render, false, bus);
    publish(bus, GameEventKind.BossDestroyed, 120, 60);
    let inSequence = 0;
    let total = 0;
    for (let frame = 1; frame <= 40; frame += 1) {
      render.clear();
      view.draw(snapshot(ship()), 1, 100);
      const bursts = newCores(render, MEDIUM_CORE).length;
      total += bursts;
      if (frame * 100 <= 2250) inSequence += bursts;
    }
    expect(inSequence).toBe(total); // none left for after the sequence
    expect(total).toBe(5);
  });

  it('keeps the whole 0.5 s of slow motion when the frame of the death is a long one', () => {
    const bus = new EventBus();
    const view = presenter(new RecordingRender(), false, bus);
    publish(bus, GameEventKind.BossDestroyed, 120, 60);
    view.draw(snapshot(ship()), 1, 250); // the frame that ran the killing step
    view.draw(snapshot(ship()), 1, 499);
    expect(view.timeScale()).toBe(0.5);
    view.draw(snapshot(ship()), 1, 1);
    expect(view.timeScale()).toBe(1);
  });

  it('keeps full speed with the slow-motion switch off', () => {
    const bus = new EventBus();
    const view = presenter(new RecordingRender(), false, bus, { slowMotion: false });
    publish(bus, GameEventKind.BossDestroyed, 120, 60);
    expect(view.timeScale()).toBe(1);
  });
});

describe('RunPresenter — placeholder sprites (GDD v0.17 §3.2.1, render/04-class-sprites)', () => {
  const FIGHTING = { ...IDLE_BOSS, state: BossState.Fighting, serial: 5 };

  function loaded(): RecordingRender {
    const render = new RecordingRender();
    render.spritesLoaded = true;
    return render;
  }

  it('draws the ship as its sprite on the interpolated position, the cockpit still on the hitbox', () => {
    const render = loaded();
    const moved = ship({ previousPosition: { x: 100, y: 200 }, position: { x: 110, y: 200 } });
    presenter(render, false).draw(snapshot(moved), 0.5, 16);
    expect(render.sprites).toEqual([{ region: 'field', id: 'player', x: 105, y: 200, frame: 0 }]);
    expect(hullRects(render)).toEqual([]);
    expect(render.drew(Palette.shipWing)).toBe(false);
    const half = PlayerTuning.hitboxSize / 2;
    expect(render.rectsOf(Palette.shipCockpit)).toMatchObject([{ x: 105 - half, y: 200 - half }]);
    expect(render.order.indexOf(`rect ${Palette.shipCockpit}`)).toBeGreaterThan(
      render.order.indexOf('sprite player'),
    );
  });

  it.each([
    [POPCORN, 'popcorn'],
    [DIVER, 'diver'],
    [GUNNER, 'gunner'],
    [CARRIER, 'carrier'],
    [HEAVY_RING, 'heavy'],
    [HEAVY_FAN, 'heavy'],
  ] as const)('draws the %o role as the %s sprite, centred, with no box', (archetype, id) => {
    const render = loaded();
    presenter(render, false).draw(
      snapshot(ship({ state: PlayerState.Dead }), [], {
        enemies: listOf([enemyAt(archetype, 60, 70)]),
      }),
      1,
      16,
    );
    expect(render.sprites).toEqual([{ region: 'field', id, x: 60, y: 70, frame: 0 }]);
    expect(render.rects.filter((r) => r.region === 'field')).toEqual([]);
  });

  it('draws a flashing enemy as its white silhouette, the flash frame of its sprite (§9.4)', () => {
    const bus = new EventBus();
    const render = loaded();
    const view = presenter(render, false, bus);
    const enemy = enemyAt(POPCORN, 60, 70);
    const hit = createGameEvent(GameEventKind.EnemyHit);
    hit.subject = enemy.serial;
    bus.publish(hit);
    view.draw(snapshot(ship({ state: PlayerState.Dead }), [], { enemies: listOf([enemy]) }), 1, 16);
    expect(render.sprites).toEqual([
      { region: 'field', id: 'popcorn', x: 60, y: 70, frame: SPRITE_FLASH_FRAME },
    ]);
    expect(render.drew(Palette.hitFlash)).toBe(false);
  });

  it('builds the Cruiser from two wings at x ∓ 44, the hull, then the turret in phase 0', () => {
    const render = loaded();
    const boss = { ...FIGHTING, position: { x: 100, y: 56 }, previousPosition: { x: 100, y: 56 } };
    presenter(render, false).draw(snapshot(ship({ state: PlayerState.Dead }), [], { boss }), 1, 16);
    expect(render.sprites).toEqual([
      { region: 'field', id: 'cruiserWing', x: 56, y: 56, frame: 0 },
      { region: 'field', id: 'cruiserWing', x: 144, y: 56, frame: 0 },
      { region: 'field', id: 'cruiserHull', x: 100, y: 56, frame: 0 },
      {
        region: 'field',
        id: 'cruiserTurret',
        x: 100 + CRUISER_TURRET.offsetX,
        y: 56 + CRUISER_TURRET.offsetY,
        frame: 0,
      },
    ]);
    expect(render.drew(Palette.boss)).toBe(false);
    expect(render.drew(Palette.bossTurret)).toBe(false);
  });

  it('keeps the wings and drops the turret once phase 2 broke it off', () => {
    const render = loaded();
    presenter(render, false).draw(
      snapshot(ship({ state: PlayerState.Dead }), [], { boss: { ...FIGHTING, phase: 1 } }),
      1,
      16,
    );
    expect(render.sprites.map((sprite) => sprite.id)).toEqual([
      'cruiserWing',
      'cruiserWing',
      'cruiserHull',
    ]);
  });

  it('draws a flashing Cruiser as the white silhouettes of its parts', () => {
    const bus = new EventBus();
    const render = loaded();
    const view = presenter(render, false, bus);
    const hit = createGameEvent(GameEventKind.EnemyHit);
    hit.subject = 5;
    bus.publish(hit);
    view.draw(snapshot(ship({ state: PlayerState.Dead }), [], { boss: FIGHTING }), 1, 16);
    expect(render.sprites.map((sprite) => sprite.frame)).toEqual([
      SPRITE_FLASH_FRAME,
      SPRITE_FLASH_FRAME,
      SPRITE_FLASH_FRAME,
      SPRITE_FLASH_FRAME,
    ]);
    expect(render.drew(Palette.hitFlash)).toBe(false);
  });

  it('draws a flashing Cruiser in phase 2 as three silhouettes, its turret gone', () => {
    const bus = new EventBus();
    const render = loaded();
    const view = presenter(render, false, bus);
    const hit = createGameEvent(GameEventKind.EnemyHit);
    hit.subject = 5;
    bus.publish(hit);
    view.draw(
      snapshot(ship({ state: PlayerState.Dead }), [], { boss: { ...FIGHTING, phase: 1 } }),
      1,
      16,
    );
    expect(render.sprites.map((sprite) => [sprite.id, sprite.frame])).toEqual([
      ['cruiserWing', SPRITE_FLASH_FRAME],
      ['cruiserWing', SPRITE_FLASH_FRAME],
      ['cruiserHull', SPRITE_FLASH_FRAME],
    ]);
  });

  it('draws a hit enemy as its plain sprite when the hit flash is switched off (§9.3)', () => {
    const bus = new EventBus();
    const render = loaded();
    const view = presenter(render, false, bus, { hitFlash: false });
    const enemy = enemyAt(POPCORN, 60, 70);
    const hit = createGameEvent(GameEventKind.EnemyHit);
    hit.subject = enemy.serial;
    bus.publish(hit);
    view.draw(snapshot(ship({ state: PlayerState.Dead }), [], { enemies: listOf([enemy]) }), 1, 16);
    expect(render.sprites).toEqual([{ region: 'field', id: 'popcorn', x: 60, y: 70, frame: 0 }]);
  });

  it('draws nothing of an idle Cruiser', () => {
    const render = loaded();
    presenter(render, false).draw(snapshot(ship({ state: PlayerState.Dead })), 1, 16);
    expect(render.sprites).toEqual([]);
  });
});
