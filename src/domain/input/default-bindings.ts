import type { Bindings } from '../ports/input-port';

/**
 * Default bindings (ADR-0015 decision 9, in the shapes of ADR-0012). The composition root pushes
 * them through `InputPort.setBindings` at boot; the save document and "restore defaults" reuse
 * them. `Enter`, `NumpadEnter` and `Esc` are fixed keys, never bindings (ADR-0015 decision 6).
 */
export const DEFAULT_BINDINGS: Bindings = {
  keyboard: {
    moveUp: { primary: 'ArrowUp', secondary: 'KeyW' },
    moveDown: { primary: 'ArrowDown', secondary: 'KeyS' },
    moveLeft: { primary: 'ArrowLeft', secondary: 'KeyA' },
    moveRight: { primary: 'ArrowRight', secondary: 'KeyD' },
    fire: { primary: 'Space', secondary: 'KeyZ' },
    bomb: { primary: 'KeyX', secondary: 'ShiftLeft' },
    pause: { primary: 'KeyP', secondary: null },
  },
  gamepad: {
    moveUp: { primary: 12, secondary: null },
    moveDown: { primary: 13, secondary: null },
    moveLeft: { primary: 14, secondary: null },
    moveRight: { primary: 15, secondary: null },
    fire: { primary: 0, secondary: null },
    bomb: { primary: 1, secondary: null },
    pause: { primary: 9, secondary: null },
  },
};
