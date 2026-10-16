import { Sfx } from '../audio/sfx';
import { SizeTier } from '../game/enemy';
import { GameEventKind } from '../game/events';
import type { GameEvent, RunEvents } from '../game/events';
import { PickupKind } from '../game/pickup';
import type { WorldSnapshot } from '../game/run';
import { WeaponKind } from '../game/weapon';
import type { AudioPort } from '../ports/audio-port';

const EXPLOSION_OF_TIER: Readonly<Record<SizeTier, Sfx>> = {
  [SizeTier.Small]: Sfx.ExplosionSmall,
  [SizeTier.Medium]: Sfx.ExplosionMedium,
  [SizeTier.Large]: Sfx.ExplosionLarge,
};

const SOUND_OF_PICKUP: Readonly<Record<PickupKind, Sfx>> = {
  [PickupKind.PRed]: Sfx.PowerUp,
  [PickupKind.PBlue]: Sfx.PowerUp,
  [PickupKind.Shield]: Sfx.ShieldUp,
  [PickupKind.Bomb]: Sfx.Pickup,
  [PickupKind.OneUp]: Sfx.OneUp,
};

/**
 * The run's sounds (GDD v0.23 §9.5, audio/04-class-audio): the presenter's event-to-sound mapping
 * (ADR-0010), kept in its own module so the presenter does not grow. Shots have no event: once per
 * frame it compares the run's shot counters, so a volley plays one sound, never one per bullet.
 */
export class RunSounds {
  private readonly audio: AudioPort;
  private playerShots = 0;
  private enemyShots = 0;
  /** The boss's serial, from its warning: its hits sound apart from the other enemies'. */
  private bossSerial = 0;

  constructor(audio: AudioPort, events: RunEvents) {
    this.audio = audio;
    events.subscribe(GameEventKind.EnemyHit, this.onEnemyHit);
    events.subscribe(GameEventKind.EnemyDestroyed, this.onEnemyDestroyed);
    events.subscribe(GameEventKind.PlayerDied, this.playOn(Sfx.PlayerDeath));
    events.subscribe(GameEventKind.PickupCollected, this.onPickupCollected);
    events.subscribe(GameEventKind.PlayerHit, this.playOn(Sfx.ShieldBreak));
    events.subscribe(GameEventKind.BombUsed, this.playOn(Sfx.Bomb));
    events.subscribe(GameEventKind.BossWarning, this.onBossWarning);
    events.subscribe(GameEventKind.BossPhaseChanged, this.playOn(Sfx.BossPhase));
    events.subscribe(GameEventKind.BossDestroyed, this.playOn(Sfx.BossDeath));
  }

  /** Once per drawn frame: the shot sounds of the steps since the last frame. */
  frame(snapshot: Readonly<WorldSnapshot>): void {
    if (snapshot.playerShots !== this.playerShots) {
      this.audio.play(snapshot.weaponKind === WeaponKind.Laser ? Sfx.ShotLaser : Sfx.ShotSpread);
      this.playerShots = snapshot.playerShots;
    }
    if (snapshot.enemyShots !== this.enemyShots) {
      this.audio.play(Sfx.EnemyShot);
      this.enemyShots = snapshot.enemyShots;
    }
  }

  /** A handler that plays `sfx`, for an event whose detail does not matter. */
  private playOn(sfx: Sfx): () => void {
    return () => {
      this.audio.play(sfx);
    };
  }

  private readonly onEnemyHit = (event: Readonly<GameEvent>): void => {
    this.audio.play(event.subject === this.bossSerial ? Sfx.BossHit : Sfx.Hit);
  };

  private readonly onEnemyDestroyed = (event: Readonly<GameEvent>): void => {
    this.audio.play(EXPLOSION_OF_TIER[event.detail as SizeTier]);
  };

  private readonly onPickupCollected = (event: Readonly<GameEvent>): void => {
    this.audio.play(SOUND_OF_PICKUP[event.detail as PickupKind]);
  };

  private readonly onBossWarning = (event: Readonly<GameEvent>): void => {
    this.bossSerial = event.subject;
    this.audio.play(Sfx.Warning);
  };
}
