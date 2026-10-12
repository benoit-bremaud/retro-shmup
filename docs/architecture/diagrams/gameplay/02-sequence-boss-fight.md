# Sequence diagram — gameplay — a boss fight to the results (1.0)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.10 §4.5,
> §6, §6.1, §7.2.2, §8, §9.1, §9.2, §9.4
> **Related ADRs**: ADR-0002 (fixed step order), ADR-0010 (bus per run, time scale), ADR-0022
> (`startBoss`, `damageBoss`, boss and level events, `LevelTally`, `Results`)
> **Realizes**: UC1 steps 7–9 and extension 8a of [01-use-case](../system/01-use-case.md); the
> transitions of [05-state-boss](05-state-boss.md); classes of
> [04-class-domain](04-class-domain.md); the `Results` scene of
> [05-state-scenes](../meta/05-state-scenes.md)

## Context

The end of a level across many steps: the director reaches `warningAt` and starts the boss, the
boss warns and enters, shots damage it through `damageBoss` until its thresholds and its 0 HP, its
dying sequence ends the level, the tally is added and the scene machine shows the results. Inside
one step the fixed order of [04-class-domain](04-class-domain.md) holds; a bomb on the boss follows
[02-sequence-bomb](02-sequence-bomb.md) into `damageBoss`.

## Diagram

```mermaid
---
title: sd — a boss fight to the results
---
sequenceDiagram
  autonumber
  participant SM as SceneMachine
  participant Run as Run
  participant Rules as RunRules
  participant LD as LevelDirector
  participant W as World
  participant Bo as Boss
  participant CR as CollisionResolver
  participant Bus as EventBus
  participant SK as ScoreKeeper and LevelTally
  participant P as RunPresenter

  Note over LD: the step that reaches warningAt (120 s in level 1)
  Run->>LD: tick(run.rules as EnemySpawner)
  LD->>Rules: startBoss(LevelScript.boss)
  Rules->>Bo: start(definition) — state WARNING
  Rules->>Bus: publish BOSS_WARNING
  Note over LD: no spawn from now on — enemies on the field live on
  Note over Bo: 3 s later ENTERING — slides to (120, 56) in 3 s, then FIGHTING with timeLeft = 90 s
  Note over P: WARNING banner while the snapshot says WARNING — HP bar and seconds from ENTERING

  loop each step while FIGHTING
    Run->>W: moveEnemies(dt) — the boss phase movement and attack act
    Run->>CR: resolve(world, run.rules as HitRules)
    Note over CR: pass 1 — a player bullet meets the boss, nearest along its path
    CR->>Rules: damageBoss(bullet damage)
    Rules->>Bo: applyDamage
    Rules->>Bus: publish ENEMY_HIT (subject = boss serial)
    Bus->>P: white flash on the boss
    opt [another phase follows and hp ≤ its threshold] — repeated per threshold crossed
      Rules->>Bo: phaseIndex += 1 — swap the phase strategies
      Rules->>Bus: publish BOSS_PHASE_CHANGED (detail = phase)
      Bus->>P: debris where the part broke off
    end
    Rules->>Bo: advance timers — timeLeft −= 1 (step 7)
  end

  alt [hp ≤ 0]
    Rules->>W: cancelEnemyBullets()
    Rules->>Bo: state DESTROYED — harmless
    Rules->>Bus: publish BOSS_DESTROYED (value = seconds left)
    Bus->>SK: score += 10 000 + 100 × value — flat, chain untouched
    Bus->>P: boss explosion, slow motion 0.5 s if enabled
    Note over Bo: 2 s of steps — the ship keeps its control
  else [timeLeft = 0 and hp > 0]
    Rules->>W: cancelEnemyBullets()
    Rules->>Bo: state FLEEING — harmless, up at 60 px/s
    Rules->>Bus: publish BOSS_FLED
    Note over Bo: until its box is fully above the field
  end

  Note over Run: step 8 — the sequence has ended and the ship is not Dead
  Run->>W: spendPlayerBullets()
  Run->>Bo: state IDLE
  Run->>Rules: levelCleared()
  Rules->>Bus: publish LEVEL_CLEARED (value = bombs left)
  Bus->>SK: tally.bombsLeft = value, then score += tally.total() — flat
  Note over Run: outcome RUN_CLEARED (last level of the list) or LEVEL_CLEARED

  SM->>Run: outcome()
  Run-->>SM: RUN_CLEARED
  Note over SM: enter Results — the run frozen, the starfield scrolling
  SM->>Run: tally()
  Run-->>SM: formations, bomb used, life lost, bombs left, total
  Note over SM: one line every 0.5 s — leave by confirm or tap after 1 s, or after 8 s
  Note over SM: slice — Results then Title (1.0 — Ending, or the next level card)
```

## Notes

- **Where the tally comes from**: `LevelTally` is fed during the whole level by its
  subscriptions — `FORMATION_CLEARED` (+1, bomb kills included, 02-sequence-enemy-destroyed),
  `BOMB_USED` (02-sequence-bomb), `PLAYER_DIED` (02-sequence-player-hit; a shield absorb
  publishes `PLAYER_HIT` and keeps the no-miss) — and closed by `LEVEL_CLEARED`. It is reset when
  the next level starts.
- **Only `FIGHTING` takes damage**: `damageBoss` is reached only from pass 1 while the boss is
  `FIGHTING` and from a bomb in `FIGHTING`; one bomb crossing two thresholds publishes two
  `BOSS_PHASE_CHANGED`. Pass 3 tests the boss body against the ship in `ENTERING` and
  `FIGHTING`, through `HitRules.playerDied` like any body (02-sequence-player-hit).
- **Order at the end**: the boss events are published inside `damageBoss` (step 5) or at the
  timer's expiry (step 7); `LEVEL_CLEARED` at step 8, after the sequence, so the score shown by
  the results already includes the boss bonus and the tally. A level end is deferred while the
  ship is `Dead`; a final death sets `GAME_OVER`, which wins.
- **Determinism**: every boss pattern is a function of its body, its volley count and the ship's
  position (ADR-0022); no random draw. The slow motion is a time scale in the loop (ADR-0010): it
  delays steps, never changes them.
- **Interim (F-2, before F-3)**: no tally and no `Results` yet; `RUN_CLEARED` shows a "LEVEL
  CLEAR" banner for 3 s, then the title (meta/05-state-scenes, level brick additions).
