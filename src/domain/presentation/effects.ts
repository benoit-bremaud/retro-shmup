import type { RenderPort } from '../ports/render-port';
import { Palette } from './palette';

/** Wall-clock durations of the game-feel effects (GDD v0.6 §5.2.1, §9.4; ADR-0010). */
export const EffectTuning = {
  hitFlashMs: 33,
  explosionMs: 300,
  /** At most this many explosions at once; the oldest is recycled first. */
  maxExplosions: 16,
} as const;

const FLASH_SLOTS = 16;
// Explosion square size per size tier (small, medium), at its largest.
const TIER_SIZE = [16, 32] as const;

/**
 * White flashes of hit enemies, keyed by serial (never by pool slot), in a fixed ring: recording
 * and lookup allocate nothing. Effects are drawn first, then aged by the frame's wall time.
 */
export class HitFlashes {
  private readonly serials = new Int32Array(FLASH_SLOTS);
  private readonly msLeft = new Float32Array(FLASH_SLOTS);
  private next = 0;

  record(serial: number): void {
    this.serials[this.next] = serial;
    this.msLeft[this.next] = EffectTuning.hitFlashMs;
    this.next = (this.next + 1) % FLASH_SLOTS;
  }

  isFlashing(serial: number): boolean {
    for (let i = 0; i < FLASH_SLOTS; i += 1) {
      if (this.serials[i] === serial && (this.msLeft[i] ?? 0) > 0) return true;
    }
    return false;
  }

  advance(ms: number): void {
    for (let i = 0; i < FLASH_SLOTS; i += 1) this.msLeft[i] = (this.msLeft[i] ?? 0) - ms;
  }
}

/**
 * Small explosions at destroyed enemies (GDD §9.4), sized by tier, in a ring of 16: every one lasts
 * the same time, so the next slot is always the oldest. Positions are copied out of the event.
 */
export class Explosions {
  private readonly x = new Float32Array(EffectTuning.maxExplosions);
  private readonly y = new Float32Array(EffectTuning.maxExplosions);
  private readonly ageMs = new Float32Array(EffectTuning.maxExplosions).fill(
    EffectTuning.explosionMs,
  );
  private readonly tier = new Uint8Array(EffectTuning.maxExplosions);
  private next = 0;

  record(x: number, y: number, tier: number): void {
    this.x[this.next] = x;
    this.y[this.next] = y;
    this.ageMs[this.next] = 0;
    this.tier[this.next] = tier;
    this.next = (this.next + 1) % EffectTuning.maxExplosions;
  }

  get active(): number {
    let count = 0;
    for (let i = 0; i < EffectTuning.maxExplosions; i += 1) {
      if ((this.ageMs[i] ?? EffectTuning.explosionMs) < EffectTuning.explosionMs) count += 1;
    }
    return count;
  }

  /** A square growing to its tier size: hot for the first third, then cool. */
  draw(render: RenderPort): void {
    for (let i = 0; i < EffectTuning.maxExplosions; i += 1) {
      const age = this.ageMs[i] ?? EffectTuning.explosionMs;
      if (age >= EffectTuning.explosionMs) continue;
      const progress = age / EffectTuning.explosionMs;
      const size = (TIER_SIZE[this.tier[i] ?? 0] ?? TIER_SIZE[0]) * (0.5 + 0.5 * progress);
      const colour = progress < 1 / 3 ? Palette.explosionHot : Palette.explosionCool;
      render.drawRect((this.x[i] ?? 0) - size / 2, (this.y[i] ?? 0) - size / 2, size, size, colour);
    }
  }

  advance(ms: number): void {
    for (let i = 0; i < EffectTuning.maxExplosions; i += 1) {
      this.ageMs[i] = (this.ageMs[i] ?? 0) + ms;
    }
  }
}
