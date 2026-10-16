import { Sfx, SFX_TABLE, UI_SOUNDS } from '../domain/audio/sfx';
import { renderSfx } from '../domain/audio/synth';
import type { AudioPort, SfxId, TrackId } from '../domain/ports/audio-port';

/**
 * The parts of Web Audio this adapter uses, injected so tests run without a browser (as
 * `InputEnvironment`, ADR-0015 decision 4): a gain's value.
 */
export interface AudioParamLike {
  value: number;
}
/** A node that feeds another. */
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): void;
}
/** A volume control: the sound-effects bus. */
export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}
/** Rendered samples, filled once at unlock. */
export interface AudioBufferLike {
  copyToChannel(source: Float32Array<ArrayBuffer>, channel: number): void;
}
/** One playing sound effect: single-use, as in Web Audio. */
export interface BufferSourceLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  start(): void;
  stop(): void;
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
}

/** At most this many sound effects at once; a new one stops the oldest (GDD v0.23 §9.5). */
const MAX_VOICES = 16;
/** The same sound started again within this many seconds is skipped (GDD v0.23 §9.5). */
const REPEAT_GUARD_S = 0.033;

interface Voice {
  source: BufferSourceLike | undefined;
  ui: boolean;
}

/**
 * `AudioPort` on Web Audio (ADR-0009, audio/04-class-audio): silent until the first gesture
 * unlocks it, then the sound table is rendered once by the domain synthesiser. The pause mix
 * stops the game sounds and keeps the menu sounds; a hidden tab suspends the context. Music joins
 * in G3-2: until then `music` only remembers the track.
 */
export class WebAudioPlayer implements AudioPort {
  private readonly createContext: () => AudioContextLike;
  private context: AudioContextLike | undefined;
  private sfxGain: GainNodeLike | undefined;
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
  /** The track asked for last; played from G3-2. */
  track: TrackId | null = null;

  constructor(createContext: () => AudioContextLike) {
    this.createContext = createContext;
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

  music(track: TrackId | null): void {
    this.track = track;
  }

  setVolumes(_music: number, sfx: number): void {
    this.sfxVolume = sfx;
    if (this.sfxGain !== undefined) this.sfxGain.gain.value = sfx;
  }

  /** Paused: the game sounds stop, the menu sounds play on (ADR-0009 decision 3). */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) return;
    for (let i = 0; i < this.voices.length; i += 1) {
      const voice = this.voices[i];
      if (voice !== undefined && !voice.ui) stop(voice);
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
