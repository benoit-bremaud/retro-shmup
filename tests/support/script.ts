import { NoAttack } from '../../src/domain/game/attacks';
import type { BossDefinition } from '../../src/domain/game/boss';
import { SizeTier } from '../../src/domain/game/enemy';
import type { LevelScript, ScriptEvent } from '../../src/domain/game/level-script';
import { swayMovement } from '../../src/domain/game/movements';
import { PickupKind } from '../../src/domain/game/pickup';

/** A warning far beyond any test run: the short scripts of the tests never reach their boss. */
const FAR_WARNING_AT = 100000;

/** A boss with one phase, no attack and 5 shots of HP: a placeholder for scripts that never reach it. */
export const STUB_BOSS: BossDefinition = {
  stats: { hp: 50, width: 112, height: 48, score: 0, tier: SizeTier.Large },
  phases: [
    { hpThreshold: 50, movement: swayMovement({ amplitude: 56, periodS: 8 }), attack: NoAttack },
  ],
  timeLimit: 90,
  warningS: 3,
  entryFrom: { x: 120, y: -24 },
  entryTo: { x: 120, y: 56 },
  entryS: 3,
  fleeSpeed: 60,
  destroyedS: 2,
};

/**
 * A level script for a test: the given rows, a far `warningAt` and a stub boss, with any field
 * overridden. Keeps the tests' scripts valid as `LevelScript` grows.
 */
export function testScript(
  events: readonly ScriptEvent[] = [],
  overrides: Partial<LevelScript> = {},
): LevelScript {
  return {
    events,
    warningAt: FAR_WARNING_AT,
    boss: STUB_BOSS,
    dominantColour: PickupKind.PRed,
    ...overrides,
  };
}
