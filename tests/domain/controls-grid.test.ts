import { describe, expect, it } from 'vitest';
import { toSteps } from '../../src/domain/game/tuning';
import { CONTROLS_COLUMNS, MENU_ROW_HEIGHT } from '../../src/domain/presentation/menu-layout';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { ControlsGrid } from '../../src/domain/scenes/controls-grid';
import { MenuTuning } from '../../src/domain/scenes/menu';

const PAST_GUARD = toSteps(MenuTuning.rePressGuardSeconds);

function frame(edit: Partial<IntentFrame> = {}): IntentFrame {
  return Object.assign(createIntentFrame(), edit);
}

function opened(): ControlsGrid {
  const grid = new ControlsGrid();
  grid.reset(0, frame());
  return grid;
}

const rowY = (grid: ControlsGrid, row: number): number =>
  grid.menu.top + row * MENU_ROW_HEIGHT + MENU_ROW_HEIGHT / 2;

describe('ControlsGrid (GDD v0.15 §4.2)', () => {
  it('lists the seven intents, then Restore defaults and Back', () => {
    expect(opened().menu.rows).toEqual([
      'up',
      'down',
      'left',
      'right',
      'fire',
      'bomb',
      'pause',
      'restoreDefaults',
      'back',
    ]);
  });

  it('starts a capture of the highlighted cell on Confirm, the primary first', () => {
    const grid = opened();
    expect(grid.step(frame({ pressed: Button.Confirm }), 1)).toEqual({
      kind: 'capture',
      intent: 'moveUp',
      slot: 'primary',
    });
  });

  it('moves between the columns with left and right, never activating', () => {
    const grid = opened();
    expect(grid.step(frame({ moveKind: 'direction', moveX: 1 }), 1)).toBeUndefined();
    expect(grid.column).toBe(1);
    grid.step(frame(), 2);
    grid.step(frame({ moveKind: 'direction', moveX: -1 }), 3);
    expect(grid.column).toBe(0);
    grid.step(frame(), 4);
    grid.step(frame({ moveKind: 'direction', moveX: 1 }), 5);
    expect(grid.step(frame({ pressed: Button.Confirm }), 6)).toEqual({
      kind: 'capture',
      intent: 'moveUp',
      slot: 'secondary',
    });
  });

  it('starts the capture of the cell a tap lands on', () => {
    const grid = opened();
    const y = rowY(grid, 4); // fire
    const x = CONTROLS_COLUMNS.slots[1] + 10;
    const tap = frame({
      tapRegion: 'field',
      tapX: x,
      tapY: y,
      releaseRegion: 'field',
      releaseX: x,
      releaseY: y,
    });
    expect(grid.step(tap, PAST_GUARD)).toEqual({
      kind: 'capture',
      intent: 'fire',
      slot: 'secondary',
    });
    expect(grid.column).toBe(1);
  });

  it('follows the hovering mouse across the columns', () => {
    const grid = opened();
    grid.step(
      frame({ hovered: true, hoverX: CONTROLS_COLUMNS.slots[1] + 5, hoverY: rowY(grid, 2) }),
      1,
    );
    expect([grid.menu.highlighted, grid.column]).toEqual([2, 1]);
  });

  it('answers Restore defaults and Back on their rows', () => {
    const grid = opened();
    for (let i = 0; i < 7; i += 1) {
      grid.step(frame({ moveKind: 'direction', moveY: 1 }), 2 * i + 1);
      grid.step(frame(), 2 * i + 2);
    }
    expect(grid.step(frame({ pressed: Button.Confirm }), 20)).toEqual({ kind: 'restore' });
    grid.step(frame({ moveKind: 'direction', moveY: 1 }), 21);
    expect(grid.step(frame({ pressed: Button.Confirm }), 22)).toEqual({ kind: 'back' });
  });

  it('reset() comes back to the first cell, primary column', () => {
    const grid = opened();
    grid.step(frame({ moveKind: 'direction', moveX: 1 }), 1);
    grid.reset(2, frame());
    expect([grid.menu.highlighted, grid.column]).toEqual([0, 0]);
  });
});
