import { Button } from '../ports/input-port';
import { NORMAL } from './difficulty';
import type { IntentFrame } from '../ports/input-port';
import { FIELD_HEIGHT, FIELD_WIDTH } from './geometry';
import type { Vec2 } from './geometry';
import { PickupKind } from './pickup';
import { KitCaps, KitTuning, PlayerTuning, toSteps } from './tuning';
import { Weapon, WeaponKind } from './weapon';
import type { PlayerShotSpawner } from './weapon';

/** Lifecycle of the ship (05-state-player). */
export const PlayerState = {
  Entering: 'ENTERING',
  Invulnerable: 'INVULNERABLE',
  Vulnerable: 'VULNERABLE',
  Dead: 'DEAD',
} as const;
export type PlayerState = (typeof PlayerState)[keyof typeof PlayerState];

/** What a hit did (class diagram). */
export const HitOutcome = {
  Ignored: 'IGNORED',
  /** The shield charge took it (GDD v0.8 §4.4). */
  Absorbed: 'ABSORBED',
  Died: 'DIED',
} as const;
export type HitOutcome = (typeof HitOutcome)[keyof typeof HitOutcome];

const FLY_IN_STEPS = toSteps(PlayerTuning.flyInSeconds);
const INVULNERABLE_STEPS = toSteps(PlayerTuning.invulnerableSeconds);
const RESPAWN_STEPS = toSteps(PlayerTuning.respawnSeconds);
const SHIELD_STEPS = toSteps(KitTuning.shieldInvulnerableSeconds);
const BOMB_STEPS = toSteps(KitTuning.bombInvulnerableSeconds);
const MIN_X = PlayerTuning.halfSize;
const MAX_X = FIELD_WIDTH - PlayerTuning.halfSize;
const MIN_Y = PlayerTuning.halfSize;
const MAX_Y = FIELD_HEIGHT - PlayerTuning.halfSize;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The player's ship (class diagram, view A). `Run.step` calls `update` at step 2 (move),
 * `useBomb` at step slot 3 and `advanceTimers` at step 7. A timer-driven change (step 7) takes
 * effect from the next step; a bomb's protection (slot 3) takes effect at once, before the
 * collisions of step 5 in the same step, so a last-moment bomb saves the ship.
 */
export class Player {
  readonly position: Vec2 = { x: PlayerTuning.spawnX, y: PlayerTuning.spawnY };
  readonly previousPosition: Vec2 = { x: PlayerTuning.spawnX, y: PlayerTuning.spawnY };
  private readonly weapon = new Weapon();
  private currentState: PlayerState = PlayerState.Entering;
  /** Steps left in the current timed state (05-state-player: one timer). */
  private stateSteps = FLY_IN_STEPS;
  /** Steps since the protection began; the blink phase comes from it, never from `stateSteps`. */
  private protection = 0;
  private livesLeft: number = NORMAL.lives;
  private bombStock: number = NORMAL.bombsPerLife;
  private shieldHeld = false;

  get state(): PlayerState {
    return this.currentState;
  }

  /**
   * Steps since the protection began: the blink phase. Restarted only by a new protection (the
   * fly-in, a shield absorption, a bomb from `Vulnerable`), never by the state timer.
   */
  get protectionSteps(): number {
    return this.protection;
  }

  /** Lives left, the ship in play included (GDD §4.4). */
  get lives(): number {
    return this.livesLeft;
  }

  get weaponKind(): WeaponKind {
    return this.weapon.kind;
  }

  /** The power level, 1 to 5. */
  get power(): number {
    return this.weapon.level;
  }

  /** Bombs in stock (GDD §4.5). */
  get bombs(): number {
    return this.bombStock;
  }

  /** A shield charge is held (GDD §4.4). */
  get shield(): boolean {
    return this.shieldHeld;
  }

  /** A ship on its way in or in control catches pickups; a dead one never does (GDD v0.8 §4.6). */
  get canCollect(): boolean {
    return this.currentState !== PlayerState.Dead;
  }

  /**
   * Applies a caught pickup (class diagram, ADR-0019); returns the cap bonus to award, 0 when the
   * effect applied.
   */
  collect(kind: PickupKind): number {
    switch (kind) {
      case PickupKind.PRed:
        return this.weapon.powerUp(WeaponKind.Spread) ? 0 : KitCaps.capBonus;
      case PickupKind.PBlue:
        return this.weapon.powerUp(WeaponKind.Laser) ? 0 : KitCaps.capBonus;
      case PickupKind.Shield:
        if (this.shieldHeld) return KitCaps.capBonus;
        this.shieldHeld = true;
        return 0;
      case PickupKind.Bomb:
        if (this.bombStock >= KitCaps.maxBombs) return KitCaps.capBonus;
        this.bombStock += 1;
        return 0;
      case PickupKind.OneUp:
        if (this.livesLeft >= KitCaps.maxLives) return KitCaps.capBonus;
        this.livesLeft += 1;
        return 0;
    }
  }

  /** True once the last death sequence has ended: `Run` reads it at step 8 (05-state-player). */
  get isOut(): boolean {
    return this.currentState === PlayerState.Dead && this.livesLeft === 0 && this.stateSteps === 0;
  }

