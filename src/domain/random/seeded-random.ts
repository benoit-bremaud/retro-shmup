import type { Random } from '../ports/random';

/**
 * Deterministic gameplay randomness (ADR-0002): xoshiro128** by Blackman and Vigna, 32-bit integer
 * state. Seeding uses a SplitMix-style 32-bit mixer (golden-ratio Weyl step + MurmurHash3 fmix32),
 * the 32-bit analogue of the SplitMix64 seeding its authors recommend, so that any seed — 0
 * included — gives a well-mixed, never all-zero state. No allocation after construction.
 */
export class SeededRandom implements Random {
  private readonly state = new Uint32Array(4);

  constructor(seed: number) {
    this.seed(seed);
  }

  /** Seeds are reduced to an unsigned 32-bit integer (ECMAScript ToUint32): -1 and 2³² − 1 match. */
  seed(s: number): void {
    let mix = s >>> 0;
    for (let i = 0; i < 4; i += 1) {
      mix = (mix + 0x9e3779b9) >>> 0;
      let z = mix;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      this.state[i] = (z ^ (z >>> 16)) >>> 0;
    }
  }

  /** Returns a number in [0, 1). */
  next(): number {
    const s = this.state;
    const s0 = s[0] ?? 0;
    const s1 = s[1] ?? 0;
    const s2 = s[2] ?? 0;
    const s3 = s[3] ?? 0;
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    const n2 = (s2 ^ s0) >>> 0;
    const n3 = (s3 ^ s1) >>> 0;
    s[1] = (s1 ^ n2) >>> 0;
    s[0] = (s0 ^ n3) >>> 0;
    s[2] = (n2 ^ t) >>> 0;
    s[3] = rotl(n3, 11);
    return result / TWO_POW_32;
  }
}

const TWO_POW_32 = 2 ** 32;

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}
