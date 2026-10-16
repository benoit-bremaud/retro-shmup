import { JINGLES, Track } from '../domain/audio/music';
import { Sfx, SFX_TABLE, UI_SOUNDS } from '../domain/audio/sfx';
import { renderSfx } from '../domain/audio/synth';
import type { AudioPort, SfxId, TrackId } from '../domain/ports/audio-port';

/**
 * The parts of Web Audio this adapter uses, injected so tests run without a browser (as
 * `InputEnvironment`, ADR-0015 decision 4): a gain's value and its ramps (fades, the duck).
 */
export interface AudioParamLike {
  value: number;
  cancelScheduledValues(time: number): void;
  setValueAtTime(value: number, time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
}
/** A node that feeds another. */
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): void;
}
/** A volume control: a bus, a fade, the pause duck. */
export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}
/** Rendered or decoded samples, filled once at unlock. */
export interface AudioBufferLike {
  /** In seconds: the boss's loop starts when its intro ends. */
  readonly duration: number;
  copyToChannel(source: Float32Array<ArrayBuffer>, channel: number): void;
}
/** One playing sound effect or track: single-use, as in Web Audio. */
export interface BufferSourceLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  start(when?: number): void;
  stop(when?: number): void;
}
/** The context: clock, suspension and node factories. */
export interface AudioContextLike {
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  createGain(): GainNodeLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): BufferSourceLike;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>;
}

/** Fetches one file of `public/assets/audio/` (injected: the adapter never touches `fetch`). */
export type LoadAudioFile = (file: string) => Promise<ArrayBuffer>;

/** Each track's files (GDD v0.23 §9.5): the boss's intro, then the file that loops. */
const TRACK_FILES: Readonly<Record<Track, readonly string[]>> = {
  [Track.Title]: ['title.mp3'],
  [Track.Level1]: ['level-1.mp3'],
  [Track.Boss]: ['boss-intro.mp3', 'boss-loop.mp3'],
  [Track.Results]: ['results.mp3'],
  [Track.GameOver]: ['game-over.mp3'],
};
/** The music fade before the boss (GDD v0.23 §6) and the pause duck's ramps (ADR-0009). */
const FADE_OUT_S = 0.5;
const DUCK_GAIN = 0.25; // −12 dB
const DUCK_S = 0.15;
const UNDUCK_S = 1;

/** At most this many sound effects at once; a new one stops the oldest (GDD v0.23 §9.5). */
const MAX_VOICES = 16;
/** The same sound started again within this many seconds is skipped (GDD v0.23 §9.5). */
const REPEAT_GUARD_S = 0.033;

function isTrack(track: TrackId): track is Track {
  return Object.values(Track).some((known) => known === track);
}

/** One playing track: its sources (an intro and a loop for the boss) through its own fade. */
interface Playing {
  readonly sources: readonly BufferSourceLike[];
  readonly fade: GainNodeLike;
}

interface Voice {
  source: BufferSourceLike | undefined;
  ui: boolean;
}

/**
 * `AudioPort` on Web Audio (ADR-0009, audio/04-class-audio): silent until the first gesture
 * unlocks it, then the sound table is rendered once by the domain synthesiser. The pause mix
 * stops the game sounds and keeps the menu sounds and ducks the music; a hidden tab suspends the
 * context. The tracks are fetched and decoded at unlock; a track asked for before its files arrive
 * starts when they do, and one that fails to load stays silent.
 */
export class WebAudioPlayer implements AudioPort {
  private readonly createContext: () => AudioContextLike;
  private context: AudioContextLike | undefined;
  private sfxGain: GainNodeLike | undefined;
  /** The music chain: each track's fade → the pause duck → the music volume → the speakers. */
  private musicGain: GainNodeLike | undefined;
  private duckGain: GainNodeLike | undefined;
  private readonly loadFile: LoadAudioFile;
  private readonly trackBuffers = new Map<string, AudioBufferLike>();
  private playing: Playing | undefined;
  private musicVolume = 1;
  private readonly buffers = new Map<SfxId, AudioBufferLike>();
  private readonly lastStart = new Map<SfxId, number>();
  private readonly uiSounds: ReadonlySet<SfxId> = new Set(UI_SOUNDS);
  private readonly voices: Voice[] = Array.from({ length: MAX_VOICES }, () => ({
    source: undefined,
    ui: false,
  }));
  private nextVoice = 0;
  private sfxVolume = 1;
  private paused = false;
  /** The track asked for last: the one playing, or waiting for its files. */
  track: TrackId | null = null;

  constructor(createContext: () => AudioContextLike, loadFile: LoadAudioFile) {
    this.createContext = createContext;
    this.loadFile = loadFile;
  }

