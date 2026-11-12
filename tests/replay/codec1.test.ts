import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeCodec1, encodeCodec1 } from '../../src/replay/codec1';
import type { DecodeError } from '../../src/replay/codec1';

/** Golden vector: fire + direction (1, -1), then bomb + target (100.25, 3), then nothing. */
const RECORDS = Uint8Array.from([
  0b0101, 127, 0, 0x81, 0xff, 0b1010, 0x91, 0x01, 12, 0, 0b0000, 0, 0, 0, 0,
]);
// Cross-checked with Python's zlib on the hand-built columns (flags 5 10 0, x +127 +274 -401,
// y -127 +139 -12).
const GOLDEN = 'Y-ViqGcQYsz_1_i_m-HLfwA';

function refused(error: DecodeError): { ok: false; error: DecodeError } {
  return { ok: false, error };
}

function encodeColumns(columns: readonly number[]): string {
  return deflateRawSync(Uint8Array.from(columns)).toString('base64url');
}

describe('codec 1', () => {
  it('encodes the golden records to the golden text', () => {
    expect(encodeCodec1(RECORDS, 3)).toBe(GOLDEN);
  });

  it('decodes the golden text back to the records', () => {
    expect(decodeCodec1(GOLDEN, 3)).toEqual({ ok: true, records: RECORDS });
  });

  it('refuses text that is not canonical base64url', () => {
    expect(decodeCodec1(`${GOLDEN}=`, 3)).toEqual(refused('base64'));
    expect(decodeCodec1(GOLDEN.replace('-', '+'), 3)).toEqual(refused('base64'));
    expect(decodeCodec1(`${GOLDEN.slice(0, -1)}B`, 3)).toEqual(refused('base64'));
  });

  it('refuses a frame count that does not match the data', () => {
    expect(decodeCodec1(GOLDEN, 2)).toEqual(refused('length'));
    expect(decodeCodec1(GOLDEN, 4)).toEqual(refused('length'));
    expect(decodeCodec1(GOLDEN, 0)).toEqual(refused('length'));
    expect(decodeCodec1(GOLDEN, 1.5)).toEqual(refused('length'));
    expect(decodeCodec1(GOLDEN, 72_001)).toEqual(refused('length'));
  });

  it('refuses a truncated stream and bytes after its end', () => {
    const bytes = Buffer.from(GOLDEN, 'base64url');
    expect(decodeCodec1(bytes.subarray(0, -2).toString('base64url'), 3)).toEqual(
      refused('inflate'),
    );
    expect(decodeCodec1(Buffer.concat([bytes, Buffer.of(0)]).toString('base64url'), 3)).toEqual(
      refused('inflate'),
    );
    expect(decodeCodec1('', 3)).toEqual(refused('inflate'));
  });

  it('stops a decompression bomb at the cap', () => {
    const bomb = deflateRawSync(new Uint8Array(10_000_000)).toString('base64url');
    expect(decodeCodec1(bomb, 1)).toEqual(refused('length'));
  });

  it('refuses a reserved bit and a non-canonical record', () => {
    expect(decodeCodec1(encodeColumns([0x10, 0, 0, 0, 0]), 1)).toEqual(refused('record'));
    expect(decodeCodec1(encodeColumns([0, 1, 0, 0, 0]), 1)).toEqual(refused('record'));
    expect(decodeCodec1(encodeColumns([0b0100, 128, 0, 0, 0]), 1)).toEqual(refused('record'));
  });
});
