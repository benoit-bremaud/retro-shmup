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

/**
 * The explosion kinds (GDD v0.10 §9.4): the three enemy size tiers keep `SizeTier`'s values, so an
 * `ENEMY_DESTROYED` detail is a tier as is; the boss has its own, and debris is the burst of
 * fragments where a broken part was.
 */
export const ExplosionTier = { Small: 0, Medium: 1, Large: 2, Boss: 3, Debris: 4 } as const;
export type ExplosionTier = (typeof ExplosionTier)[keyof typeof ExplosionTier];

// Per tier: the burst's size (the sprite width; debris the turret's), its fragment count, and its
// core as a fraction of the size. The boss's core is small so the hull stays readable; debris has
// none (owner decision of 2026-10-12, style A without white).
const TIER_SIZE = [16, 32, 56, 112, 24] as const;
const TIER_FRAGMENTS = [8, 12, 16, 24, 10] as const;
const TIER_CORE = [0.55, 0.55, 0.55, 0.3, 0] as const;
// Phases of the 300 ms burst, as fractions of it: the core shrinks to nothing by 0.4, fragments
// are hot until 0.35 and 2 x 2 until 0.6.
const CORE_END = 0.4;
const HOT_END = 0.35;
const BIG_FRAGMENT_END = 0.6;
const FRAGMENT_REACH = 6;
const FRAGMENT_TWIST = 0.2;
const INNER_FRAGMENT = 0.75;

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
 * Animated explosions (GDD v0.10 §9.4, style A without white): a hot core that shrinks while
 * fragments fly out on an ease-out radius and cool down. Never white — a white flash per kill gave
 * 12 flashes a second in one Popcorn formation, against the 3 a second of §9.7. Fragments are
 * computed from the age, so a burst is deterministic, needs no random draw and stores only its
 * centre, tier and age in a ring of 16: every burst lasts the same time, so the next slot is
 * always the oldest.
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

  draw(render: RenderPort): void {
    for (let i = 0; i < EffectTuning.maxExplosions; i += 1) {
      const age = this.ageMs[i] ?? EffectTuning.explosionMs;
      if (age >= EffectTuning.explosionMs) continue;
      this.drawBurst(render, i, age / EffectTuning.explosionMs);
    }
  }

  advance(ms: number): void {
    for (let i = 0; i < EffectTuning.maxExplosions; i += 1) {
      this.ageMs[i] = (this.ageMs[i] ?? 0) + ms;
    }
  }

  // One burst at progress p in [0, 1): the core while p < 0.4, then the n fragments.
  private drawBurst(render: RenderPort, slot: number, p: number): void {
    const tier = this.tier[slot] ?? 0;
    const size = TIER_SIZE[tier] ?? TIER_SIZE[0];
    const n = TIER_FRAGMENTS[tier] ?? TIER_FRAGMENTS[0];
    const cx = this.x[slot] ?? 0;
    const cy = this.y[slot] ?? 0;
    const core = size * (TIER_CORE[tier] ?? 0) * (1 - p / CORE_END);
    if (p < CORE_END && core > 0) {
      render.drawRect(cx - core / 2, cy - core / 2, core, core, Palette.explosionHot);
    }
    const radius = (size / 2 + FRAGMENT_REACH) * (1 - (1 - p) * (1 - p));
    const side = p < BIG_FRAGMENT_END ? 2 : 1;
    const colour = p < HOT_END ? Palette.explosionHot : Palette.explosionCool;
    for (let i = 0; i < n; i += 1) {
      const angle = (i / n) * Math.PI * 2 + (i % 2) * FRAGMENT_TWIST;
      const reach = radius * (i % 3 === 0 ? 1 : INNER_FRAGMENT);
      const fx = cx + Math.cos(angle) * reach - side / 2;
      const fy = cy + Math.sin(angle) * reach - side / 2;
      render.drawRect(fx, fy, side, side, colour);
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
