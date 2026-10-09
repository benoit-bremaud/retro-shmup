import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// The single browser smoke test (ADR-0003; 05-state-scenes, first playable): the built page loads,
// the canvas paints, and Enter starts a run in which the ship appears at its resting point.

/** The hull colour `Palette.shipHull`, which no star uses. */
const HULL = { r: 0x4f, g: 0xd1, b: 0xc5 };
/** The ship's resting point in the 480 × 320 landscape logical screen: field x 120 + 120. */
const REST = { x: 240, y: 272 };

/** True when the visible canvas shows the hull colour at the ship's resting point. */
async function hullAtRest(page: Page): Promise<boolean> {
  return page.evaluate(
    ({ hull, rest }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('#screen');
      const context = canvas?.getContext('2d');
      if (canvas === null || context === null || context === undefined) return false;
      const scale = canvas.width / 480;
      const pixel = context.getImageData(rest.x * scale + 1, rest.y * scale + 1, 1, 1).data;
      return pixel[0] === hull.r && pixel[1] === hull.g && pixel[2] === hull.b;
    },
    { hull: HULL, rest: REST },
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

test('the title paints, Enter starts a run, and the ship reaches its resting point', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('./');

  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(0);
  expect(await hullAtRest(page)).toBe(false);

  await page.keyboard.press('Enter');
  // Fly-in then invulnerability blink: once vulnerable, the ship is always drawn.
  await expect.poll(() => hullAtRest(page), { timeout: 5000 }).toBe(true);

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
