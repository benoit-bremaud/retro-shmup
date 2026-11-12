import { Button } from '../ports/input-port';
import type { IntentFrame, MoveKind } from '../ports/input-port';

/**
 * The recorded form of one simulation step (ADR-0031 decisions 2–3): what `Run.step` reads of an
 * `IntentFrame`, quantised so that the record and the simulation's input are the same thing.
 */

/** Bytes per record: flags, then x and y as signed 16-bit little-endian integers. */
export const RECORD_BYTES = 5;
/** The longest sendable run: 20 minutes at 60 steps a second (the leaderboard's `maxFrames`). */
export const MAX_RECORDED_STEPS = 72_000;

/** A direction is stored in 1/127 steps of [-1, 1]. */
const DIRECTION_SCALE = 127;
/** A target is stored in quarter pixels, within a signed 12-bit range. */
const TARGET_SCALE = 4;
const TARGET_MIN = -2048;
const TARGET_MAX = 2047;

const FIRE_BIT = 1;
const BOMB_BIT = 2;
const KIND_SHIFT = 2;
const KIND_MASK = 3;
const RESERVED_BITS = 0xf0;

const KINDS: readonly MoveKind[] = ['none', 'direction', 'target'];

/**
 * Rounds `value × scale` to an integer in [min, max]; a non-finite value counts as 0, and `+ 0`
 * turns -0 into 0 so the simulation reads the very value the record gives back.
 */
function toStored(value: number, scale: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, Math.round(value * scale))) + 0;
}

/** The stored x or y of a quantised frame's coordinate. */
function storedCoordinate(kind: MoveKind, value: number): number {
  if (kind === 'direction') {
    return toStored(value, DIRECTION_SCALE, -DIRECTION_SCALE, DIRECTION_SCALE);
  }
  if (kind === 'target') return toStored(value, TARGET_SCALE, TARGET_MIN, TARGET_MAX);
  return 0;
}

/** The value the simulation reads for a stored coordinate. */
function readCoordinate(kind: MoveKind, stored: number): number {
  if (kind === 'direction') return stored / DIRECTION_SCALE;
  if (kind === 'target') return stored / TARGET_SCALE;
  return 0;
}

/**
 * Fills `out` with exactly what the simulation may read of `frame`: Fire held, Bomb pressed, the
 * move kind and its coordinates on the record's grid. The other fields of `out` are left alone.
 */
export function quantizeIntent(frame: Readonly<IntentFrame>, out: IntentFrame): void {
  out.held = frame.held & Button.Fire;
  out.pressed = frame.pressed & Button.Bomb;
  out.moveKind = frame.moveKind;
  out.moveX = readCoordinate(frame.moveKind, storedCoordinate(frame.moveKind, frame.moveX));
  out.moveY = readCoordinate(frame.moveKind, storedCoordinate(frame.moveKind, frame.moveY));
}

/** Writes the quantised `frame` as record `index` of `records`. */
export function writeRecord(
  records: Uint8Array,
  index: number,
  frame: Readonly<IntentFrame>,
): void {
  const at = index * RECORD_BYTES;
  const kind = KINDS.indexOf(frame.moveKind);
  records[at] =
    ((frame.held & Button.Fire) !== 0 ? FIRE_BIT : 0) |
    ((frame.pressed & Button.Bomb) !== 0 ? BOMB_BIT : 0) |
    (kind << KIND_SHIFT);
  writeInt16(records, at + 1, storedCoordinate(frame.moveKind, frame.moveX));
  writeInt16(records, at + 3, storedCoordinate(frame.moveKind, frame.moveY));
}

/**
 * Whether record `index` maps to exactly one simulation input: no reserved bit, a known kind, no
 * coordinate on `none`, coordinates within their kind's range (decision 3).
 */
export function validRecord(records: Uint8Array, index: number): boolean {
  const at = index * RECORD_BYTES;
  const flags = records[at] ?? 0;
  if ((flags & RESERVED_BITS) !== 0) return false;
  const kind = (flags >> KIND_SHIFT) & KIND_MASK;
  const x = readInt16(records, at + 1);
  const y = readInt16(records, at + 3);
  if (kind === 0) return x === 0 && y === 0;
  if (kind === 1)
    return (
      inRange(x, -DIRECTION_SCALE, DIRECTION_SCALE) && inRange(y, -DIRECTION_SCALE, DIRECTION_SCALE)
    );
  if (kind === 2) return inRange(x, TARGET_MIN, TARGET_MAX) && inRange(y, TARGET_MIN, TARGET_MAX);
  return false;
}

/** Fills `out` with the simulation input of a valid record `index`. */
export function readRecord(records: Uint8Array, index: number, out: IntentFrame): void {
  const at = index * RECORD_BYTES;
  const flags = records[at] ?? 0;
  const kind = KINDS[(flags >> KIND_SHIFT) & KIND_MASK] ?? 'none';
  out.held = (flags & FIRE_BIT) !== 0 ? Button.Fire : 0;
  out.pressed = (flags & BOMB_BIT) !== 0 ? Button.Bomb : 0;
  out.moveKind = kind;
  out.moveX = readCoordinate(kind, readInt16(records, at + 1));
  out.moveY = readCoordinate(kind, readInt16(records, at + 3));
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/** Writes a signed 16-bit integer, little-endian. */
export function writeInt16(bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = value & 0xff;
  bytes[at + 1] = (value >> 8) & 0xff;
}

/** Reads a signed 16-bit integer, little-endian. */
export function readInt16(bytes: Uint8Array, at: number): number {
  const unsigned = (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
  return unsigned >= 0x8000 ? unsigned - 0x10000 : unsigned;
}
