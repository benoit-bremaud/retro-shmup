import { InputTuning } from '../../domain/input/input-tuning';
import { Button } from '../../domain/ports/input-port';
import type { Bindings, BindingSlots } from '../../domain/ports/input-port';
import type { DeviceSample } from './arbitration';

/** The part of a `GamepadButton` the adapter reads. */
export interface GamepadButtonLike {
  readonly pressed: boolean;
}

/** The part of a `Gamepad` the adapter reads. */
export interface GamepadLike {
  readonly connected: boolean;
  /** Only `standard` pads are read (ADR-0015 decision 7). */
  readonly mapping: string;
  readonly buttons: readonly GamepadButtonLike[];
  /** The left stick is axes 0 (x, right positive) and 1 (y, down positive). */
  readonly axes: readonly number[];
}

/** What `navigator.getGamepads()` returns: one slot per pad index, `null` when empty. */
export type GamepadList = readonly (GamepadLike | null)[];

/** Pad slots read; browsers expose four. */
const SLOTS = 4;
/** Button indices that fit a 31-bit mask; the standard mapping uses 0 to 16. */
const MAX_BUTTONS = 31;

function bit(index: number): number {
  return index >= 0 && index < MAX_BUTTONS ? 1 << index : 0;
}

function maskOf(slots: BindingSlots<number>): number {
  return bit(slots.primary) | (slots.secondary === null ? 0 : bit(slots.secondary));
}

// Fixed roles on indices, whatever the bindings, in every scene (ADR-0018 decision 3): A (0) is
// Confirm, B (1) is Back, Start (9) is also Confirm.
const CONFIRM_MASK = bit(0) | bit(9);
const BACK_MASK = bit(1);

/** `value` when `mask` has any of `bits`, else 0. */
function when(mask: number, bits: number, value: number): number {
  return (mask & bits) === 0 ? 0 : value;
}

/** Quantizes toward zero, so a stick length never exceeds 1 (ADR-0018 decision 5); never -0. */
function quantize(value: number): number {
  return Math.trunc(value * InputTuning.stickSteps) / InputTuning.stickSteps || 0;
}

/**
 * The gamepad module of `DeviceInput` (ADR-0015 decision 7, ADR-0018 decisions 3, 5 and 9): polled
 * once per read, presses found by comparing with the previous poll, kept per pad as a button
 * mask. The active pad is the last one with input; losing it reports a pause. The d-pad wins over
 * the left stick, which goes through a radial dead zone, a rescale, a clamp to length 1 and a
 * quantization toward zero. Allocates nothing.
 */
export class GamepadModule {
  private readonly previous: number[] = [0, 0, 0, 0];
  private readonly stickWasOut: boolean[] = [false, false, false, false];
  private readonly pressedOf: number[] = [0, 0, 0, 0];
  /** Each pad's stick from its last poll, already through the dead zone and quantized. */
  private readonly stickX: number[] = [0, 0, 0, 0];
  private readonly stickY: number[] = [0, 0, 0, 0];
  private active = -1;

  private fireMask = 0;
  private bombMask = 0;
  private pauseMask = 0;
  private upMask = 0;
  private downMask = 0;
  private leftMask = 0;
  private rightMask = 0;

  private startSeq = 0;
  private inputSeq = 0;

  /** Bindings hold standard-mapping indices (ADR-0012); the fixed roles never move. */
  setBindings(bindings: Bindings): void {
    const pad = bindings.gamepad;
    this.fireMask = maskOf(pad.fire);
    this.bombMask = maskOf(pad.bomb);
    this.pauseMask = maskOf(pad.pause);
    this.upMask = maskOf(pad.moveUp);
    this.downMask = maskOf(pad.moveDown);
    this.leftMask = maskOf(pad.moveLeft);
    this.rightMask = maskOf(pad.moveRight);
  }

