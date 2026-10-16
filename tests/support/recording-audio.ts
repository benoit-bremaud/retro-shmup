import type { AudioPort, SfxId, TrackId } from '../../src/domain/ports/audio-port';

/** An `AudioPort` that records every call, for tests at the port (ADR-0003). */
export class RecordingAudio implements AudioPort {
  readonly played: SfxId[] = [];
  readonly paused: boolean[] = [];
  readonly tracks: (TrackId | null)[] = [];
  volumes: [number, number] | undefined;

  play(sfx: SfxId): void {
    this.played.push(sfx);
  }
  music(track: TrackId | null): void {
    this.tracks.push(track);
  }
  setVolumes(music: number, sfx: number): void {
    this.volumes = [music, sfx];
  }
  setPaused(paused: boolean): void {
    this.paused.push(paused);
  }
}
