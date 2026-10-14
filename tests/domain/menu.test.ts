import { describe, expect, it } from 'vitest';
import { Menu, MenuTuning, NO_ROW } from '../../src/domain/scenes/menu';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { toSteps } from '../../src/domain/game/tuning';

const ROWS = ['resume', 'quit'] as const;
const GUARD = toSteps(MenuTuning.rePressGuardSeconds);

function menu(): Menu<(typeof ROWS)[number]> {
  return new Menu(ROWS);
}

function frame(edit: Partial<IntentFrame> = {}): IntentFrame {
  return Object.assign(createIntentFrame(), edit);
}

/** The field y of the middle of row `index`. */
function rowY(subject: Menu<string>, index: number): number {
  return subject.top + index * MenuTuning.rowHeight + MenuTuning.rowHeight / 2;
}

describe('Menu — keyboard and gamepad (GDD v0.13 §9.1)', () => {
  it('starts on the first row and activates the highlighted row on Confirm', () => {
    const subject = menu();
    expect(subject.highlighted).toBe(0);
    expect(subject.step(frame({ pressed: Button.Confirm }), 0)).toBe(0);
  });

  it('moves one row per new direction, wrapping, and not while the direction is held', () => {
    const subject = menu();
    const down = frame({ moveKind: 'direction', moveY: 1 });
    expect(subject.step(down, 0)).toBe(NO_ROW);
    expect(subject.highlighted).toBe(1);
    subject.step(down, 1);
    expect(subject.highlighted).toBe(1);
    subject.step(frame(), 2);
    subject.step(down, 3);
    expect(subject.highlighted).toBe(0);
    subject.step(frame(), 4);
    subject.step(frame({ moveKind: 'direction', moveY: -1 }), 5);
    expect(subject.highlighted).toBe(1);
  });

  it('ignores a light stick tilt and a pointer target', () => {
    const subject = menu();
    subject.step(frame({ moveKind: 'direction', moveY: 0.3 }), 0);
    subject.step(frame({ moveKind: 'target', moveY: 300 }), 1);
    expect(subject.highlighted).toBe(0);
  });
});

describe('Menu — touch and mouse (GDD v0.13 §9.1)', () => {
  it('activates the row pressed and released, and highlights it', () => {
    const subject = menu();
    const y = rowY(subject, 1);
    expect(subject.step(frame({ tapRegion: 'field', tapX: 120, tapY: y }), 0)).toBe(NO_ROW);
    expect(subject.step(frame({ releaseRegion: 'field', releaseX: 120, releaseY: y }), 3)).toBe(1);
    expect(subject.highlighted).toBe(1);
  });

  it('activates a press and release that arrive in the same step', () => {
    const subject = menu();
    const y = rowY(subject, 1);
    const tap = frame({ tapRegion: 'field', tapY: y, releaseRegion: 'field', releaseY: y });
    expect(subject.step(tap, 0)).toBe(1);
  });

  it('cancels when the release is on another row or off the menu', () => {
    const subject = menu();
    subject.step(frame({ tapRegion: 'field', tapY: rowY(subject, 0) }), 0);
    expect(subject.step(frame({ releaseRegion: 'field', releaseY: rowY(subject, 1) }), 1)).toBe(
      NO_ROW,
    );
    subject.step(frame({ tapRegion: 'field', tapY: rowY(subject, 0) }), 2);
    expect(subject.step(frame({ releaseRegion: 'field', releaseY: 2 }), 3)).toBe(NO_ROW);
    subject.step(frame({ tapRegion: 'field', tapY: rowY(subject, 0) }), 4);
    expect(subject.step(frame({ releaseRegion: 'hud', releaseY: rowY(subject, 0) }), 5)).toBe(
      NO_ROW,
    );
  });

  it('activates nothing on a release without a press on the menu', () => {
    const subject = menu();
    expect(subject.step(frame({ releaseRegion: 'field', releaseY: rowY(subject, 0) }), 0)).toBe(
      NO_ROW,
    );
  });

  it('ignores a new press on the same row within the guard, not after it', () => {
    const subject = menu();
    const y = rowY(subject, 0);
    const tap = frame({ tapRegion: 'field', tapY: y, releaseRegion: 'field', releaseY: y });
    expect(subject.step(tap, 10)).toBe(0);
    expect(subject.step(tap, 10 + GUARD - 1)).toBe(NO_ROW);
    expect(subject.step(tap, 10 + GUARD)).toBe(0);
  });

  it('lets another row be pressed at once', () => {
    const subject = menu();
    const tap = (row: number): IntentFrame => {
      const y = rowY(subject, row);
      return frame({ tapRegion: 'field', tapY: y, releaseRegion: 'field', releaseY: y });
    };
    expect(subject.step(tap(0), 10)).toBe(0);
    expect(subject.step(tap(1), 11)).toBe(1);
  });

  it('highlights the row under the hovering mouse, without activating it', () => {
    const subject = menu();
    expect(subject.step(frame({ hovered: true, hoverY: rowY(subject, 1) }), 0)).toBe(NO_ROW);
    expect(subject.highlighted).toBe(1);
    subject.step(frame({ hovered: true, hoverY: 1 }), 1);
    expect(subject.highlighted).toBe(1);
  });

  it('reset() returns to the first row and forgets a press', () => {
    const subject = menu();
    subject.step(frame({ moveKind: 'direction', moveY: 1 }), 0);
    subject.step(frame({ tapRegion: 'field', tapY: rowY(subject, 1) }), 1);
    subject.reset(2);
    expect(subject.highlighted).toBe(0);
    expect(subject.step(frame({ releaseRegion: 'field', releaseY: rowY(subject, 1) }), 30)).toBe(
      NO_ROW,
    );
  });

  it('ignores any press within the guard after opening, not after it', () => {
    const subject = menu();
    subject.reset(100);
    const y = rowY(subject, 1);
    const tap = frame({ tapRegion: 'field', tapY: y, releaseRegion: 'field', releaseY: y });
    expect(subject.step(tap, 100 + GUARD - 1)).toBe(NO_ROW);
    expect(subject.step(tap, 100 + GUARD)).toBe(1);
  });
});

describe('Menu — layout', () => {
  it('centres the rows on the field and maps a y to its row', () => {
    const subject = menu();
    expect(subject.top).toBe((320 - 2 * MenuTuning.rowHeight) / 2);
    expect(subject.rowAt(subject.top)).toBe(0);
    expect(subject.rowAt(subject.top + MenuTuning.rowHeight)).toBe(1);
    expect(subject.rowAt(subject.top - 1)).toBe(NO_ROW);
    expect(subject.rowAt(subject.top + 2 * MenuTuning.rowHeight)).toBe(NO_ROW);
  });
});
