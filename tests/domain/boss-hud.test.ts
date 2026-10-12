import { describe, expect, it } from 'vitest';
import { BossState } from '../../src/domain/game/boss';
import type { BossSnapshot } from '../../src/domain/game/run';
import { drawBossBar } from '../../src/domain/presentation/boss-hud';
import { drawWarning } from '../../src/domain/presentation/overlays';
import { Palette } from '../../src/domain/presentation/palette';
import { IDLE_BOSS } from '../support/boss-snapshot';
import { RecordingRender } from '../support/recording-render';

const FIGHTING: BossSnapshot = { ...IDLE_BOSS, state: BossState.Fighting, serial: 5 };

function barOf(boss: BossSnapshot): RecordingRender {
  const render = new RecordingRender();
  drawBossBar(render, boss);
  return render;
}

describe('Boss HP bar and seconds (GDD v0.10 §6, §9.2)', () => {
  it.each([BossState.Idle, BossState.Warning])('draws nothing in %s', (state) => {
    const render = barOf({ ...FIGHTING, state });
    expect(render.rects).toEqual([]);
    expect(render.texts).toEqual([]);
  });

  it.each([BossState.Entering, BossState.Fighting, BossState.Destroyed, BossState.Fleeing])(
    'draws the bar and the seconds in %s, from the start of the entry to the end of the sequence',
    (state) => {
      const render = barOf({ ...FIGHTING, state });
      expect(render.rectsOf(Palette.bossBarFrame).length).toBeGreaterThan(0);
      expect(render.texts.length).toBeGreaterThan(0);
    },
  );

  it('outlines a 224 × 4 box at x 8, y 4 of the field with a 1 px frame', () => {
    const frame = barOf(FIGHTING).rectsOf(Palette.bossBarFrame);
    expect(frame).toEqual([
      { region: 'field', x: 8, y: 4, w: 224, h: 1, colour: Palette.bossBarFrame },
      { region: 'field', x: 8, y: 7, w: 224, h: 1, colour: Palette.bossBarFrame },
      { region: 'field', x: 8, y: 4, w: 1, h: 4, colour: Palette.bossBarFrame },
      { region: 'field', x: 231, y: 4, w: 1, h: 4, colour: Palette.bossBarFrame },
    ]);
  });

  it.each([
    [1, 222],
    [0.5, 111],
    [0.25, 56],
  ])('fills the inside in proportion to the HP left: %d gives %d px', (hpRatio, width) => {
    const fill = barOf({ ...FIGHTING, hpRatio }).rectsOf(Palette.bossBarFill);
    expect(fill).toEqual([
      { region: 'field', x: 9, y: 5, w: width, h: 2, colour: Palette.bossBarFill },
    ]);
  });

  it('draws no fill at 0 HP', () => {
    expect(barOf({ ...FIGHTING, hpRatio: 0 }).rectsOf(Palette.bossBarFill)).toEqual([]);
  });

  it('marks the 66 % threshold of phase 2 with a tick the height of the bar', () => {
    expect(barOf(FIGHTING).rectsOf(Palette.bossBarTick)).toEqual([
      { region: 'field', x: 156, y: 4, w: 1, h: 4, colour: Palette.bossBarTick },
    ]);
  });

  it('draws the tick over an empty bar too, so the threshold is always readable', () => {
    expect(barOf({ ...FIGHTING, hpRatio: 0 }).rectsOf(Palette.bossBarTick)).toHaveLength(1);
  });

  it.each([
    [
      90,
      [
        { text: '9', x: 218 },
        { text: '0', x: 226 },
      ],
    ],
    [
      10,
      [
        { text: '1', x: 218 },
        { text: '0', x: 226 },
      ],
    ],
    [9, [{ text: '9', x: 226 }]],
    [0, [{ text: '0', x: 226 }]],
  ])('right-aligns the %d seconds left under the end of the bar', (secondsLeft, digits) => {
    // The digits are drawn units first: compare them in reading order.
    const texts = [...barOf({ ...FIGHTING, secondsLeft }).texts].sort((a, b) => a.x - b.x);
    expect(texts).toEqual(
      digits.map((digit) => ({
        region: 'field',
        x: digit.x,
        y: 12,
        text: digit.text,
        font: 'hud',
      })),
    );
  });

  it('shows 90 from the start of the entry, before the fight starts', () => {
    const texts = barOf({ ...FIGHTING, state: BossState.Entering, secondsLeft: 90 }).texts;
    expect(
      texts
        .sort((a, b) => a.x - b.x)
        .map((text) => text.text)
        .join(''),
    ).toBe('90');
  });
});

describe('WARNING banner (GDD v0.10 §6, §9.7)', () => {
  const WARNING: BossSnapshot = { ...IDLE_BOSS, state: BossState.Warning };

  function shown(stateSteps: number, blink = true, language: 'en' | 'fr' = 'en'): string[] {
    const render = new RecordingRender();
    drawWarning(render, { ...WARNING, stateSteps }, blink, language);
    return render.texts.filter((text) => text.font === 'title').map((text) => text.text);
  }

  it('blinks twice in its 3 s: visible 0.75 s, hidden 0.75 s, twice', () => {
    const visible: boolean[] = [];
    for (let step = 0; step < 180; step += 1) visible.push(shown(step).length > 0);
    expect(visible.slice(0, 45).every(Boolean)).toBe(true);
    expect(visible.slice(45, 90).some(Boolean)).toBe(false);
    expect(visible.slice(90, 135).every(Boolean)).toBe(true);
    expect(visible.slice(135, 180).some(Boolean)).toBe(false);
  });

  it('never blinks more than twice in 3 s, under the 3 per second of GDD §9.7', () => {
    let rises = 0;
    let previous = false;
    for (let step = 0; step < 180; step += 1) {
      const now = shown(step).length > 0;
      if (now && !previous) rises += 1;
      previous = now;
    }
    expect(rises).toBe(2);
  });

  it('stays steady when the blink effect is off: the announcement is information, not an effect', () => {
    for (let step = 0; step < 180; step += 1) expect(shown(step, false)).toHaveLength(1);
  });

  it('says WARNING in English and ATTENTION in French, from the catalogue', () => {
    expect(shown(0, true, 'en')).toEqual(['WARNING']);
    expect(shown(0, true, 'fr')).toEqual(['ATTENTION']);
  });

  it.each([
    BossState.Idle,
    BossState.Entering,
    BossState.Fighting,
    BossState.Destroyed,
    BossState.Fleeing,
  ])('draws nothing in %s', (state) => {
    const render = new RecordingRender();
    drawWarning(render, { ...WARNING, state, stateSteps: 0 }, true, 'en');
    expect(render.texts).toEqual([]);
  });

  it('is centred on the field in the title font', () => {
    const render = new RecordingRender();
    drawWarning(render, WARNING, true, 'en');
    expect(render.texts).toEqual([
      { region: 'field', x: 66, y: 150, text: 'WARNING', font: 'title' },
    ]);
  });
});
