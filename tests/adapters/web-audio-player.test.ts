import { describe, expect, it } from 'vitest';
import { Sfx } from '../../src/domain/audio/sfx';
import type {
  AudioBufferLike,
  AudioParamLike,
  AudioContextLike,
  AudioNodeLike,
  BufferSourceLike,
  GainNodeLike,
  LoadAudioFile,
} from '../../src/adapters/web-audio-player';
import { WebAudioPlayer } from '../../src/adapters/web-audio-player';

class FakeSource implements BufferSourceLike {
  buffer: AudioBufferLike | null = null;
  loop = false;
  started = false;
  startedAt = -1;
  stopped = false;
  stoppedAt = -1;
  throwOnStop = false;
  connect(): void {
    // Wiring is not observed.
  }
  start(when = 0): void {
    this.started = true;
    this.startedAt = when;
  }
  stop(when = 0): void {
    if (this.throwOnStop) throw new Error('InvalidStateError');
    this.stopped = true;
    this.stoppedAt = when;
  }
}

/** A gain recording its ramps as `target@time`. */
class FakeGain implements GainNodeLike {
  readonly ramps: string[] = [];
  readonly gain: AudioParamLike = {
    value: -1,
    cancelScheduledValues: () => undefined,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: (value, time) => {
      this.ramps.push(`${String(value)}@${String(time)}`);
    },
  };
  connect(): void {
    // Wiring is not observed.
  }
}

/** A decoded track file: its name as the duration's source, 2 s long. */
interface FakeTrackBuffer extends AudioBufferLike {
  readonly file: string;
}

class FakeContext implements AudioContextLike {
  readonly sampleRate = 8000;
  currentTime = 0;
  readonly destination: AudioNodeLike = { connect: () => undefined };
  readonly calls: string[] = [];
  readonly sources: FakeSource[] = [];
  /** In creation order: the sound effects, the music volume, the duck, then one fade per track. */
  readonly gains: FakeGain[] = [];
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
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createBuffer(): AudioBufferLike {
    this.buffers += 1;
    return { duration: 0.1, copyToChannel: () => undefined };
  }
  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike> {
    const file = new TextDecoder().decode(data);
    if (file === 'broken') return Promise.reject(new Error('EncodingError'));
    const buffer: FakeTrackBuffer = { file, duration: 2, copyToChannel: () => undefined };
    return Promise.resolve(buffer);
  }
}

/** Every file loads as its own name, except those listed, which fail to fetch. */
function loader(failing: readonly string[] = []): LoadAudioFile {
  return (file) => {
    if (failing.includes(file)) return Promise.reject(new Error('404'));
    return Promise.resolve(new TextEncoder().encode(file).buffer);
  };
}

const NO_FILES: LoadAudioFile = () => Promise.reject(new Error('offline'));

function fileOf(source: FakeSource | undefined): string {
  const buffer = source?.buffer as FakeTrackBuffer | null | undefined;
  return buffer?.file ?? '';
}

/** Lets the fetches and decodes settle. */
async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function unlocked(load: LoadAudioFile = NO_FILES): {
  player: WebAudioPlayer;
  context: FakeContext;
} {
  const context = new FakeContext();
  const player = new WebAudioPlayer(() => context, load);
  player.unlock();
  return { player, context };
}

