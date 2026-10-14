import { isRecord } from '../guards';
import { REMAPPABLE_INTENTS } from '../ports/input-port';
import type { BindingSlots, Bindings, RemappableIntent } from '../ports/input-port';
import { isCapturableButton, isCapturableKey } from './capturable';
import { DEFAULT_BINDINGS } from './default-bindings';

function isKey(value: unknown): value is string {
  return typeof value === 'string' && isCapturableKey(value);
}

function isButton(value: unknown): value is number {
  return typeof value === 'number' && isCapturableButton(value);
}

/**
 * One device's slots, rebuilt from the known intents only (GDD v0.15 §4.2): every input from the
 * capturable set, a primary always present, no input bound twice; `undefined` otherwise.
 */
function parseDevice<T>(
  value: unknown,
  accepts: (input: unknown) => input is T,
): Record<RemappableIntent, BindingSlots<T>> | undefined {
  if (!isRecord(value)) return undefined;
  const parsed: Partial<Record<RemappableIntent, BindingSlots<T>>> = {};
  const seen = new Set<T>();
  for (let i = 0; i < REMAPPABLE_INTENTS.length; i += 1) {
    const intent = REMAPPABLE_INTENTS[i];
    if (intent === undefined) continue;
    const slots = value[intent];
    if (!isRecord(slots)) return undefined;
    const { primary, secondary } = slots;
    if (!accepts(primary) || seen.has(primary)) return undefined;
    seen.add(primary);
    if (secondary !== null && (!accepts(secondary) || seen.has(secondary))) return undefined;
    if (secondary !== null) seen.add(secondary);
    parsed[intent] = { primary, secondary };
  }
  return complete(parsed);
}

/** The record once every intent is in it (the loop above fills them all or returns early). */
function complete<T>(
  parsed: Partial<Record<RemappableIntent, BindingSlots<T>>>,
): Record<RemappableIntent, BindingSlots<T>> | undefined {
  const { moveUp, moveDown, moveLeft, moveRight, fire, bomb, pause } = parsed;
  if (
    moveUp === undefined ||
    moveDown === undefined ||
    moveLeft === undefined ||
    moveRight === undefined ||
    fire === undefined ||
    bomb === undefined ||
    pause === undefined
  ) {
    return undefined;
  }
  return { moveUp, moveDown, moveLeft, moveRight, fire, bomb, pause };
}

/**
 * Both devices' bindings from a save document (GDD v0.15 §4.2, ADR-0006): untrusted input, read
 * by allowlist; a device that fails any check gets its defaults back, the other kept.
 */
export function parseBindings(value: unknown): Bindings {
  const devices = isRecord(value) ? value : {};
  return {
    keyboard: parseDevice(devices.keyboard, isKey) ?? DEFAULT_BINDINGS.keyboard,
    gamepad: parseDevice(devices.gamepad, isButton) ?? DEFAULT_BINDINGS.gamepad,
  };
}
