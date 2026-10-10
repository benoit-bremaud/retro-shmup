import { describe, expect, it } from 'vitest';
import { PlayerState } from '../../src/domain/game/player';
import type { PlayerSnapshot, WorldSnapshot } from '../../src/domain/game/run';
import type { Bullet } from '../../src/domain/game/bullet';
import { Palette } from '../../src/domain/presentation/palette';
import { RunPresenter } from '../../src/domain/presentation/run-presenter';
import type { ReadonlyActiveList } from '../../src/domain/game/active-list';
import { RecordingRender } from '../support/recording-render';
import type { RecordedRect } from '../support/recording-render';

function ship(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    position: { x: 120, y: 272 },
    previousPosition: { x: 120, y: 272 },
    state: PlayerState.Vulnerable,
    protectionSteps: 0,
    ...overrides,
  };
}

function bullet(x: number, y: number, previousY: number): Bullet {
  return {
    position: { x, y },
    previousPosition: { x, y: previousY },
    velocity: { x: 0, y: -360 },
    width: 2,
    height: 8,
    damage: 1,
    pierceLeft: 0,
  };
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

function snapshot(player: PlayerSnapshot, bullets: Bullet[] = []): WorldSnapshot {
  return { player, playerBullets: listOf(bullets) };
}

function hullRects(render: RecordingRender): RecordedRect[] {
  return render.rectsOf(Palette.shipHull);
}

describe('RunPresenter — ship and bullets (05-state-scenes, first playable)', () => {
  it('draws the ship in the field region, its hull centred on the interpolated position', () => {
    const render = new RecordingRender();
    const moved = ship({ previousPosition: { x: 100, y: 272 }, position: { x: 110, y: 272 } });
    new RunPresenter(render, { blink: true }).draw(snapshot(moved), 0.5);
    const hull = hullRects(render)[0];
    expect(hull?.region).toBe('field');
    expect((hull?.x ?? 0) + (hull?.w ?? 0) / 2).toBe(105);
  });

  it('covers the ship centre with the hull colour, the smoke test oracle', () => {
    const render = new RecordingRender();
    new RunPresenter(render, { blink: true }).draw(snapshot(ship()), 0);
    const covers = hullRects(render).some(
      (r) => r.x <= 120 && 120 < r.x + r.w && r.y <= 272 && 272 < r.y + r.h,
    );
    expect(covers).toBe(true);
  });

  it('draws each active bullet centred on its interpolated position', () => {
    const render = new RecordingRender();
    new RunPresenter(render, { blink: true }).draw(snapshot(ship(), [bullet(50, 100, 106)]), 0.5);
    const shot = render.rects.find((rect) => rect.colour === Palette.playerShot);
    expect(shot).toEqual({ region: 'field', x: 49, y: 99, w: 2, h: 8, colour: Palette.playerShot });
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
    new RunPresenter(render, { blink: true }).draw(snapshot(protectedShip), 0);
    expect(hullRects(render).length > 0).toBe(visible);
  });

  it('never hides a vulnerable ship', () => {
    const render = new RecordingRender();
    new RunPresenter(render, { blink: true }).draw(snapshot(ship({ protectionSteps: 10 })), 0);
    expect(hullRects(render).length).toBeGreaterThan(0);
  });

  it('keeps the ship visible when the blink effect is switched off', () => {
    const render = new RecordingRender();
    const protectedShip = ship({ state: PlayerState.Entering, protectionSteps: 10 });
    new RunPresenter(render, { blink: false }).draw(snapshot(protectedShip), 0);
    expect(hullRects(render).length).toBeGreaterThan(0);
  });
});
