import type { Device, IntentFrame, MoveKind } from '../../domain/ports/input-port';
import { Button } from '../../domain/ports/input-port';

/**
 * What one device contributes to an intent frame, filled in place by its module (ADR-0015
 * decision 4). Sequence numbers come from the façade, one per input event; an event that starts a
 * movement records the same number as its start, so starts compare across devices without
 * timestamps (ADR-0018 decision 9). 0 means never.
 */
export interface DeviceSample {
  moving: boolean;
  moveKind: Exclude<MoveKind, 'none'>;
  moveX: number;
  moveY: number;
  held: number;
  pressed: number;
  /** Sequence number of the last movement start. */
  startSeq: number;
  /** Sequence number of the last input of any kind. */
  inputSeq: number;
  /**
   * Its `Fire` is the always-on autofire of touch and mouse (ADR-0009); that `Fire` lives in
   * `held` only, never in `pressed`, so the arbitration can mask it.
   */
  autofire: boolean;
}

export interface DeviceSamples {
  readonly keyboard: DeviceSample;
  readonly touch: DeviceSample;
  readonly mouse: DeviceSample;
  readonly gamepad: DeviceSample;
}

/** The façade's arbitration state: the sequence number of the last lost focus. */
export interface Arbitration {
  clearedAt: number;
}

export function createSample(): DeviceSample {
  return {
    moving: false,
    moveKind: 'direction',
    moveX: 0,
    moveY: 0,
    held: 0,
    pressed: 0,
    startSeq: 0,
    inputSeq: 0,
    autofire: false,
  };
}

export function createArbitration(): Arbitration {
  return { clearedAt: 0 };
}

const DEVICES = ['keyboard', 'touch', 'mouse', 'gamepad'] as const;

/** The device with the highest sequence number of the given kind, or `undefined` if all are 0. */
function latest(
  samples: DeviceSamples,
  of: (sample: DeviceSample) => number,
  after: number,
): Device | undefined {
  let best: Device | undefined;
  let bestSeq = after;
  for (let i = 0; i < DEVICES.length; i += 1) {
    const device = DEVICES[i];
    if (device === undefined) continue;
    const seq = of(samples[device]);
    if (seq > bestSeq) {
      best = device;
      bestSeq = seq;
    }
  }
  return best;
}

const startOf = (sample: DeviceSample): number => sample.startSeq;
const inputOf = (sample: DeviceSample): number => sample.inputSeq;

/**
 * Combines the device samples into one intent frame (ADR-0015 decision 5, ADR-0018 decision 9):
 * the movement belongs to the device that last started moving, until another starts or a lost
 * focus clears it; buttons combine, except the autofire of touch and mouse, which applies only
 * while one of them owns the movement; `device` is the last device with any input. Browser-free
 * and allocation-free; writes only `into`.
 */
export function arbitrate(
  state: Readonly<Arbitration>,
  samples: DeviceSamples,
  into: IntentFrame,
): void {
  const owner = latest(samples, startOf, state.clearedAt);
  const moving = owner === undefined ? undefined : samples[owner];
  if (moving?.moving === true) {
    into.moveKind = moving.moveKind;
    into.moveX = moving.moveX;
    into.moveY = moving.moveY;
  } else {
    into.moveKind = 'none';
    into.moveX = 0;
    into.moveY = 0;
  }
  const pointerOwns = owner === 'touch' || owner === 'mouse';
  let held = 0;
  let pressed = 0;
  for (let i = 0; i < DEVICES.length; i += 1) {
    const device = DEVICES[i];
    if (device === undefined) continue;
    const sample = samples[device];
    held |= sample.autofire && !pointerOwns ? sample.held & ~Button.Fire : sample.held;
    pressed |= sample.pressed;
  }
  into.held = held;
  into.pressed = pressed;
  into.device = latest(samples, inputOf, 0) ?? into.device;
}
