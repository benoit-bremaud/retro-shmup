import type { Box, Vec2 } from './geometry';
import { PickupTuning } from './tuning';

/** What falls for the player to catch (GDD v0.8 §4.6); numeric, so an event's `detail` holds it. */
export const PickupKind = {
  PRed: 0,
  PBlue: 1,
  Shield: 2,
  Bomb: 3,
  OneUp: 4,
} as const;
export type PickupKind = (typeof PickupKind)[keyof typeof PickupKind];

/** A pooled pickup (class diagram: «pooled»): its motion is a closed form of its age. */
export class Pickup implements Box {
  kind: PickupKind = PickupKind.PRed;
  serial = 0;
  /** The sway axis x, already clamped, and the spawn y. */
  readonly origin: Vec2 = { x: 0, y: 0 };
  readonly position: Vec2 = { x: 0, y: 0 };
  readonly previousPosition: Vec2 = { x: 0, y: 0 };
  readonly width = PickupTuning.size;
  readonly height = PickupTuning.size;
  /** Steps since the spawn. */
  age = 0;
  spent = false;

  /** Resets every field in one place, so a recycled pickup never inherits its predecessor's. */
  spawn(kind: PickupKind, x: number, y: number, serial: number): void {
    this.kind = kind;
    this.serial = serial;
    this.origin.x = Math.min(Math.max(x, PickupTuning.minAxisX), PickupTuning.maxAxisX);
    this.origin.y = y;
    this.position.x = this.origin.x;
    this.position.y = y;
    this.previousPosition.x = this.origin.x;
    this.previousPosition.y = y;
    this.age = 0;
    this.spent = false;
  }
}