  /**
   * Reads the pads. `seq` is the façade's sequence number for this poll, recorded when a pad
   * starts a movement or gives any input (ADR-0018 decision 9). Returns true when the active pad
   * was lost: missing, disconnected or no longer `standard` (ADR-0009, automatic pause).
   */
  poll(pads: GamepadList, seq: number): boolean {
    let lost = false;
    for (let slot = 0; slot < SLOTS; slot += 1) {
      const pad = pads[slot] ?? null;
      if (pad === null || !pad.connected || pad.mapping !== 'standard') {
        if (slot === this.active) {
          this.active = -1;
          lost = true;
        }
        this.previous[slot] = 0;
        this.stickWasOut[slot] = false;
        this.pressedOf[slot] = 0;
        this.stickX[slot] = 0;
        this.stickY[slot] = 0;
        continue;
      }
      this.pollPad(pad, slot, seq);
    }
    return lost;
  }

  /** Fills the sample from the active pad; nothing moves or holds without one. */
  sample(into: DeviceSample): void {
    into.moveKind = 'direction';
    into.autofire = false;
    into.startSeq = this.startSeq;
    into.inputSeq = this.inputSeq;
    const slot = this.active;
    if (slot < 0) {
      into.moving = false;
      into.moveX = 0;
      into.moveY = 0;
      into.held = 0;
      into.pressed = 0;
      return;
    }
    const mask = this.previous[slot] ?? 0;
    const pressed = this.pressedOf[slot] ?? 0;
    this.pressedOf[slot] = 0;
    const x = when(mask, this.rightMask, 1) - when(mask, this.leftMask, 1);
    const y = when(mask, this.downMask, 1) - when(mask, this.upMask, 1);
    if (x !== 0 || y !== 0) {
      // The d-pad wins when it gives a direction, normalized so a diagonal is never faster than
      // the maximum speed; opposite directions cancel to none, and the stick applies.
      const diagonal = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
      into.moving = true;
      into.moveX = x * diagonal;
      into.moveY = y * diagonal;
    } else {
      into.moving = this.stickWasOut[slot] === true;
      into.moveX = this.stickX[slot] ?? 0;
      into.moveY = this.stickY[slot] ?? 0;
    }
    into.held = this.buttonsOf(mask);
    into.pressed =
      this.buttonsOf(pressed) |
      when(pressed, CONFIRM_MASK, Button.Confirm) |
      when(pressed, BACK_MASK, Button.Back);
  }

  private pollPad(pad: GamepadLike, slot: number, seq: number): void {
    let mask = 0;
    const count = Math.min(pad.buttons.length, MAX_BUTTONS);
    for (let i = 0; i < count; i += 1) {
      if (pad.buttons[i]?.pressed === true) mask |= 1 << i;
    }
    const pressedNow = mask & ~(this.previous[slot] ?? 0);
    this.previous[slot] = mask;
    // Overwritten each poll: a press of a pad that is not active is dropped, never delivered late.
    this.pressedOf[slot] = pressedNow;
    this.readStick(pad, slot);
    const stickOut = this.stickX[slot] !== 0 || this.stickY[slot] !== 0;
    const stickStart = stickOut && this.stickWasOut[slot] !== true;
    this.stickWasOut[slot] = stickOut;
    const moveMask = this.upMask | this.downMask | this.leftMask | this.rightMask;
    if ((pressedNow & moveMask) !== 0 || stickStart) this.startSeq = seq;
    if (pressedNow !== 0 || stickStart) {
      this.active = slot;
      this.inputSeq = seq;
    }
  }

  /** The left stick after the radial dead zone, the rescale, the clamp and the quantization. */
  private readStick(pad: GamepadLike, slot: number): void {
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const length = Math.hypot(ax, ay);
    const dead = InputTuning.stickDeadZone;
    if (length <= dead) {
      this.stickX[slot] = 0;
      this.stickY[slot] = 0;
      return;
    }
    const scale = Math.min((length - dead) / (1 - dead), 1) / length;
    this.stickX[slot] = quantize(ax * scale);
    this.stickY[slot] = quantize(ay * scale);
  }

  private buttonsOf(mask: number): number {
    return (
      when(mask, this.fireMask, Button.Fire) |
      when(mask, this.bombMask, Button.Bomb) |
      when(mask, this.pauseMask, Button.Pause)
    );
  }
}
