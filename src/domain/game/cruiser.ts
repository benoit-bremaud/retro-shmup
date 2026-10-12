import { fanAttack, ringAttack, sequenceAttack } from './attacks';
import type { BossDefinition, BrokenPart } from './boss';
import { SizeTier } from './enemy';
import { swayMovement } from './movements';
import { CruiserTuning } from './tuning';

const PHASE_1 = CruiserTuning.phase1;
const PHASE_2 = CruiserTuning.phase2;

// The inner periods are ignored by `sequenceAttack` (ADR-0023): the sequence's own period rules.
const INNER_PERIOD = 1;

const PHASE_1_FAN = fanAttack({
  count: PHASE_1.fanCount,
  spreadDeg: PHASE_1.fanSpreadDegrees,
  periodS: INNER_PERIOD,
  speed: PHASE_1.fanSpeed,
});

// The phase-1 ring does not turn: its first bullet points straight down (GDD v0.10 §6.1).
const PHASE_1_RING = ringAttack({
  count: PHASE_1.ringCount,
  periodS: INNER_PERIOD,
  speed: PHASE_1.ringSpeed,
  rotateDeg: 0,
});

const PHASE_2_RING = ringAttack({
  count: PHASE_2.ringCount,
  periodS: INNER_PERIOD,
  speed: PHASE_2.ringSpeed,
  rotateDeg: PHASE_2.ringRotateDegrees,
});

const PHASE_2_TRIPLE = fanAttack({
  count: PHASE_2.tripleCount,
  spreadDeg: PHASE_2.tripleSpreadDegrees,
  periodS: INNER_PERIOD,
  speed: PHASE_2.tripleSpeed,
});

/**
 * The forward turret that breaks off at phase 2: a placeholder box until the sprite lands. The
 * definition holds it for the debris effect (F-2c); the presenter draws it until it breaks.
 */
export const CRUISER_TURRET: BrokenPart = { offsetX: 0, offsetY: 16, width: 24, height: 16 };

/**
 * Level 1's boss (GDD v0.10 §6.1, initial; 05-state-boss, the Cruiser table): alone, 112 × 48, 300
 * level-1 shots. Phase 1 sways ±56 over 8 s and alternates a fan aimed at the ship with a ring, one
 * volley a second; from 66 % HP phase 2 sways ±72 over 6 s, fires a turning ring every 1.5 s and an
 * aimed triple on every second volley. Its box never goes below y 80.
 */
export const CRUISER: BossDefinition = {
  stats: {
    hp: CruiserTuning.hp,
    width: CruiserTuning.width,
    height: CruiserTuning.height,
    // Boss hits score nothing; the bonus is paid on its destruction (GDD v0.10 §6).
    score: 0,
    tier: SizeTier.Large,
  },
  phases: [
    {
      hpThreshold: CruiserTuning.hp,
      movement: swayMovement({
        amplitude: PHASE_1.swayAmplitude,
        periodS: PHASE_1.swayPeriodSeconds,
      }),
      attack: sequenceAttack([[PHASE_1_FAN], [PHASE_1_RING]], PHASE_1.volleyPeriodSeconds),
    },
    {
      hpThreshold: CruiserTuning.phase2HpThreshold,
      movement: swayMovement({
        amplitude: PHASE_2.swayAmplitude,
        periodS: PHASE_2.swayPeriodSeconds,
      }),
      attack: sequenceAttack(
        [[PHASE_2_RING], [PHASE_2_RING, PHASE_2_TRIPLE]],
        PHASE_2.volleyPeriodSeconds,
      ),
      brokenPart: CRUISER_TURRET,
    },
  ],
  timeLimit: CruiserTuning.timeLimitSeconds,
  warningS: CruiserTuning.warningSeconds,
  entryFrom: { x: 120, y: CruiserTuning.entryFromY },
  entryTo: { x: 120, y: CruiserTuning.entryToY },
  entryS: CruiserTuning.entrySeconds,
  fleeSpeed: CruiserTuning.fleeSpeed,
  destroyedS: CruiserTuning.destroyedSeconds,
};
