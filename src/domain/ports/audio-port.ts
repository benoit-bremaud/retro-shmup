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
  /** Paused: music ducked to −12 dB over 150 ms, game sounds stopped, UI sounds kept. */
  setPaused(paused: boolean): void;
}
