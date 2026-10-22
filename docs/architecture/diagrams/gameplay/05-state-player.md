# State machine diagram — gameplay — the player ship (1.0)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.8 §4.1,
> §4.4, §4.5, §4.6
> **Related ADRs**: ADR-0002 (timers counted in simulation steps), ADR-0019 (a duration per
> cause, `useBomb`, `ABSORBED`)
> **Realizes**: the `PlayerState` of [04-class-domain](04-class-domain.md); the timing side of
> [02-sequence-player-hit](02-sequence-player-hit.md)

## Context

The lifecycle of the player's ship within one run: when it can be hit, when it can act, and how
a life and the run end. The `Player` object lives as long as the `Run`; levels do not recreate
it. Durations are GDD *(initial)* values counted in simulation steps, so they are deterministic
and frozen by the pause. Notation: `trigger [guard] / effect`; `after(d)` is a time trigger.

## Diagram

```mermaid
---
title: stm — the player ship
---
stateDiagram-v2
  direction LR
  state "Entering — fly-in, no control" as Entering
  state "Invulnerable — control, timer" as Invulnerable
  state "Vulnerable — control" as Vulnerable
  state "Dead — explosion, no control" as Dead

  [*] --> Entering : run starts
  Entering --> Invulnerable : after(fly-in 0.5 s) / timer = 1.5 s
  Invulnerable --> Vulnerable : timer elapsed
  Vulnerable --> Invulnerable : hit [shield] / ABSORBED, timer = 0.5 s, blink restarts
  Vulnerable --> Invulnerable : bomb pressed [bombs > 0] / bombs − 1, timer = 1 s
  Invulnerable --> Invulnerable : bomb pressed [bombs > 0] / bombs − 1, timer = max(timer, 1 s)
  Vulnerable --> Dead : hit [no shield] / DIED, death effects at once
  Dead --> Entering : after(1.5 s) [lives > 0]
  Dead --> [*] : after(1.5 s) [lives = 0] / final death, read by Run at step 8
  Vulnerable --> Entering : next level starts
  Invulnerable --> Entering : next level starts
  Entering --> Entering : next level starts
```

## Notes

- **The 2 s of respawn invulnerability** (GDD §4.1) are split: the fly-in without control, then
  `Invulnerable` with control. The same entry runs at the start of every level (GDD v0.4 §4.1).
- **One timer**: `stateSteps` counts down by 1 each step in every timed state (`Entering`,
  `Invulnerable`, `Dead`); durations come from GDD §4.1 converted to whole steps once, at load
  (ADR-0002: the simulation sees `dt` and a step counter). `max(timer, 1 s)` on a bomb applies to
  it.
- **Fly-in** (positions: GDD v0.5 §4.1): linear, from the start point to the resting point over
  the `Entering` steps; no fire and no clamp to the field while `Entering`. Both positions are set
  together at the start, so the interpolation never draws a smear (ADR-0002). The weapon's
  cooldown is 0 when `Entering` ends, so the first shot is immediate.
- **Blink** (rate and phase: GDD v0.5 §4.1) while `Entering` or `Invulnerable`: the phase comes
  from a continuous count of steps since the protection began (fly-in, or invulnerability entered
  from `Vulnerable`). `Entering --> Invulnerable` and a bomb's `max(timer, 1 s)` keep the count;
  `stateSteps` is not used for it, since it restarts. The `Player` exposes the count in the
  snapshot; the presenter derives the blink from it, not from wall time, so it freezes with the
  pause and stays deterministic (ADR-0010).
- **Hits are ignored** in `Entering`, `Invulnerable` and `Dead` (`HitOutcome.IGNORED`): bullets and
  bodies pass through. In `Dead` this guarantees at most one life lost per step.
- **Bombs** work in `Vulnerable` and `Invulnerable` only (GDD v0.8 §4.5): a press while
  `Entering` or `Dead`, after Game over (the ship stays `Dead`) or with an empty stock does
  nothing, and the pause never steps the run. One bomb per press. They never shorten an ongoing
  invulnerability (`max`). `Player.useBomb()` holds the guard; the run applies the effect at step
  slot 3 (02-sequence-bomb), so the new state already holds for that step's collisions.
- **A timer per cause** (ADR-0019): the one `stateSteps` timer is set with the duration of what
  caused the state — fly-in 0.5 s, respawn invulnerability 1.5 s, shield 0.5 s, bomb
  max(time left, 1 s), death sequence 1.5 s.
- **Pickups** (GDD v0.8 §4.6) are collected in `Entering`, `Invulnerable` and `Vulnerable`, never
  in `Dead` (`Player.canCollect()`); pass 4 of the collisions runs after the hazards, so a ship
  entering `Dead` in a step collects nothing in it, and after Game over pickups fall past the
  missing ship.
- **Shield** (GDD v0.8 §4.4): a charge is held in any state and kept until used; only a hit in
  `Vulnerable` consumes it, since the other states ignore hits. The absorbed hit restarts the
  blink count, unlike the bomb from `Invulnerable`.
- **A life is lost on the transition to `Dead`**: lives −1, bombs reset to `bombsPerLife`, weapon
  back to the Spread at level 1 with no pickup released (GDD v0.29 §4.4, #130; v0.8: power −1 with
  a release), chain reset — all at the death step, so the HUD shows them during the explosion
  (GDD v0.8 §4.4); see the sequence diagram.
- **Game over after the explosion** (GDD v0.4 §4.4): the `Player` holds no reference to the run;
  when the death sequence ends with no life left, `Run` reads it at step 8 of `Run.step` and sets
  the outcome to `GAME_OVER`; the scene machine then shows Game over.
- **Dying while the boss ends**: the player's last shots can destroy the boss (or its timer can
  run out) while the ship is `Dead`. The level end is then **deferred** until the death sequence
  ends: with lives left the level ends normally and the next level starts at `Entering`; with no
  life left `GAME_OVER` wins (04-class-domain, step 8). A death can no longer start during the
  boss's own sequence, since enemy bullets are cancelled (GDD v0.4 §6).
- **Pause** freezes every timer: the run is not stepped while paused (02-sequence-fixed-step-tick).
