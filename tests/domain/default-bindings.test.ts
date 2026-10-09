import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';

describe('DEFAULT_BINDINGS (ADR-0015 decision 9, ADR-0012)', () => {
  it('binds move to the arrows, then WASD, on the keyboard', () => {
    const k = DEFAULT_BINDINGS.keyboard;
    expect([k.moveUp, k.moveDown, k.moveLeft, k.moveRight]).toEqual([
      { primary: 'ArrowUp', secondary: 'KeyW' },
      { primary: 'ArrowDown', secondary: 'KeyS' },
      { primary: 'ArrowLeft', secondary: 'KeyA' },
      { primary: 'ArrowRight', secondary: 'KeyD' },
    ]);
  });

  it('binds fire, bomb and pause on the keyboard', () => {
    const k = DEFAULT_BINDINGS.keyboard;
    expect(k.fire).toEqual({ primary: 'Space', secondary: 'KeyZ' });
    expect(k.bomb).toEqual({ primary: 'KeyX', secondary: 'ShiftLeft' });
    expect(k.pause).toEqual({ primary: 'KeyP', secondary: null });
  });

  it('binds move to the d-pad and A, B, Start on the gamepad standard mapping', () => {
    const g = DEFAULT_BINDINGS.gamepad;
    expect([g.moveUp, g.moveDown, g.moveLeft, g.moveRight].map((slot) => slot.primary)).toEqual([
      12, 13, 14, 15,
    ]);
    expect([g.fire.primary, g.bomb.primary, g.pause.primary]).toEqual([0, 1, 9]);
  });

  it('uses each keyboard key once, so no key is bound twice', () => {
    const codes = Object.values(DEFAULT_BINDINGS.keyboard)
      .flatMap((slot) => [slot.primary, slot.secondary])
      .filter((code) => code !== null);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
