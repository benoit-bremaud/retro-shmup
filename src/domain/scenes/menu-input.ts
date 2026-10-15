// The input rules every menu shares (GDD v0.13 §9.1): the direction thresholds and the pointer's
// press, release and guards, for the list menus and the name entry's letter grid.
import { toSteps } from '../game/tuning';
import type { IntentFrame } from '../ports/input-port';

/** Menu timing and input thresholds (GDD v0.13 §9.1); the geometry is the presentation's. */
export const MenuTuning = {
  /** A new press on the row just activated is ignored this long (a bouncing or doubled contact). */
  rePressGuardSeconds: 0.15,
  /** A stick tilt beyond this moves the highlight; below it is a hand resting on the stick. */
  directionThreshold: 0.5,
} as const;

/** No row or cell: under no target, or no press pending. */
export const NO_ROW = -1;

const GUARD_STEPS = toSteps(MenuTuning.rePressGuardSeconds);

/** The vertical direction, or 0 when the tilt is not mostly vertical (a diagonal goes sideways). */
export function verticalOf(frame: Readonly<IntentFrame>): number {
  return Math.abs(frame.moveY) > Math.abs(frame.moveX) ? axis(frame, frame.moveY) : 0;
}

/** The horizontal direction, or 0 when the tilt is mostly vertical. */
export function sidewaysOf(frame: Readonly<IntentFrame>): number {
  return Math.abs(frame.moveY) > Math.abs(frame.moveX) ? 0 : axis(frame, frame.moveX);
}

/** −1, 0 or 1 for one axis of a keyboard or stick direction beyond the threshold. */
export function axis(frame: Readonly<IntentFrame>, value: number): number {
  if (frame.moveKind !== 'direction') return 0;
  if (value >= MenuTuning.directionThreshold) return 1;
  if (value <= -MenuTuning.directionThreshold) return -1;
  return 0;
}

/**
 * The pointer rules every menu shares (GDD v0.13 §9.1): a target activates when a press started on
 * it is released on it; a press within the guard after opening, or on the target just activated
 * within the guard, never counts. Targets are indexes (`NO_ROW` for none), time is in steps.
 */
export class PressGuard {
  /** The target the current press started on, or `NO_ROW`. */
  private pressed = NO_ROW;
  private lastActivated = NO_ROW;
  private lastActivationStep = 0;
  /** The step the menu last opened at; no press counts during the guard after it. */
  private openedAt = Number.NEGATIVE_INFINITY;

  /** Opens at step `now`: no press pending, the opening guard starts. */
  open(now: number): void {
    this.pressed = NO_ROW;
    this.openedAt = now;
  }

  /** Forgets the pending press: its release activates nothing. */
  cancel(): void {
    this.pressed = NO_ROW;
  }

  press(target: number, now: number): void {
    const justOpened = now - this.openedAt < GUARD_STEPS;
    const repeated = target === this.lastActivated && now - this.lastActivationStep < GUARD_STEPS;
    this.pressed = justOpened || repeated ? NO_ROW : target;
  }

  /** True when the release on `target` activates it. */
  release(target: number, now: number): boolean {
    const activated = target !== NO_ROW && target === this.pressed;
    this.pressed = NO_ROW;
    if (!activated) return false;
    this.lastActivated = target;
    this.lastActivationStep = now;
    return true;
  }
}
