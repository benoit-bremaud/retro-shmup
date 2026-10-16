/** Key of a sound effect; the adapter knows which ones are UI sounds (ADR-0009). */
export type SfxId = string;

/** Key of a music track. */
export type TrackId = string;

/** Sound output of the game (ADR-0009). */
export interface AudioPort {
  play(sfx: SfxId): void;
  music(track: TrackId | null): void;
  /** Linear gains in [0, 1], from the options. */
  setVolumes(music: number, sfx: number): void;
  /**
   * Paused: music ducked to −12 dB over 150 ms, game sounds stopped, UI sounds kept.
   * Resumed: the music returns over the 1 s count-in.
   */
  setPaused(paused: boolean): void;
}

/** The silence: what a scene or a presenter plays through when no audio is wired (tests, boot). */
export const SILENT_AUDIO: AudioPort = {
  play: () => undefined,
  music: () => undefined,
  setVolumes: () => undefined,
  setPaused: () => undefined,
};
