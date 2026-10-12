import type { RenderPort } from '../ports/render-port';
import { Palette } from './palette';

/** Wall-clock durations of the game-feel effects (GDD v0.6 §5.2.1, §9.4; ADR-0010). */
export const EffectTuning = {
  hitFlashMs: 33,
  explosionMs: 300,
  /** At most this many explosions at once; the oldest is recycled first. */
  maxExplosions: 16,
  /** The bomb flash tints the field (GDD v0.8 §9.4)… */
  bombFlashMs: 300,
  /** …and a new one starts at most every 1/3 s: under 3 flashes per second. */
  bombFlashSpacingMs: 1000 / 3,
  /** The bomb's field shake *(initial, v0.8)*: 4 logical px, damped to 0 over 300 ms. */
  shakePx: 4,
  shakeMs: 300,
  /** The shake changes side every this many ms. */
  shakeFlipMs: 33,
} as const;

const FLASH_SLOTS = 16;
// Explosion square size per size tier (small, medium, large), at its largest: the tier's sprite
// width (GDD v0.10 §5.2.1: the Heavy is 56 px wide).
const TIER_SIZE = [16, 32, 56] as const;

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

/**
 * The bomb's tint of the play field (GDD v0.8 §9.4): about 300 ms of wall time, and a new flash
 * starts only 1/3 s or more after the previous one started, so bombs in a row never flash more
 * than 3 times a second (photosensitivity, §9.7).
 */
export class BombFlash {
  private msLeft = 0;
  private sinceStartMs = Number.POSITIVE_INFINITY;

  trigger(): void {
    if (this.sinceStartMs < EffectTuning.bombFlashSpacingMs) return;
    this.msLeft = EffectTuning.bombFlashMs;
    this.sinceStartMs = 0;
  }

  /** Drawn past the field's edges by the shake's reach, so a shaken field is tinted to its clip. */
  draw(render: RenderPort, width: number, height: number): void {
    if (this.msLeft <= 0) return;
    const reach = EffectTuning.shakePx;
    render.drawRect(-reach, -reach, width + 2 * reach, height + 2 * reach, Palette.bombFlash);
  }

  advance(ms: number): void {
    this.msLeft -= ms;
    this.sinceStartMs += ms;
  }
}

/**
 * The bomb's field shake (GDD v0.8 §9.4, ADR-0014): a horizontal whole-pixel camera offset that
 * changes side every 33 ms and fades out over 300 ms. Deterministic, so it needs no random draw.
 */
export class Shake {
  private elapsedMs = Number.POSITIVE_INFINITY;

  trigger(): void {
    this.elapsedMs = 0;
  }

  /** Sets the field's camera offset: (0, 0) once the shake is over. */
  apply(render: RenderPort): void {
    if (this.elapsedMs >= EffectTuning.shakeMs) {
      render.setCameraOffset(0, 0);
      return;
    }
    const amplitude = EffectTuning.shakePx * (1 - this.elapsedMs / EffectTuning.shakeMs);
    const phase = Math.floor(this.elapsedMs / EffectTuning.shakeFlipMs);
    render.setCameraOffset(Math.round((phase % 2 === 0 ? 1 : -1) * amplitude), 0);
  }

  advance(ms: number): void {
    this.elapsedMs += ms;
  }
}
