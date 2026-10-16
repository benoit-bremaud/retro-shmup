import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PLAYER_CELL, POPCORN_CELL, SHIP_CELL_SIZE } from '../support/ship-cells.js';
import { Palette } from '../../src/domain/presentation/palette.js';

// The single browser smoke test (ADR-0003; 05-state-scenes; ADR-0018 Consequences): a phone in
// portrait, then a rotation. A tap on the PLAY row starts a run, the ship reaches its resting
// point, the pause button pauses, the RESUME row resumes; a landscape window pauses without restarting the
// run, `Esc` resumes, and enemies appear.

// A phone: 390 × 844 CSS pixels at pixel ratio 2, with touch (ADR-0018 Consequences).
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });

/** The ship's resting point in play-field pixels (GDD §4.1). */
const REST = { x: 120, y: 272 };
/** A ship-grey hull pixel 8 px below the sprite's centre: no star colour, and no enemy there at rest. */
const HULL_PROBE = { x: REST.x, y: REST.y + 8 };

interface Geometry {
  readonly portrait: boolean;
  readonly scale: number;
  readonly fieldX: number;
  readonly fieldY: number;
}

/**
 * The screen in use, told by the canvas aspect (landscape 480 × 320, portrait 240 × 352,
 * ADR-0015), so the probes need no hardcoded size.
 */
async function geometry(page: Page): Promise<Geometry> {
  const size = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#screen');
    return { width: canvas?.width ?? 0, height: canvas?.height ?? 0 };
  });
  const portrait = size.height > size.width;
  return {
    portrait,
    scale: size.width / (portrait ? 240 : 480),
    fieldX: portrait ? 0 : 120,
    fieldY: portrait ? 32 : 0,
  };
}

/** True when the visible canvas shows `colour` at the device pixel (x, y). */
async function colourAt(
  page: Page,
  x: number,
  y: number,
  colour: { r: number; g: number; b: number },
): Promise<boolean> {
  return page.evaluate(
    ({ px, py, c }) => {
      const context = document.querySelector<HTMLCanvasElement>('#screen')?.getContext('2d');
      if (context === null || context === undefined) return false;
      const pixel = context.getImageData(px, py, 1, 1).data;
      return pixel[0] === c.r && pixel[1] === c.g && pixel[2] === c.b;
    },
    { px: x, py: y, c: colour },
  );
}

/**
 * The colour of the hull pixel in the ships sheet itself, read from the PNG the game loads: the
 * sprite is baked nose up, so the sheet row is the cell's mirror image. The probe follows the art
 * instead of a copied colour, and an empty (transparent) pixel fails the test loudly.
 */
async function spriteHullColour(page: Page): Promise<{ r: number; g: number; b: number }> {
  const half = SHIP_CELL_SIZE / 2;
  const below = half + (HULL_PROBE.y - REST.y);
  const pixel = await page.evaluate(
    async ({ url, column, row }) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (context === null) return null;
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(column, row, 1, 1).data);
    },
    {
      url: 'assets/sprites/ships.png',
      column: half + (HULL_PROBE.x - REST.x),
      row: PLAYER_CELL.flipY ? SHIP_CELL_SIZE - 1 - below : below,
    },
  );
  const [r, g, b, a] = pixel ?? [];
  if (r === undefined || g === undefined || b === undefined || a !== 255) {
    throw new Error('the hull probe pixel of the ships sheet is not opaque: move HULL_PROBE');
  }
  return { r, g, b };
}

/** True when the sprite's hull pixel is on screen where the ship rests, in whichever screen is in use. */
async function hullAtRest(page: Page): Promise<boolean> {
  const g = await geometry(page);
  const hull = await spriteHullColour(page);
  return colourAt(
    page,
    (g.fieldX + HULL_PROBE.x) * g.scale + 1,
    (g.fieldY + HULL_PROBE.y) * g.scale + 1,
    hull,
  );
}

/** `Palette.menuHighlight`, the bar behind the highlighted row of the pause menu. */
const MENU_HIGHLIGHT = { r: 0x3b, g: 0x4a, b: 0x8a };
/**
 * A pixel of the bar behind RESUME, the first row highlighted on entry, left of its text, in
 * play-field pixels: the three-row menu starts at y 136 and the bar at x 89 (overlays.ts, menu-layout.ts).
 */
