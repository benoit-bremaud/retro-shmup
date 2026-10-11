import { L1_SHOT } from '../../src/domain/game/tuning';

/**
 * HP and damage in level-1 shots, as the GDD writes them; the code holds tenths (ADR-0019:
 * tests never write raw tenths).
 */
export function shots(n: number): number {
  return Math.round(n * L1_SHOT);
}
