import { describe, expect, it } from 'vitest';
import { Button, createIntentFrame } from '../../../src/domain/ports/input-port';
import type { IntentFrame } from '../../../src/domain/ports/input-port';
import {
  RECORD_BYTES,
  quantizeIntent,
  readRecord,
  validRecord,
  writeRecord,
} from '../../../src/domain/replay/record';
import { fromColumns, toColumns } from '../../../src/domain/replay/record-columns';

function frame(fields: Partial<IntentFrame>): IntentFrame {
  return Object.assign(createIntentFrame(), fields);
}

function roundTrip(input: IntentFrame): IntentFrame {
  const bytes = new Uint8Array(RECORD_BYTES);
  writeRecord(bytes, 0, input);
  const out = createIntentFrame();
  readRecord(bytes, 0, out);
  return out;
}

describe('quantizeIntent', () => {
  it('keeps only Fire held and Bomb pressed', () => {
    const out = createIntentFrame();
    quantizeIntent(
      frame({ held: Button.Fire | Button.Pause, pressed: Button.Bomb | Button.Confirm }),
      out,
    );
    expect(out.held).toBe(Button.Fire);
    expect(out.pressed).toBe(Button.Bomb);
  });

  it('snaps a direction to 1/127 steps and clamps it to [-1, 1]', () => {
    const out = createIntentFrame();
    quantizeIntent(frame({ moveKind: 'direction', moveX: 0.5, moveY: -3 }), out);
    expect(out.moveX).toBe(64 / 127);
    expect(out.moveY).toBe(-1);
  });

  it('snaps a target to quarter pixels and clamps it to [-512, 511.75]', () => {
    const out = createIntentFrame();
    quantizeIntent(frame({ moveKind: 'target', moveX: 120.3, moveY: 9000 }), out);
    expect(out.moveX).toBe(120.25);
    expect(out.moveY).toBe(511.75);
    quantizeIntent(frame({ moveKind: 'target', moveX: -9000, moveY: Number.NaN }), out);
    expect(out.moveX).toBe(-512);
    expect(out.moveY).toBe(0);
  });

  it('zeroes the coordinates of a frame without movement', () => {
    const out = createIntentFrame();
    quantizeIntent(frame({ moveKind: 'none', moveX: 4, moveY: 5 }), out);
    expect(out).toMatchObject({ moveKind: 'none', moveX: 0, moveY: 0 });
  });

  it('is what the record stores: write then read gives the quantised frame', () => {
    const inputs = [
      frame({ held: Button.Fire, moveKind: 'direction', moveX: 0.707, moveY: -0.707 }),
      frame({ pressed: Button.Bomb, moveKind: 'target', moveX: 37.13, moveY: 300.9 }),
      frame({ held: Button.Back }),
    ];
    for (const input of inputs) {
      const quantised = createIntentFrame();
      quantizeIntent(input, quantised);
      expect(roundTrip(input)).toEqual(quantised);
    }
  });
});

describe('validRecord', () => {
  function record(bytes: readonly number[]): Uint8Array {
    return Uint8Array.from(bytes);
  }

  it('accepts what writeRecord writes', () => {
    const bytes = new Uint8Array(RECORD_BYTES);
    writeRecord(
      bytes,
      0,
      frame({ held: Button.Fire, moveKind: 'target', moveX: -512, moveY: 511.75 }),
    );
    expect(validRecord(bytes, 0)).toBe(true);
  });

  it('refuses a reserved bit, the unknown kind 3 and a coordinate on none', () => {
    expect(validRecord(record([0x10, 0, 0, 0, 0]), 0)).toBe(false);
    expect(validRecord(record([3 << 2, 0, 0, 0, 0]), 0)).toBe(false);
    expect(validRecord(record([0, 1, 0, 0, 0]), 0)).toBe(false);
  });

  it('refuses a direction beyond ±127 and a target beyond the 12-bit range', () => {
    expect(validRecord(record([1 << 2, 127, 0, 0x81, 0xff]), 0)).toBe(true);
    expect(validRecord(record([1 << 2, 128, 0, 0, 0]), 0)).toBe(false);
    expect(validRecord(record([2 << 2, 0xff, 0x07, 0x00, 0xf8]), 0)).toBe(true);
    expect(validRecord(record([2 << 2, 0x00, 0x08, 0, 0]), 0)).toBe(false);
  });

  it('reads past the end as zero bytes, a valid empty record', () => {
    expect(validRecord(new Uint8Array(0), 0)).toBe(true);
  });
});

describe('record columns', () => {
  it('lays out flags, then x deltas, then y deltas', () => {
    const records = new Uint8Array(2 * RECORD_BYTES);
    writeRecord(records, 0, frame({ held: Button.Fire, moveKind: 'target', moveX: 1, moveY: 2 }));
    writeRecord(records, 1, frame({ moveKind: 'target', moveX: 1, moveY: 1 }));
    const columns = new Uint8Array(2 * RECORD_BYTES);
    toColumns(records, 2, columns);
    expect([...columns]).toEqual([0b1001, 0b1000, 4, 0, 0, 0, 8, 0, 0xfc, 0xff]);
  });

  it('round-trips, wrapping the deltas across the 16-bit range', () => {
    const records = new Uint8Array(3 * RECORD_BYTES);
    writeRecord(records, 0, frame({ moveKind: 'target', moveX: -512, moveY: 511.75 }));
    writeRecord(records, 1, frame({ moveKind: 'target', moveX: 511.75, moveY: -512 }));
    writeRecord(records, 2, frame({ moveKind: 'direction', moveX: -1, moveY: 1 }));
    const columns = new Uint8Array(records.length);
    toColumns(records, 3, columns);
    const back = new Uint8Array(records.length);
    expect(fromColumns(columns, 3, back)).toBe(true);
    expect(back).toEqual(records);
  });

  it('refuses columns of the wrong size or a short output', () => {
    expect(fromColumns(new Uint8Array(9), 2, new Uint8Array(10))).toBe(false);
    expect(fromColumns(new Uint8Array(10), 2, new Uint8Array(9))).toBe(false);
  });
});
