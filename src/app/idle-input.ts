import type { BindingCapture, InputPort, IntentFrame } from '../domain/ports/input-port';

/**
 * Placeholder `InputPort` until the input brick of the vertical slice: the player cannot act
 * yet, so every frame is neutral. Replaced by the device input adapter (ADR-0009).
 */
export class IdleInput implements InputPort {
  read(into: IntentFrame): void {
    into.moveKind = 'none';
    into.moveX = 0;
    into.moveY = 0;
    into.held = 0;
    into.pressed = 0;
    into.tapRegion = 'none';
  }

  setBindings(): void {
    // No device yet: bindings arrive with the input brick.
  }

  captureNext(): BindingCapture {
    return { kind: 'cancelled' };
  }

  label(code: string): string {
    return code;
  }

  setFullscreenWanted(): void {
    // No gesture handler yet: fullscreen arrives with the input brick.
  }
}
