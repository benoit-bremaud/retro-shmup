import { describe, expect, it } from 'vitest';
import { NoAttack } from '../../src/domain/game/attacks';
import { BossState } from '../../src/domain/game/boss';
import { CRUISER } from '../../src/domain/game/cruiser';
import { POPCORN } from '../../src/domain/game/enemy';
import { GameEventKind } from '../../src/domain/game/events';
import { swayMovement } from '../../src/domain/game/movements';
import { HitOutcome, PlayerState } from '../../src/domain/game/player';
import type { Player } from '../../src/domain/game/player';
import { Run, RunOutcome } from '../../src/domain/game/run';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { shots } from '../support/shots';
import { testScript } from '../support/script';

const DT = 1 / 60;

function frame(pressed = 0): IntentFrame {
  const intents = createIntentFrame();
  intents.pressed = pressed;
  return intents;
}

/** A Popcorn formation of 5 down the centre (`paysP` as the row's flag), then a quiet Cruiser at 8 s. */
function tallyRun(paysP?: boolean): Run {
  return new Run({
    levels: [
      testScript(
        [
          {
            at: 0,
            archetype: POPCORN,
            count: 5,
            interval: 0.2,
            spawn: { x: 120, y: -8 },
            // Absent means paying (GDD v0.12): never assign undefined to the optional flag.
            ...(paysP === undefined ? {} : { paysP }),
          },
        ],
        {
          warningAt: 8,
          boss: {
            ...CRUISER,
            phases: [
              {
                hpThreshold: CRUISER.stats.hp,
                movement: swayMovement({ amplitude: 0, periodS: 8 }),
                attack: NoAttack,
              },
            ],
          },
        },
      ),
    ],
  });
}

describe('Run — the tally through a level (GDD v0.10 §8, ADR-0022 decision 7)', () => {
  it('starts with the no-bomb and no-miss lines kept, read through RunView.tally()', () => {
    const run = tallyRun();
    expect(run.tally().total()).toBe(15000);
    expect(run.tally()).toBe(run.tally()); // the same view every call: no allocation
  });

  it('counts a bomb-cleared formation, the bomb, a death and the bombs left; adds the total flat', () => {
    const run = tallyRun();
    const cleared = { formations: 0, levelScore: -1 };
    run.events().subscribe(GameEventKind.FormationCleared, () => {
      cleared.formations += 1;
    });
    // Every member on the field, then the bomb completes the formation.
    for (let i = 0; i < 90; i += 1) run.step(DT, frame());
    run.step(DT, frame(Button.Bomb));
    expect(cleared.formations).toBe(1);
    // The bomb's protection over, a hit with no shield loses a life, reported as the collision
    // resolver does (a test seam: the live player behind the snapshot).
    for (let i = 0; i < 90; i += 1) run.step(DT, frame());
    expect((run.snapshot().player as Player).hit()).toBe(HitOutcome.Died);
    run.rules.playerDied();
    expect(run.snapshot().player.state).toBe(PlayerState.Dead);
    for (let i = 0; i < 20000 && run.snapshot().boss.state !== BossState.Fighting; i += 1) {
      run.step(DT, frame());
    }
    const beforeKill = run.snapshot().score;
    run.rules.damageBoss(shots(1450)); // the Cruiser's 1 450 shots (GDD v0.12 §6.1)
    const withBossBonus = run.snapshot().score;
    expect(withBossBonus - beforeKill).toBeGreaterThanOrEqual(10000);
    run.events().subscribe(GameEventKind.LevelCleared, () => {
      cleared.levelScore = run.snapshot().score;
    });
    for (let i = 0; i < 120; i += 1) run.step(DT, frame());
    expect(run.outcome()).toBe(RunOutcome.RunCleared);
    const tally = run.tally();
    expect([tally.formationsCleared, tally.bombUsed, tally.lifeLost, tally.bombsLeft]).toEqual([
      1,
      true,
      true,
      2,
    ]);
    expect(tally.total()).toBe(500 + 2 * 1000);
    expect(run.snapshot().score).toBe(withBossBonus + 2500);
    expect(cleared.levelScore).toBe(withBossBonus + 2500);
  });

  it('counts a formation that pays no P like any other: cleared, in the tally, no pickup', () => {
    const run = tallyRun(false);
    let cleared = 0;
    run.events().subscribe(GameEventKind.FormationCleared, () => {
      cleared += 1;
    });
    for (let i = 0; i < 90; i += 1) run.step(DT, frame());
    run.step(DT, frame(Button.Bomb));
    expect(cleared).toBe(1);
    expect(run.tally().formationsCleared).toBe(1);
    expect(run.snapshot().pickups.count).toBe(0);
    // The control: the same formation with the P paid (the flag absent) drops it.
    const paying = tallyRun();
    for (let i = 0; i < 90; i += 1) paying.step(DT, frame());
    paying.step(DT, frame(Button.Bomb));
    expect(paying.tally().formationsCleared).toBe(1);
    expect(paying.snapshot().pickups.count).toBe(1);
  });
});