const PAUSE_PIXEL = { x: 90, y: 137 };
/** The middle of the PLAY row of the title menu (three rows from y 136), in play-field pixels. */
const PLAY_ROW = { x: 120, y: 144 };
/** The middle of the RESUME row (three rows from y 136), in play-field pixels. */
const RESUME_ROW = { x: 120, y: 144 };

/** True when the pause menu shows with RESUME highlighted, so the scene is `Paused`. */
async function paused(page: Page): Promise<boolean> {
  const g = await geometry(page);
  return colourAt(
    page,
    (g.fieldX + PAUSE_PIXEL.x) * g.scale + 1,
    (g.fieldY + PAUSE_PIXEL.y) * g.scale + 1,
    MENU_HIGHLIGHT,
  );
}

/** Taps the logical-screen pixel (x, y) through the canvas client rectangle. */
async function tapScreen(page: Page, x: number, y: number): Promise<void> {
  const g = await geometry(page);
  const rect = await page.evaluate(() => {
    const box = document.querySelector('#screen')?.getBoundingClientRect();
    return { left: box?.left ?? 0, top: box?.top ?? 0, width: box?.width ?? 0 };
  });
  const cssPerPixel = rect.width / (g.portrait ? 240 : 480);
  await page.touchscreen.tap(
    rect.left + (x + 0.5) * cssPerPixel,
    rect.top + (y + 0.5) * cssPerPixel,
  );
}

/** The three star colours as `r,g,b` keys: the only other thing the field paints behind a wave. */
const STAR_KEYS = [Palette.starFar, Palette.starMid, Palette.starNear].map((hex) =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(','),
);

/**
 * The opaque colours of one cell of the ships sheet that neither the player's ship nor a star
 * uses, read from the PNG the game loads, as `r,g,b` keys. Other enemies may share them (the Heavy
 * only spawns at 102 s), so during the first wave, which is Popcorn only, a pixel of one of them
 * on screen is a Popcorn.
 */
async function colourOnlyIn(page: Page, cell: { column: number; row: number }): Promise<string[]> {
  return page.evaluate(
    async ({ url, size, wanted, apart, stars }) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (context === null) return [];
      context.drawImage(image, 0, 0);
      const mine = new Set<string>();
      const others = new Set<string>(stars);
      const data = context.getImageData(0, 0, image.width, image.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] !== 255) continue;
        const pixel = i / 4;
        const column = Math.floor((pixel % image.width) / size);
        const row = Math.floor(Math.floor(pixel / image.width) / size);
        const key = Array.from(data.subarray(i, i + 3)).join(',');
        if (column === wanted.column && row === wanted.row) mine.add(key);
        else if (column === apart.column && row === apart.row) others.add(key);
      }
      return [...mine].filter((key) => !others.has(key));
    },
    {
      url: 'assets/sprites/ships.png',
      size: SHIP_CELL_SIZE,
      wanted: cell,
      apart: PLAYER_CELL,
      stars: STAR_KEYS,
    },
  );
}

/** True when a Popcorn is painted anywhere in the play field, in whichever screen is in use. */
async function popcornInField(page: Page): Promise<boolean> {
  const g = await geometry(page);
  const colours = await colourOnlyIn(page, POPCORN_CELL);
  if (colours.length === 0) throw new Error('the Popcorn cell has no colour of its own');
  return page.evaluate(
    ({ keys, x, y, w, h }) => {
      const context = document.querySelector<HTMLCanvasElement>('#screen')?.getContext('2d');
      if (context === null || context === undefined) return false;
      const wanted = new Set(keys);
      const data = context.getImageData(x, y, w, h).data;
      for (let i = 0; i < data.length; i += 4) {
        if (wanted.has(Array.from(data.subarray(i, i + 3)).join(','))) return true;
      }
      return false;
    },
    {
      keys: colours,
      x: g.fieldX * g.scale,
      y: g.fieldY * g.scale,
      w: 240 * g.scale,
      h: 320 * g.scale,
    },
  );
}

