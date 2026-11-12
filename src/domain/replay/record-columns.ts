import { RECORD_BYTES, readInt16, writeInt16 } from './record';

/**
 * Codec 1's byte layout before compression (ADR-0031 decision 5): the records transposed into
 * three columns — every flag byte, then every x, then every y — each coordinate stored as its
 * 16-bit difference from the previous record's (the first from 0, wrapping modulo 2¹⁶). Long runs
 * of a held direction or a slow drag become runs of zeros, which DEFLATE compresses well. Pure
 * byte functions: compression and text encoding live in the adapters.
 */

/** Transposes `frames` records into `columns`, which holds at least `frames × 5` bytes. */
export function toColumns(records: Uint8Array, frames: number, columns: Uint8Array): void {
  const xs = frames;
  const ys = frames * 3;
  let lastX = 0;
  let lastY = 0;
  for (let i = 0; i < frames; i += 1) {
    const at = i * RECORD_BYTES;
    const x = readInt16(records, at + 1);
    const y = readInt16(records, at + 3);
    columns[i] = records[at] ?? 0;
    writeInt16(columns, xs + 2 * i, x - lastX);
    writeInt16(columns, ys + 2 * i, y - lastY);
    lastX = x;
    lastY = y;
  }
}

/**
 * Undoes `toColumns` into `records`; false, writing nothing, when `columns` does not hold exactly
 * `frames × 5` bytes or `records` is too short.
 */
export function fromColumns(columns: Uint8Array, frames: number, records: Uint8Array): boolean {
  const size = frames * RECORD_BYTES;
  if (columns.length !== size || records.length < size) return false;
  const xs = frames;
  const ys = frames * 3;
  let x = 0;
  let y = 0;
  for (let i = 0; i < frames; i += 1) {
    const at = i * RECORD_BYTES;
    x = wrap16(x + readInt16(columns, xs + 2 * i));
    y = wrap16(y + readInt16(columns, ys + 2 * i));
    records[at] = columns[i] ?? 0;
    writeInt16(records, at + 1, x);
    writeInt16(records, at + 3, y);
  }
  return true;
}

/** Wraps an integer into the signed 16-bit range. */
function wrap16(value: number): number {
  const unsigned = value & 0xffff;
  return unsigned >= 0x8000 ? unsigned - 0x10000 : unsigned;
}
