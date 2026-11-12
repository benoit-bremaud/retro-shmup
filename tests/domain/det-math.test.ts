import { describe, expect, it } from 'vitest';
import { detCos, detHypot, detSin } from '../../src/domain/game/det-math';

const ERROR = 1e-6;

describe('detSin and detCos', () => {
  it('stay within 1e-6 of the platform functions over four turns either way', () => {
    for (let i = -4000; i <= 4000; i++) {
      const angle = (i / 1000) * Math.PI;

      expect(Math.abs(detSin(angle) - Math.sin(angle))).toBeLessThan(ERROR);
      expect(Math.abs(detCos(angle) - Math.cos(angle))).toBeLessThan(ERROR);
    }
  });

  it('stay within 1e-6 up to the largest arguments the game reaches, 1e5 rad', () => {
    for (let angle = -1e5; angle <= 1e5; angle += 7.3) {
      expect(Math.abs(detSin(angle) - Math.sin(angle))).toBeLessThan(ERROR);
      expect(Math.abs(detCos(angle) - Math.cos(angle))).toBeLessThan(ERROR);
    }
  });

  it('give the quarter-turn values', () => {
    expect(detSin(0)).toBe(0);
    expect(detCos(0)).toBe(1);
    expect(detSin(Math.PI / 2)).toBeCloseTo(1, 12);
    expect(detCos(Math.PI)).toBeCloseTo(-1, 12);
    expect(detSin(-Math.PI / 2)).toBeCloseTo(-1, 12);
  });

  it('keep the symmetries the gameplay relies on', () => {
    const angle = 0.7321;

    expect(detSin(-angle)).toBe(-detSin(angle));
    expect(detCos(-angle)).toBe(detCos(angle));
  });

  it('return the pinned bits a replay in any engine must reproduce', () => {
    // Golden values: a change here changes every recorded run (ADR-0031 decision 10).
    expect(detSin(1)).toMatchInlineSnapshot(`0.8414709698924886`);
    expect(detCos(2.5)).toMatchInlineSnapshot(`-0.8011436147606636`);
    expect(detSin(-10.25)).toMatchInlineSnapshot(`0.7346984233116141`);
  });
});

describe('detHypot', () => {
  it.each([
    [3, 4, 5],
    [0, 0, 0],
    [-5, 12, 13],
  ])('measures (%d, %d) as %d', (x, y, length) => {
    expect(detHypot(x, y)).toBe(length);
  });
});
