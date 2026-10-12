import { BossState } from '../../src/domain/game/boss';
import type { BossSnapshot } from '../../src/domain/game/run';

/** A boss view with no boss in play, for the tests that build a `WorldSnapshot` by hand. */
export const IDLE_BOSS: BossSnapshot = {
  serial: 0,
  state: BossState.Idle,
  position: { x: 120, y: -24 },
  previousPosition: { x: 120, y: -24 },
  width: 112,
  height: 48,
  hpRatio: 1,
  secondsLeft: 90,
  phase: 0,
  stateSteps: 0,
};