describe('WebAudioPlayer (ADR-0009, GDD v0.23 §9.5)', () => {
  it('is silent and creates nothing before the first gesture', () => {
    let created = 0;
    const player = new WebAudioPlayer(() => {
      created += 1;
      return new FakeContext();
    }, NO_FILES);
    player.play(Sfx.Hit);
    player.setHidden(true);
    expect(created).toBe(0);
  });

  it('stays silent where Web Audio is missing', () => {
    const player = new WebAudioPlayer(() => {
      throw new Error('no AudioContext');
    }, NO_FILES);
    player.music('title');
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

  it('applies both volumes set before and after the unlock', () => {
    const context = new FakeContext();
    const player = new WebAudioPlayer(() => context, NO_FILES);
    player.setVolumes(0.49, 0.64);
    player.unlock();
    expect(context.gains.map((gain) => gain.gain.value)).toEqual([0.64, 0.49, 1]);
    player.setVolumes(0.09, 0.25);
    expect(context.gains[0]?.gain.value).toBe(0.25);
    expect(context.gains[1]?.gain.value).toBe(0.09);
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

  it('plays a track asked for before its files arrive, looping it, once loaded', async () => {
    const { player, context } = unlocked(loader());
    player.music('title');
    expect(context.sources).toHaveLength(0);
    await settle();
    expect(context.sources.map(fileOf)).toEqual(['title.mp3']);
    expect(context.sources[0]?.loop).toBe(true);
    player.music('title');
    expect(context.sources).toHaveLength(1);
  });

  it('plays the boss intro once, then its loop from the intro end', async () => {
    const { player, context } = unlocked(loader());
    await settle();
    context.currentTime = 10;
    player.music('boss');
    const [intro, loop] = context.sources;
    expect([fileOf(intro), intro?.loop, intro?.startedAt]).toEqual(['boss-intro.mp3', false, 10]);
    expect([fileOf(loop), loop?.loop, loop?.startedAt]).toEqual(['boss-loop.mp3', true, 12]);
  });

  it('plays a jingle once and replaces the track at once', async () => {
    const { player, context } = unlocked(loader());
    await settle();
    player.music('level-1');
    context.currentTime = 5;
    player.music('game-over');
    expect(context.sources[0]?.stoppedAt).toBe(5);
    expect([fileOf(context.sources[1]), context.sources[1]?.loop]).toEqual([
      'game-over.mp3',
      false,
    ]);
  });

  it('fades the track out over 0.5 s on silence (the warning)', async () => {
    const { player, context } = unlocked(loader());
    await settle();
    player.music('level-1');
    context.currentTime = 3;
    player.music(null);
    expect(context.gains[3]?.ramps).toEqual(['0@3.5']);
    expect(context.sources[0]?.stoppedAt).toBe(3.5);
    expect(player.track).toBeNull();
  });

  it('ducks the music to -12 dB over 150 ms paused, back over 1 s resumed', () => {
    const { player, context } = unlocked();
    player.setPaused(true);
    context.currentTime = 2;
    player.setPaused(false);
    expect(context.gains[2]?.ramps).toEqual(['0.25@0.15', '1@3']);
  });

  it('starts ducked when paused before the unlock', () => {
    const context = new FakeContext();
    const player = new WebAudioPlayer(() => context, NO_FILES);
    player.setPaused(true);
    player.unlock();
    expect(context.gains[2]?.gain.value).toBe(0.25);
  });

  it('keeps a track silent when one of its files fails to load', async () => {
    const { player, context } = unlocked(loader(['boss-loop.mp3']));
    player.music('boss');
    await settle();
    expect(context.sources).toHaveLength(0);
  });

  it('keeps a track silent when its file fails to decode, and ignores an unknown track', async () => {
    const context = new FakeContext();
    const player = new WebAudioPlayer(
      () => context,
      (file) =>
        Promise.resolve(new TextEncoder().encode(file === 'title.mp3' ? 'broken' : file).buffer),
    );
    player.unlock();
    player.music('title');
    await settle();
    player.music('nope');
    expect(context.sources).toHaveLength(0);
  });

  it('tolerates a jingle that throws when stopped after it ended', async () => {
    const { player, context } = unlocked(loader());
    await settle();
    player.music('results');
    const jingle = context.sources[0];
    if (jingle !== undefined) jingle.throwOnStop = true;
    expect(() => {
      player.music('title');
    }).not.toThrow();
  });

  it('loads the files one at a time, the track asked for first', async () => {
    const order: string[] = [];
    const context = new FakeContext();
    const player = new WebAudioPlayer(
      () => context,
      (file) => {
        order.push(file);
        return Promise.resolve(new TextEncoder().encode(file).buffer);
      },
    );
    player.music('boss');
    player.unlock();
    expect(order).toEqual(['boss-intro.mp3']);
    await settle();
    expect(order).toEqual([
      'boss-intro.mp3',
      'boss-loop.mp3',
      'title.mp3',
      'level-1.mp3',
      'results.mp3',
      'game-over.mp3',
    ]);
    expect(context.sources.map(fileOf)).toEqual(['boss-intro.mp3', 'boss-loop.mp3']);
  });
});
