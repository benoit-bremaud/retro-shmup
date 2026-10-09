import { Button } from '../../domain/ports/input-port';
import type { Bindings, RemappableIntent } from '../../domain/ports/input-port';

/** What the keyboard contributes to one intent frame, filled in place (ADR-0015 decision 4). */
export interface KeyboardSample {
  moving: boolean;
  moveX: number;
  moveY: number;
  held: number;
  pressed: number;
}

const BUTTON_OF: Readonly<Partial<Record<RemappableIntent, number>>> = {
  fire: Button.Fire,
  bomb: Button.Bomb,
  pause: Button.Pause,
};

/** Fixed keys, never bindings (ADR-0015 decision 6). `Esc` is not a gesture and not prevented. */
const FIXED: Readonly<Record<string, number>> = {
  Enter: Button.Confirm,
  NumpadEnter: Button.Confirm,
  Escape: Button.Pause | Button.Back,
};

function emptyCounts(): Record<RemappableIntent, number> {
  return { moveUp: 0, moveDown: 0, moveLeft: 0, moveRight: 0, fire: 0, bomb: 0, pause: 0 };
}

/**
 * The keyboard module of `DeviceInput`: physical keys (`KeyboardEvent.code`, ADR-0012), counted
 * per intent so two keys of one intent behave as one, presses latched until the next read.
 */
export class KeyboardModule {
  private intentOf = new Map<string, RemappableIntent>();
  private readonly down = new Set<string>();
  private readonly counts = emptyCounts();
  private latched = 0;

  setBindings(bindings: Bindings): void {
    this.release();
    const map = new Map<string, RemappableIntent>();
    const slots = bindings.keyboard;
    const intents = Object.keys(slots) as RemappableIntent[];
    for (let i = 0; i < intents.length; i += 1) {
      const intent = intents[i];
      if (intent === undefined) continue;
      map.set(slots[intent].primary, intent);
      const secondary = slots[intent].secondary;
      if (secondary !== null) map.set(secondary, intent);
    }
    this.intentOf = map;
  }

  /** True when the browser's default action must be prevented (bound or fixed key). */
  keyDown(code: string, repeat: boolean): boolean {
    const fixed = FIXED[code];
    const intent = this.intentOf.get(code);
    if (repeat || this.down.has(code)) return intent !== undefined || (fixed ?? 0) !== 0;
    this.down.add(code);
    if (fixed !== undefined) this.latched |= fixed;
    if (intent !== undefined) {
      this.counts[intent] += 1;
      this.latched |= BUTTON_OF[intent] ?? 0;
    }
    return intent !== undefined || (fixed !== undefined && code !== 'Escape');
  }

  keyUp(code: string): void {
    if (!this.down.delete(code)) return;
    const intent = this.intentOf.get(code);
    if (intent !== undefined) this.counts[intent] -= 1;
  }

  /** Lost focus: no key release will arrive, so every key counts as released. */
  release(): void {
    this.down.clear();
    const intents = Object.keys(this.counts) as RemappableIntent[];
    for (let i = 0; i < intents.length; i += 1) {
      const intent = intents[i];
      if (intent !== undefined) this.counts[intent] = 0;
    }
  }

  /** Fills the sample and consumes the latched presses. */
  sample(into: KeyboardSample): void {
    const c = this.counts;
    const x = (c.moveRight > 0 ? 1 : 0) - (c.moveLeft > 0 ? 1 : 0);
    const y = (c.moveDown > 0 ? 1 : 0) - (c.moveUp > 0 ? 1 : 0);
    const diagonal = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
    into.moving = c.moveRight + c.moveLeft + c.moveDown + c.moveUp > 0;
    into.moveX = x * diagonal;
    into.moveY = y * diagonal;
    into.held =
      (c.fire > 0 ? Button.Fire : 0) |
      (c.bomb > 0 ? Button.Bomb : 0) |
      (c.pause > 0 ? Button.Pause : 0);
    into.pressed = this.latched;
    this.latched = 0;
  }
}
