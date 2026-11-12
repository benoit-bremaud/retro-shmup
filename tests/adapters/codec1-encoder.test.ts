import { describe, expect, it } from 'vitest';
import { encodeCodec1 } from '../../src/adapters/codec1-encoder';
import { decodeCodec1 } from '../../src/replay/codec1';

/** The golden vector of tests/replay/codec1.test.ts. */
const RECORDS = Uint8Array.from([
  0b0101, 127, 0, 0x81, 0xff, 0b1010, 0x91, 0x01, 12, 0, 0b0000, 0, 0, 0, 0,
]);
const GOLDEN = 'Y-ViqGcQYsz_1_i_m-HLfwA';

describe('browser codec 1 encoder', () => {
  it('encodes the golden records to the golden text', async () => {
    expect(await encodeCodec1(RECORDS, 3)).toBe(GOLDEN);
  });

  it('writes text the Node decoder reads back', async () => {
    const records = new Uint8Array(RECORDS.length * 200);
    for (let i = 0; i < 200; i += 1) records.set(RECORDS, i * RECORDS.length);
    const text = await encodeCodec1(records, 600);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCodec1(text, 600)).toEqual({ ok: true, records });
  });
});
