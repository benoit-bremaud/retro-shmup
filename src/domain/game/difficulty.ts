/**
 * The knobs of a run (GDD §10, ADR-0019): the player-kit brick reads this subset of the 1.0
 * `DifficultyProfile`; the other knobs and the Easy and Hard profiles come with the options.
 */
export interface DifficultyProfile {
  /** Lives at the start of a run, the ship in play included (GDD §4.4). */
  readonly lives: number;
  /** Bombs given at the start and after each death (GDD §4.5). */
  readonly bombsPerLife: number;
  /** Scales every drop rate (GDD §5.2). */
  readonly dropRateScale: number;
}

/** The Normal profile, the only one in 1.0 (GDD §10); Easy and Hard are a 1.x data line each. */
export const NORMAL: DifficultyProfile = {
  lives: 3,
  bombsPerLife: 2,
  dropRateScale: 1,
};
