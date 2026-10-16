import { SeededRandom } from '../random/seeded-random';

/** The four waves of the synthesiser (GDD v0.23 §9.5). */
export const Wave = {
  Square: 0,
  Saw: 1,
  Sine: 2,
  Noise: 3,
} as const;
export type Wave = (typeof Wave)[keyof typeof Wave];

/**
 * One sound effect as data (audio/04-class-audio): an sfxr-style row. Times are in seconds,
 * frequencies in hertz; `slide` is the frequency change per second (negative falls), `duty` the
 * square's high fraction, `lowPass` a one-pole smoothing factor in (0, 1] (1 = off).
 */
export interface SfxParams {
  readonly wave: Wave;
  readonly frequency: number;
  readonly slide: number;
  readonly duty: number;
  readonly vibratoDepth: number;
  readonly vibratoRate: number;
  readonly attack: number;
  readonly sustain: number;
  readonly decay: number;
  readonly lowPass: number;
  readonly gain: number;
  /** The noise seed: a constant per row, never the run's stream (ADR-0002). */
  readonly seed: number;
}

/** Below this frequency the slide stops: a falling sound never turns into a click train. */
const MIN_FREQUENCY = 20;
/** The noise holds one random value per wave period, as sfxr does: pitch still shapes it. */
const NOISE_STEPS_PER_PERIOD = 8;

/**
 * Renders a row into samples in [−1, 1] at `sampleRate` (GDD v0.23 §9.5). Pure and deterministic:
 * the same row gives the same samples. Called once per row when audio unlocks, never in the loop.
 */
export function renderSfx(
  params: Readonly<SfxParams>,
  sampleRate: number,
): Float32Array<ArrayBuffer> {
  const duration = params.attack + params.sustain + params.decay;
  const samples = new Float32Array(Math.max(1, Math.round(duration * sampleRate)));
  const random = new SeededRandom(params.seed);
  const dt = 1 / sampleRate;
  let phase = 0;
  let noise = 0;
  let noiseStep = -1;
  let filtered = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const t = i * dt;
    const vibrato = 1 + params.vibratoDepth * Math.sin(2 * Math.PI * params.vibratoRate * t);
    const frequency = Math.max(MIN_FREQUENCY, params.frequency + params.slide * t) * vibrato;
    phase = (phase + frequency * dt) % 1;
    const step = Math.floor(phase * NOISE_STEPS_PER_PERIOD);
    if (step !== noiseStep) {
      noiseStep = step;
      noise = random.next() * 2 - 1;
    }
    const raw = waveAt(params.wave, phase, params.duty, noise);
    filtered += (raw - filtered) * params.lowPass;
    samples[i] = filtered * envelope(params, t) * params.gain;
  }
  return samples;
}

function waveAt(wave: Wave, phase: number, duty: number, noise: number): number {
  switch (wave) {
    case Wave.Square:
      return phase < duty ? 1 : -1;
    case Wave.Saw:
      return 2 * phase - 1;
    case Wave.Sine:
      return Math.sin(2 * Math.PI * phase);
    case Wave.Noise:
      return noise;
  }
}

/** Attack rises from 0, sustain holds 1, decay falls back to 0 at the end. */
function envelope(params: Readonly<SfxParams>, t: number): number {
  if (t < params.attack) return t / params.attack;
  const afterSustain = t - params.attack - params.sustain;
  if (afterSustain <= 0) return 1;
  return params.decay > 0 ? Math.max(0, 1 - afterSustain / params.decay) : 0;
}