  /**
   * Inside a gesture's handler (ADR-0009): creates or resumes the context there, then renders the
   * sound table once. A browser without Web Audio stays silent.
   */
  unlock(): void {
    if (this.context === undefined) {
      try {
        this.context = this.createContext();
      } catch {
        return; // No Web Audio: the game plays silent.
      }
      this.sfxGain = this.context.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.context.destination);
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.context.destination);
      this.duckGain = this.context.createGain();
      this.duckGain.gain.value = this.paused ? DUCK_GAIN : 1;
      this.duckGain.connect(this.musicGain);
      this.loadTracks(this.context);
    }
    this.context.resume().catch(() => undefined);
    if (this.buffers.size === 0) this.render(this.context);
  }

  /** The tab hidden suspends every sound; shown again, it resumes (GDD v0.23 §9.5). */
  setHidden(hidden: boolean): void {
    if (this.context === undefined) return;
    const change = hidden ? this.context.suspend() : this.context.resume();
    change.catch(() => undefined);
  }

  play(sfx: SfxId): void {
    const context = this.context;
    const buffer = this.buffers.get(sfx);
    if (context === undefined || buffer === undefined || this.sfxGain === undefined) return;
    const ui = this.uiSounds.has(sfx);
    if (this.paused && !ui) return;
    const last = this.lastStart.get(sfx);
    if (last !== undefined && context.currentTime - last < REPEAT_GUARD_S) return;
    this.lastStart.set(sfx, context.currentTime);
    const voice = this.voices[this.nextVoice];
    if (voice === undefined) return;
    this.nextVoice = (this.nextVoice + 1) % MAX_VOICES;
    stop(voice);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxGain);
    source.start();
    voice.source = source;
    voice.ui = ui;
  }

  /**
   * A new track replaces the one playing at once; silence (`null`) fades it out over 0.5 s, the
   * boss's warning (GDD v0.23 §6). The same track asked again changes nothing.
   */
  music(track: TrackId | null): void {
    if (track === this.track) return;
    this.track = track;
    this.stopMusic(track === null ? FADE_OUT_S : 0);
    this.startMusic();
  }

  setVolumes(music: number, sfx: number): void {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.sfxGain !== undefined) this.sfxGain.gain.value = sfx;
    if (this.musicGain !== undefined) this.musicGain.gain.value = music;
  }

  /**
   * Paused: the game sounds stop, the menu sounds play on, the music ducks to −12 dB over 150 ms;
   * resumed, it returns over the 1 s count-in (ADR-0009 decision 3).
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (this.context !== undefined && this.duckGain !== undefined) {
      ramp(this.duckGain, paused ? DUCK_GAIN : 1, paused ? DUCK_S : UNDUCK_S, this.context);
    }
    if (!paused) return;
    for (let i = 0; i < this.voices.length; i += 1) {
      const voice = this.voices[i];
      if (voice !== undefined && !voice.ui) stop(voice);
    }
  }

  /** Fetches and decodes every track file once; a failure leaves that track silent. */
  private loadTracks(context: AudioContextLike): void {
    const tracks = Object.values(TRACK_FILES);
    for (let i = 0; i < tracks.length; i += 1) {
      const files = tracks[i] ?? [];
      for (let j = 0; j < files.length; j += 1) {
        const file = files[j];
        if (file !== undefined) void this.loadTrackFile(context, file);
      }
    }
  }

  private async loadTrackFile(context: AudioContextLike, file: string): Promise<void> {
    try {
      const buffer = await context.decodeAudioData(await this.loadFile(file));
      this.trackBuffers.set(file, buffer);
      this.startMusic();
    } catch {
      // Not fetched or not decoded: that track stays silent, the game plays on.
    }
  }

  /** Starts the track asked for, unless one is playing or its files have not all arrived. */
  private startMusic(): void {
    const context = this.context;
    const track = this.track;
    if (context === undefined || this.duckGain === undefined || this.playing !== undefined) return;
    if (track === null || !isTrack(track)) return;
    const files = TRACK_FILES[track];
    const buffers: AudioBufferLike[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const buffer = this.trackBuffers.get(files[i] ?? '');
      if (buffer === undefined) return;
      buffers.push(buffer);
    }
    const fade = context.createGain();
    fade.connect(this.duckGain);
    const sources: BufferSourceLike[] = [];
    let when = context.currentTime;
    for (let i = 0; i < buffers.length; i += 1) {
      const buffer = buffers[i];
      if (buffer === undefined) continue;
      const source = context.createBufferSource();
      source.buffer = buffer;
      // The last file loops, the boss's intro and the jingles do not (GDD v0.23 §9.5).
      source.loop = i === buffers.length - 1 && !JINGLES.includes(track);
      source.connect(fade);
      source.start(when);
      when += buffer.duration;
      sources.push(source);
    }
    this.playing = { sources, fade };
  }

  /** Stops the track playing, at once or after a fade of `fadeS` seconds. */
  private stopMusic(fadeS: number): void {
    const playing = this.playing;
    const context = this.context;
    this.playing = undefined;
    if (playing === undefined || context === undefined) return;
    if (fadeS > 0) ramp(playing.fade, 0, fadeS, context);
    for (let i = 0; i < playing.sources.length; i += 1) {
      try {
        playing.sources[i]?.stop(context.currentTime + fadeS);
      } catch {
        // Already ended (a jingle): nothing to stop.
      }
    }
  }

  private render(context: AudioContextLike): void {
    const ids = Object.values(Sfx);
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      if (id === undefined) continue;
      const samples = renderSfx(SFX_TABLE[id], context.sampleRate);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(id, buffer);
    }
  }
}

/** Ramps a gain to `target` over `seconds` from its current value. */
function ramp(
  node: GainNodeLike,
  target: number,
  seconds: number,
  context: AudioContextLike,
): void {
  const now = context.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(node.gain.value, now);
  node.gain.linearRampToValueAtTime(target, now + seconds);
}

/** Stops a voice's source; a source that already ended may throw on old engines. */
function stop(voice: Voice): void {
  const source = voice.source;
  voice.source = undefined;
  if (source === undefined) return;
  try {
    source.stop();
  } catch {
    // Already ended: nothing to stop.
  }
}
