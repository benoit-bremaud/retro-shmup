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

/** Why codec 1 text was refused (ADR-0031 decision 7); each has its golden vectors. */
export type DecodeError = 'base64' | 'inflate' | 'length' | 'record';

/** The decoded records, or the first check that failed. */
export type DecodeResult =
  | { readonly ok: true; readonly records: Uint8Array }
  | { readonly ok: false; readonly error: DecodeError };

/**
 * Decodes codec 1 text into exactly `frames` valid records. Refusals, in order: `length` for a
 * frame count outside [1, `MAX_RECORDED_STEPS`]; `base64` for text that is not canonical base64url;
 * `inflate` for a DEFLATE stream that is broken, unfinished or followed by excess bytes; `length`
 * for one inflating to other than `frames × 5` bytes (the cap at `frames × 5 + 1` stops a bomb);
 * `record` for an invalid record. Never throws.
 */
export function decodeCodec1(text: string, frames: number): DecodeResult {
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > MAX_RECORDED_STEPS) {
    return refused('length');
  }
  if (!BASE64URL.test(text)) return refused('base64');
  const compressed = Buffer.from(text, 'base64url');
  if (compressed.toString('base64url') !== text) return refused('base64');
  const size = frames * RECORD_BYTES;
  const columns = inflateExactly(compressed, size + 1);
  if (typeof columns === 'string') return refused(columns);
  const records = new Uint8Array(size);
  if (!fromColumns(columns, frames, records)) return refused('length');
  for (let i = 0; i < frames; i += 1) {
    if (!validRecord(records, i)) return refused('record');
  }
  return { ok: true, records };
}

function refused(error: DecodeError): DecodeResult {
  return { ok: false, error };
}

/**
 * Inflates a whole raw DEFLATE stream of at most `cap` bytes: `length` past the cap, `inflate` when
 * it is broken, unfinished or followed by excess input. With `info`, Node returns the engine, whose
 * `bytesWritten` counts the input consumed (the typings omit this overload).
 */
function inflateExactly(compressed: Buffer, cap: number): Uint8Array | 'inflate' | 'length' {
  let result: unknown;
  try {
    result = inflateRawSync(compressed, { maxOutputLength: cap, info: true });
  } catch (error: unknown) {
    return Reflect.get(Object(error), 'code') === 'ERR_BUFFER_TOO_LARGE' ? 'length' : 'inflate';
  }
  // Node returns `{ buffer, engine }` with `info`; anything else is refused as broken.
  const buffer: unknown = Reflect.get(Object(result), 'buffer');
  const consumed: unknown = Reflect.get(
    Object(Reflect.get(Object(result), 'engine')),
    'bytesWritten',
  );
  return buffer instanceof Uint8Array && consumed === compressed.length ? buffer : 'inflate';
}