/** Number of painted (non-black) pixels: the canvas is not blank. */
async function paintedPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#screen');
    const context = canvas?.getContext('2d');
    if (canvas === null || context === null || context === undefined) return 0;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0) > 0) painted += 1;
    }
    return painted;
  });
}

/** Script time per animation frame over two seconds, from Chromium's DevTools metrics. */
async function scriptMsPerFrame(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const scriptSeconds = async (): Promise<number> => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((metric) => metric.name === 'ScriptDuration')?.value ?? 0;
  };
  const before = await scriptSeconds();
  const frames = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let count = 0;
        const start = performance.now();
        const tick = (): void => {
          count += 1;
          if (performance.now() - start < 2000) requestAnimationFrame(tick);
          else resolve(count);
        };
        requestAnimationFrame(tick);
      }),
  );
  const after = await scriptSeconds();
  return ((after - before) * 1000) / Math.max(frames, 1);
}

test('a phone starts, pauses and resumes by touch; a rotation pauses without restarting the run', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');

  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(0);
  expect((await geometry(page)).portrait).toBe(true);
  expect(await hullAtRest(page)).toBe(false);
  expect(await popcornInField(page)).toBe(false);

  // A tap on the PLAY row of the title menu starts a run (GDD v0.14). Fly-in then invulnerability
  // blink: once vulnerable, the ship is always drawn. The first Popcorn wave crosses y 272 near
  // field x 42 and the Divers dive from 9 s, so nothing covers the hull at rest during the checks.
  // The menu ignores presses for 150 ms after it opens: wait like a player would.
  await page.waitForTimeout(300);
  const start = await geometry(page);
  await tapScreen(page, start.fieldX + PLAY_ROW.x, start.fieldY + PLAY_ROW.y);
  await expect.poll(() => hullAtRest(page), { timeout: 5000 }).toBe(true);
  // Past the 2 s fly-in and invulnerability blink, the ship is always drawn: the single checks
  // below never catch an "off" blink frame.
  await page.waitForTimeout(2100);
  await expect.poll(() => hullAtRest(page), { timeout: 2000 }).toBe(true);

  // The pause button (portrait: x 192 to 239, y 0 to 31) pauses.
  await tapScreen(page, 215, 16);
  await expect.poll(() => paused(page), { timeout: 2000 }).toBe(true);

  // A tap on the RESUME row resumes (GDD v0.13 §9.1). After the 1 s count-in the pause is gone;
  // the finger lifted before play, so it steers nothing and the ship is still at rest.
  // A menu ignores presses for 150 ms after it opens (doubled-tap guard): wait like a player would.
  await page.waitForTimeout(300);
  const g = await geometry(page);
  await tapScreen(page, g.fieldX + RESUME_ROW.x, g.fieldY + RESUME_ROW.y);
  await page.waitForTimeout(1200);
  expect(await paused(page)).toBe(false);
  await expect.poll(() => hullAtRest(page), { timeout: 2000 }).toBe(true);

  // A rotation to landscape pauses (GDD v0.7 §9.1); Esc resumes the same run: after the count-in
  // the ship is at its last point, not flying in again from the spawn.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => (await geometry(page)).portrait).toBe(false);
  await expect.poll(() => paused(page), { timeout: 2000 }).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  expect(await paused(page)).toBe(false);
  expect(await hullAtRest(page)).toBe(true);

  // The enemies brick: the first wave is on screen.
  await expect.poll(() => popcornInField(page), { timeout: 5000 }).toBe(true);

  const msPerFrame = await scriptMsPerFrame(page);
  // Measured and logged against the 4 ms budget (ADR-0002 decision 7), not asserted: this is an
  // upper bound (all page scripts, draw calls included) on a desktop, not the reference phone.
  test.info().annotations.push({
    type: 'script time per frame',
    description: `${msPerFrame.toFixed(3)} ms (budget: 4 ms of logic per frame on a 2019 phone)`,
  });
  console.log(`Script time per frame: ${msPerFrame.toFixed(3)} ms`);

  expect(errors).toEqual([]);
});
