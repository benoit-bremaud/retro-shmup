import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { MAX_RECORDED_STEPS, RECORD_BYTES, validRecord } from '../domain/replay/record';
import { fromColumns, toColumns } from '../domain/replay/record-columns';

/**
 * Run codec 1 under Node (ADR-0031 decisions 5–7): the record columns, raw DEFLATE, base64url
 * without padding. The browser has its own adapter on `CompressionStream`; both are tested against
 * the same golden vectors.
 */

const BASE64URL = /^[A-Za-z0-9_-]*$/;

/** Encodes `frames` records as codec 1 text. */
export function encodeCodec1(records: Uint8Array, frames: number): string {
  const columns = new Uint8Array(frames * RECORD_BYTES);
  toColumns(records, frames, columns);
  return deflateRawSync(columns).toString('base64url');
}

/**
 * Decodes codec 1 text into exactly `frames` valid records, or `undefined`: text that is not
 * canonical base64url, a DEFLATE stream that is broken, unfinished, followed by excess bytes or
 * inflating past `frames × 5` bytes, a frame count above `MAX_RECORDED_STEPS` (the cap stops a bomb), or an invalid record. Never throws.
 */
export function decodeCodec1(text: string, frames: number): Uint8Array | undefined {
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > MAX_RECORDED_STEPS) return undefined;
  if (!BASE64URL.test(text)) return undefined;
  const compressed = Buffer.from(text, 'base64url');
  if (compressed.toString('base64url') !== text) return undefined;
  const size = frames * RECORD_BYTES;
  const columns = inflateExactly(compressed, size + 1);
  if (columns === undefined) return undefined;
  const records = new Uint8Array(size);
  if (!fromColumns(columns, frames, records)) return undefined;
  for (let i = 0; i < frames; i += 1) {
    if (!validRecord(records, i)) return undefined;
  }
  return records;
}

/**
 * Inflates a whole raw DEFLATE stream of at most `cap` bytes; `undefined` when it is broken,
 * unfinished, followed by excess input or larger than `cap`. With `info`, Node returns the engine,
 * whose `bytesWritten` counts the input consumed (the typings omit this overload).
 */
function inflateExactly(compressed: Buffer, cap: number): Uint8Array | undefined {
  let result: unknown;
  try {
    result = inflateRawSync(compressed, { maxOutputLength: cap, info: true });
  } catch {
    return undefined;
  }
  // Node returns `{ buffer, engine }` with `info`; anything else is refused as broken.
  const buffer: unknown = Reflect.get(Object(result), 'buffer');
  const consumed: unknown = Reflect.get(
    Object(Reflect.get(Object(result), 'engine')),
    'bytesWritten',
  );
  return buffer instanceof Uint8Array && consumed === compressed.length ? buffer : undefined;
}