  /**
   * Step 5 of `Run.step`: an enemy bullet or body overlaps the hitbox. Only a vulnerable ship is
   * hurt; in every other state the hit passes through, so at most one hit counts per step. A held
   * shield charge absorbs it: 0.5 s of invulnerability, the blink restarted (GDD v0.8 §4.4).
   */
  hit(): HitOutcome {
    if (this.currentState !== PlayerState.Vulnerable) return HitOutcome.Ignored;
    if (this.shieldHeld) {
      this.shieldHeld = false;
      this.protect(SHIELD_STEPS);
      return HitOutcome.Absorbed;
    }
    this.livesLeft -= 1;
    this.currentState = PlayerState.Dead;
    this.stateSteps = RESPAWN_STEPS;
    return HitOutcome.Died;
  }

  /**
   * The death effects, applied at once (GDD v0.8 §4.4): the power level drops by one and the
   * bombs reset to the profile's stock. Returns whether a level was lost, to be released as a P.
   */
  applyDeathPenalty(): boolean {
    this.bombStock = NORMAL.bombsPerLife;
    return this.weapon.powerDown();
  }

  /**
   * Step slot 3 (02-sequence-bomb): a bomb in stock, in control only (`Vulnerable` or
   * `Invulnerable`). The ship is then invulnerable for max(time left, 1 s): a bomb never shortens
   * a protection. Returns whether the bomb goes off.
   */
  useBomb(): boolean {
    const inControl =
      this.currentState === PlayerState.Vulnerable ||
      this.currentState === PlayerState.Invulnerable;
    if (!inControl || this.bombStock <= 0) return false;
    this.bombStock -= 1;
    if (this.currentState === PlayerState.Invulnerable) {
      this.stateSteps = Math.max(this.stateSteps, BOMB_STEPS);
    } else {
      this.protect(BOMB_STEPS);
    }
    return true;
  }

  // A vulnerable ship becomes invulnerable for `steps`, its blink starting over.
  private protect(steps: number): void {
    this.currentState = PlayerState.Invulnerable;
    this.stateSteps = steps;
    this.protection = 0;
  }

  /**
   * Step 2 of `Run.step`: the fly-in, or the movement the frame asks for and the weapon. The
   * spawner is a parameter, as for the enemies' attack patterns: the player never stores it.
   */
  update(frame: Readonly<IntentFrame>, dt: number, spawner: PlayerShotSpawner): void {
    this.previousPosition.x = this.position.x;
    this.previousPosition.y = this.position.y;
    if (this.currentState === PlayerState.Dead) return;
    if (this.currentState === PlayerState.Entering) {
      this.flyIn();
      return;
    }
    this.move(frame, dt);
    this.position.x = clamp(this.position.x, MIN_X, MAX_X);
    this.position.y = clamp(this.position.y, MIN_Y, MAX_Y);
    this.weapon.tick(this.position, (frame.held & Button.Fire) !== 0, spawner);
  }

  /** Step 7 of `Run.step`: the state timer and the protection count. */
  advanceTimers(): void {
    if (this.currentState === PlayerState.Vulnerable) return;
    if (this.currentState === PlayerState.Dead) {
      this.advanceDeath();
      return;
    }
    this.protection += 1;
    this.stateSteps -= 1;
    if (this.stateSteps > 0) return;
    if (this.currentState === PlayerState.Entering) {
      this.currentState = PlayerState.Invulnerable;
      this.stateSteps = INVULNERABLE_STEPS;
    } else {
      this.currentState = PlayerState.Vulnerable;
    }
  }

  // The death sequence; with a life left the ship flies in again from the spawn point.
  private advanceDeath(): void {
    if (this.stateSteps > 0) this.stateSteps -= 1;
    if (this.stateSteps > 0 || this.livesLeft === 0) return;
    this.currentState = PlayerState.Entering;
    this.stateSteps = FLY_IN_STEPS;
    this.protection = 0;
    this.position.x = PlayerTuning.spawnX;
    this.position.y = PlayerTuning.spawnY;
    this.previousPosition.x = PlayerTuning.spawnX;
    this.previousPosition.y = PlayerTuning.spawnY;
    // The cooldown froze while Dead: the first shot after the fly-in is immediate.
    this.weapon.reset();
  }

  // Linear from the spawn point to the resting point over the fly-in steps.
  private flyIn(): void {
    const done = FLY_IN_STEPS - this.stateSteps + 1;
    const travel = PlayerTuning.restY - PlayerTuning.spawnY;
    this.position.y = PlayerTuning.spawnY + (travel * done) / FLY_IN_STEPS;
  }

  private move(frame: Readonly<IntentFrame>, dt: number): void {
    const reach = PlayerTuning.maxSpeed * dt;
    if (frame.moveKind === 'direction') {
      this.position.x += frame.moveX * reach;
      this.position.y += frame.moveY * reach;
    } else if (frame.moveKind === 'target') {
      const dx = frame.moveX - this.position.x;
      const dy = frame.moveY - this.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= reach) {
        this.position.x = frame.moveX;
        this.position.y = frame.moveY;
      } else {
        this.position.x += (dx / distance) * reach;
        this.position.y += (dy / distance) * reach;
      }
    }
  }
}
