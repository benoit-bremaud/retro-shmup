import { MAX_RECORDED_STEPS } from '../domain/replay/record';
import { replay } from '../domain/replay/replayer';
import type { ReplayReport } from '../domain/replay/replayer';
import { decodeCodec1 } from './codec1';

/** The verifier's request (ADR-0031 decision 22): `{ seed, codec, frames, inputs }`. */

/** The largest stdin accepted: 1 MiB. */
export const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_SEED = 2 ** 32 - 1;

export const DECODE: ReplayReport = { ok: false, error: 'decode' };

/** Replays one request document; any malformed field is `decode`, never a throw. */
export function replayRequest(text: string): ReplayReport {
  let request: unknown;
  try {
    request = JSON.parse(text);
  } catch {
    return DECODE;
  }
  if (typeof request !== 'object' || request === null) return DECODE;
  const seed: unknown = Reflect.get(request, 'seed');
  const codec: unknown = Reflect.get(request, 'codec');
  const frames: unknown = Reflect.get(request, 'frames');
  const inputs: unknown = Reflect.get(request, 'inputs');
  if (!isInteger(seed, 0, MAX_SEED) || codec !== 1 || typeof inputs !== 'string') return DECODE;
  if (!isInteger(frames, 1, Number.MAX_SAFE_INTEGER)) return DECODE;
  if (frames > MAX_RECORDED_STEPS) return { ok: false, error: 'overflow' };
  const records = decodeCodec1(inputs, frames);
  if (records === undefined) return DECODE;
  return replay(seed, records, frames);
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
