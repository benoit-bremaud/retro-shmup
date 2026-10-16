import { describe, expect, it } from 'vitest';
import { Sfx } from '../../src/domain/audio/sfx';
import { SizeTier } from '../../src/domain/game/enemy';
import { createGameEvent, EventBus, GameEventKind } from '../../src/domain/game/events';
import { PickupKind } from '../../src/domain/game/pickup';
import type { WorldSnapshot } from '../../src/domain/game/run';
import { Run } from '../../src/domain/game/run';
import { WeaponKind } from '../../src/domain/game/weapon';
import { RunSounds } from '../../src/domain/presentation/run-sounds';
import { RecordingAudio } from '../support/recording-audio';

function setup(): { audio: RecordingAudio; bus: EventBus; sounds: RunSounds } {
  const audio = new RecordingAudio();
  const bus = new EventBus();
  return { audio, bus, sounds: new RunSounds(audio, bus) };
}

function publish(bus: EventBus, kind: GameEventKind, detail = 0, subject = 0): void {
  const event = createGameEvent(kind);
  event.detail = detail;
  event.subject = subject;
  bus.publish(event);
}

function shots(
  player: number,
  enemy: number,
  weaponKind: WeaponKind = WeaponKind.Spread,
): WorldSnapshot {
  return { ...new Run().snapshot(), playerShots: player, enemyShots: enemy, weaponKind };
}

describe('RunSounds (GDD v0.23 §9.5, audio/04-class-audio)', () => {
  it.each([
    [GameEventKind.PlayerDied, Sfx.PlayerDeath],
    [GameEventKind.PlayerHit, Sfx.ShieldBreak],
    [GameEventKind.BombUsed, Sfx.Bomb],
    [GameEventKind.BossPhaseChanged, Sfx.BossPhase],
    [GameEventKind.BossDestroyed, Sfx.BossDeath],
    [GameEventKind.BossWarning, Sfx.Warning],
  ])('plays the sound of event %i', (kind, sfx) => {
    const { audio, bus } = setup();
    publish(bus, kind);
    expect(audio.played).toEqual([sfx]);
  });

  it.each([
    [SizeTier.Small, Sfx.ExplosionSmall],
    [SizeTier.Medium, Sfx.ExplosionMedium],
    [SizeTier.Large, Sfx.ExplosionLarge],
  ])('plays the explosion of size tier %i', (tier, sfx) => {
    const { audio, bus } = setup();
    publish(bus, GameEventKind.EnemyDestroyed, tier);
    expect(audio.played).toEqual([sfx]);
  });

  it.each([
    [PickupKind.PRed, Sfx.PowerUp],
    [PickupKind.PBlue, Sfx.PowerUp],
    [PickupKind.Shield, Sfx.ShieldUp],
    [PickupKind.Bomb, Sfx.Pickup],
    [PickupKind.OneUp, Sfx.OneUp],
  ])('plays the sound of pickup %i', (kind, sfx) => {
    const { audio, bus } = setup();
    publish(bus, GameEventKind.PickupCollected, kind);
    expect(audio.played).toEqual([sfx]);
  });

  it('tells a boss hit from an enemy hit by the serial of the warning', () => {
    const { audio, bus } = setup();
    publish(bus, GameEventKind.EnemyHit, 0, 7);
    publish(bus, GameEventKind.BossWarning, 0, 9);
    publish(bus, GameEventKind.EnemyHit, 0, 9);
    expect(audio.played).toEqual([Sfx.Hit, Sfx.Warning, Sfx.BossHit]);
  });

  it('plays one shot sound per frame with new bullets, never one per bullet', () => {
    const { audio, sounds } = setup();
    sounds.frame(shots(0, 0));
    sounds.frame(shots(5, 0));
    sounds.frame(shots(5, 0));
    sounds.frame(shots(7, 3, WeaponKind.Laser));
    expect(audio.played).toEqual([Sfx.ShotSpread, Sfx.ShotLaser, Sfx.EnemyShot]);
  });
});
