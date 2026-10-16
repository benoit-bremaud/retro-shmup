import { describe, expect, it } from 'vitest';
import { Sfx } from '../../src/domain/audio/sfx';
import type {
  AudioBufferLike,
  AudioContextLike,
  AudioNodeLike,
  BufferSourceLike,
  GainNodeLike,
} from '../../src/adapters/web-audio-player';
import { WebAudioPlayer } from '../../src/adapters/web-audio-player';

class FakeSource implements BufferSourceLike {
  buffer: AudioBufferLike | null = null;
  started = false;
  stopped = false;
  throwOnStop = false;
  connect(): void {
    // Wiring is not observed.
  }
  start(): void {
    this.started = true;
  }
  stop(): void {
    if (this.throwOnStop) throw new Error('InvalidStateError');
    this.stopped = true;
  }
}

class FakeContext implements AudioContextLike {
  readonly sampleRate = 8000;
  currentTime = 0;
  readonly destination: AudioNodeLike = { connect: () => undefined };
  readonly calls: string[] = [];
  readonly sources: FakeSource[] = [];
  readonly gain: GainNodeLike = { gain: { value: -1 }, connect: () => undefined };
  buffers = 0;
  resume(): Promise<void> {
    this.calls.push('resume');
    return Promise.reject(new Error('not allowed'));
  }
  suspend(): Promise<void> {
    this.calls.push('suspend');
    return Promise.resolve();
  }
  createGain(): GainNodeLike {
    return this.gain;
  }
  createBuffer(): AudioBufferLike {
    this.buffers += 1;
    return { copyToChannel: () => undefined };
  }
  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
}

function unlocked(): { player: WebAudioPlayer; context: FakeContext } {
  const context = new FakeContext();
  const player = new WebAudioPlayer(() => context);
  player.unlock();
  return { player, context };
}

describe('WebAudioPlayer (ADR-0009, GDD v0.23 §9.5)', () => {
  it('is silent and creates nothing before the first gesture', () => {
    let created = 0;
    const player = new WebAudioPlayer(() => {
      created += 1;
      return new FakeContext();
    });
    player.play(Sfx.Hit);
    player.setHidden(true);
    expect(created).toBe(0);
  });

  it('stays silent where Web Audio is missing', () => {
    const player = new WebAudioPlayer(() => {
      throw new Error('no AudioContext');
    });
    player.unlock();
    expect(() => {
      player.play(Sfx.Hit);
    }).not.toThrow();
  });

  it('renders the table once and resumes on every gesture', () => {
    const { player, context } = unlocked();
    player.unlock();
    expect(context.buffers).toBe(Object.values(Sfx).length);
    expect(context.calls).toEqual(['resume', 'resume']);
  });

  it('applies the sound-effects volume set before and after the unlock', () => {
    const context = new FakeContext();
    const player = new WebAudioPlayer(() => context);
    player.setVolumes(0.49, 0.64);
    player.unlock();
    expect(context.gain.gain.value).toBe(0.64);
    player.setVolumes(0.49, 0.25);
    expect(context.gain.gain.value).toBe(0.25);
  });

  it('plays a sound and ignores an unknown one', () => {
    const { player, context } = unlocked();
    player.play(Sfx.Hit);
    player.play('nope');
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.started).toBe(true);
  });

  it('skips the same sound again within 33 ms, not another sound', () => {
    const { player, context } = unlocked();
    player.play(Sfx.Hit);
    context.currentTime = 0.02;
    player.play(Sfx.Hit);
    player.play(Sfx.Bomb);
    context.currentTime = 0.04;
    player.play(Sfx.Hit);
    expect(context.sources).toHaveLength(3);
  });

  it('stops the oldest of 16 voices for a 17th sound', () => {
    const { player, context } = unlocked();
    for (let i = 0; i < 17; i += 1) {
      context.currentTime = i;
      player.play(Sfx.Hit);
    }
    expect(context.sources[0]?.stopped).toBe(true);
    expect(context.sources[1]?.stopped).toBe(false);
  });

  it('tolerates a voice that throws when stopped after it ended', () => {
    const { player, context } = unlocked();
    player.play(Sfx.Hit);
    const first = context.sources[0];
    if (first !== undefined) first.throwOnStop = true;
    expect(() => {
      player.setPaused(true);
    }).not.toThrow();
  });

  it('stops the game sounds and keeps the menu sounds while paused', () => {
    const { player, context } = unlocked();
    player.play(Sfx.Bomb);
    player.play(Sfx.MenuMove);
    player.setPaused(true);
    player.play(Sfx.Hit);
    player.play(Sfx.MenuConfirm);
    expect(context.sources.map((source) => source.stopped)).toEqual([true, false, false]);
    player.setPaused(false);
    player.play(Sfx.Hit);
    expect(context.sources).toHaveLength(4);
  });

  it('suspends while the tab is hidden and resumes when shown', () => {
    const { player, context } = unlocked();
    player.setHidden(true);
    player.setHidden(false);
    expect(context.calls).toEqual(['resume', 'suspend', 'resume']);
  });

  it('remembers the track asked for (played from G3-2)', () => {
    const { player } = unlocked();
    player.music('title');
    expect(player.track).toBe('title');
  });
});
