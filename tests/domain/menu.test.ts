import { describe, expect, it } from 'vitest';
import { MENU_ROW_HEIGHT } from '../../src/domain/presentation/menu-layout';
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
function rowY(subject: { readonly top: number }, index: number): number {
  return subject.top + index * MENU_ROW_HEIGHT + MENU_ROW_HEIGHT / 2;
}

describe('Menu — keyboard and gamepad (GDD v0.13 §9.1)', () => {
  it('starts on the first row and activates the highlighted row on Confirm', () => {
    const subject = menu();
    expect(subject.highlighted).toBe(0);
    expect(subject.step(frame({ pressed: Button.Confirm }), 0)).toBe('resume');
  });

  it('moves one row per new direction, wrapping, and not while the direction is held', () => {
    const subject = menu();
    const down = frame({ moveKind: 'direction', moveY: 1 });
    expect(subject.step(down, 0)).toBeUndefined();
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

  it('activates the highlighted row on each new left or right direction (GDD v0.14)', () => {
    const subject = new Menu(ROWS, () => true);
    const right = frame({ moveKind: 'direction', moveX: 1 });
    expect(subject.step(right, 0)).toBe('resume');
    expect(subject.step(right, 1)).toBeUndefined();
    subject.step(frame(), 2);
    expect(subject.step(frame({ moveKind: 'direction', moveX: -1 }), 3)).toBe('resume');
  });

  it('flips nothing by left or right on a row without a value', () => {
    const subject = new Menu(ROWS, (row) => row === 'quit');
    expect(subject.step(frame({ moveKind: 'direction', moveX: 1 }), 0)).toBeUndefined();
    subject.step(frame(), 1);
    subject.step(frame({ moveKind: 'direction', moveY: 1 }), 2);
    subject.step(frame(), 3);
    expect(subject.step(frame({ moveKind: 'direction', moveX: -1 }), 4)).toBe('quit');
  });

  it('ignores a direction already held when the menu opens, until it is released', () => {
    const subject = new Menu(ROWS, () => true);
    const held = frame({ moveKind: 'direction', moveX: 1, moveY: 0 });
    subject.reset(0, held);
    expect(subject.step(held, 1)).toBeUndefined();
    expect(subject.step(frame({ moveKind: 'direction', moveY: 1 }), 2)).toBeUndefined();
    expect(subject.highlighted).toBe(1); // a new vertical direction still moves
    const heldDown = frame({ moveKind: 'direction', moveY: 1 });
    subject.reset(3, heldDown);
    subject.step(heldDown, 4);
    expect(subject.highlighted).toBe(0);
  });

  it('ignore() records what is held and drops a press, without moving anything', () => {
    const subject = menu();
    subject.step(frame({ tapRegion: 'field', tapY: rowY(subject, 1) }), 20);
    subject.ignore(frame({ moveKind: 'direction', moveY: 1 }));
    expect(subject.step(frame({ moveKind: 'direction', moveY: 1 }), 21)).toBeUndefined();
    expect(subject.highlighted).toBe(0);
    expect(
      subject.step(frame({ releaseRegion: 'field', releaseY: rowY(subject, 1) }), 22),
    ).toBeUndefined();
  });

  it('moves rather than flips on a diagonal that is mostly vertical', () => {
    const subject = new Menu(ROWS, () => true);
    expect(
      subject.step(frame({ moveKind: 'direction', moveX: 0.3, moveY: 0.9 }), 0),
    ).toBeUndefined();
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
    expect(subject.step(frame({ tapRegion: 'field', tapX: 120, tapY: y }), 0)).toBeUndefined();
    expect(subject.step(frame({ releaseRegion: 'field', releaseX: 120, releaseY: y }), 3)).toBe(
      'quit',
    );
    expect(subject.highlighted).toBe(1);
  });

  it('activates a press and release that arrive in the same step', () => {
    const subject = menu();
    const y = rowY(subject, 1);
    const tap = frame({ tapRegion: 'field', tapY: y, releaseRegion: 'field', releaseY: y });
    expect(subject.step(tap, 0)).toBe('quit');
  });

  it('cancels when the release is on another row or off the menu', () => {
    const subject = menu();
    subject.step(frame({ tapRegion: 'field', tapY: rowY(subject, 0) }), 0);
    expect(
      subject.step(frame({ releaseRegion: 'field', releaseY: rowY(subject, 1) }), 1),
    ).toBeUndefined();
    subject.step(frame({ tapRegion: 'field', tapY: rowY(subject, 0) }), 2);
    expect(subject.step(frame({ releaseRegion: 'field', releaseY: 2 }), 3)).toBeUndefined();
    subject.step(frame({ tapRegion: 'field', tapY: rowY(subject, 0) }), 4);
    expect(
      subject.step(frame({ releaseRegion: 'hud', releaseY: rowY(subject, 0) }), 5),
    ).toBeUndefined();
  });

  it('activates nothing on a release without a press on the menu', () => {
    const subject = menu();
    expect(
      subject.step(frame({ releaseRegion: 'field', releaseY: rowY(subject, 0) }), 0),
    ).toBeUndefined();
  });

  it('ignores a new press on the same row within the guard, not after it', () => {
    const subject = menu();
    const y = rowY(subject, 0);
    const tap = frame({ tapRegion: 'field', tapY: y, releaseRegion: 'field', releaseY: y });
    expect(subject.step(tap, 10)).toBe('resume');
    expect(subject.step(tap, 10 + GUARD - 1)).toBeUndefined();
    expect(subject.step(tap, 10 + GUARD)).toBe('resume');
  });

  it('lets another row be pressed at once', () => {
    const subject = menu();
    const tap = (row: number): IntentFrame => {
      const y = rowY(subject, row);
      return frame({ tapRegion: 'field', tapY: y, releaseRegion: 'field', releaseY: y });
    };
    expect(subject.step(tap(0), 10)).toBe('resume');
    expect(subject.step(tap(1), 11)).toBe('quit');
  });

  it('highlights the row under the hovering mouse, without activating it', () => {
    const subject = menu();
    expect(subject.step(frame({ hovered: true, hoverY: rowY(subject, 1) }), 0)).toBeUndefined();
    expect(subject.highlighted).toBe(1);
    subject.step(frame({ hovered: true, hoverY: 1 }), 1);
    expect(subject.highlighted).toBe(1);
  });

  it('reset() returns to the first row and forgets a press', () => {
    const subject = menu();
    subject.step(frame({ moveKind: 'direction', moveY: 1 }), 0);
    subject.step(frame({ tapRegion: 'field', tapY: rowY(subject, 1) }), 1);
    subject.reset(2, frame());
    expect(subject.highlighted).toBe(0);
    expect(
      subject.step(frame({ releaseRegion: 'field', releaseY: rowY(subject, 1) }), 30),
    ).toBeUndefined();
  });

  it('ignores any press within the guard after opening, not after it', () => {
    const subject = menu();
    subject.reset(100, frame());
    const y = rowY(subject, 1);
    const tap = frame({ tapRegion: 'field', tapY: y, releaseRegion: 'field', releaseY: y });
    expect(subject.step(tap, 100 + GUARD - 1)).toBeUndefined();
    expect(subject.step(tap, 100 + GUARD)).toBe('quit');
  });
});

describe('Menu — layout', () => {
  it('centres the rows on the field and maps a y to its row', () => {
    const subject = menu();
    expect(subject.top).toBe((320 - 2 * MENU_ROW_HEIGHT) / 2);
    expect(subject.rowAt(subject.top)).toBe(0);
    expect(subject.rowAt(subject.top + MENU_ROW_HEIGHT)).toBe(1);
    expect(subject.rowAt(subject.top - 1)).toBe(NO_ROW);
    expect(subject.rowAt(subject.top + 2 * MENU_ROW_HEIGHT)).toBe(NO_ROW);
  });
});
