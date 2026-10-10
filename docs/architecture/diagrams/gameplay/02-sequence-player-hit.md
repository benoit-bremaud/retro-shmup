# Sequence diagram — gameplay — the player is hit (1.0)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.4 §4.1,
> §4.4, §4.6, §5.2, §8
> **Related ADRs**: ADR-0002 (pools), ADR-0010 (bus per run, handler rules)
> **Realizes**: UC1 extensions 5b, 5c and 5c1 of [01-use-case](../system/01-use-case.md);
> lifecycle in [05-state-player](05-state-player.md)

## Context

What happens when an enemy bullet or an enemy or boss body overlaps the player's 4 × 4 hitbox,
with every branch of GDD §4.4: ignored, absorbed by a shield charge, or a life lost with the
power penalty and its release. The timing — invulnerability, respawn, Game over at the end of
the death sequence — belongs to the player's state machine.

## Diagram

```mermaid
---
title: sd — the player is hit
---
sequenceDiagram
  autonumber
  participant Run as Run
  participant CR as CollisionResolver
  participant Pl as Player
  participant Wp as Weapon
  participant W as World
  participant Bus as EventBus
  participant SK as ScoreKeeper
  participant P as RunPresenter

  Run->>CR: resolve(world, run as HitRules)
  Note over CR: enemy bullet or body overlaps the player hitbox
  CR->>Pl: hit()
  alt [Entering, Invulnerable or Dead]
    Pl-->>CR: IGNORED
    Note over CR: the bullet passes through — not released
  else [Vulnerable, shield held]
    Note over Pl: shield = false, Invulnerable for 0.5 s
    Pl-->>CR: ABSORBED
    Note over CR: the bullet's spent = true, released at step 6 (a body is unaffected)
    CR->>Bus: publish PLAYER_HIT (detail = absorbed)
    Bus->>P: shield break effect and SFX
  else [Vulnerable, no shield]
    Note over Pl: lives −= 1, state Dead
    Pl-->>CR: DIED
    Note over CR: the bullet's spent = true, released at step 6 (a body is unaffected)
    CR->>Run: playerDied()
    Note over Run: bombs = DifficultyProfile.bombsPerLife
    Run->>Wp: powerDown()
    Wp-->>Run: powerDropped — true if the level dropped, false at level 1
    opt [powerDropped]
      Run->>W: spawn P pickup of the current weapon colour at the death position
      Run->>Bus: publish PICKUP_SPAWNED (detail = kind)
    end
    Run->>Bus: publish PLAYER_DIED
    activate Bus
    Bus->>SK: chain reset to ×1, tally.lifeLost = true
    Bus->>P: explosion, death SFX, shake if enabled
    deactivate Bus
  end
```

## Notes

- **At most one non-ignored outcome per step**: once the ship is `Dead` every further hit in the
  same step — a second bullet, a body — returns `IGNORED`, so two lives can never be lost at once.
- **Invulnerable means untouchable** (GDD v0.4 §4.1): bullets and bodies pass through an
  entering, invulnerable or dead ship; only a hit that counts consumes the bullet.
- **Game over is not decided here**: the hit always returns `DIED`; when the death sequence ends,
  `05-state-player` either respawns the ship or, with no life left, sets the run outcome to
  `GAME_OVER` (GDD v0.4 §4.4 — the last explosion plays out).
- **The player decides the outcome, the run applies the penalties**: `Player.hit()` returns
  `IGNORED`, `ABSORBED` or `DIED`; `Run.playerDied()` applies what needs the difficulty profile
  and the world — bombs, power, release.
- **No release at power 1** (GDD v0.2 §4.4): `powerDown()` returns `false` and nothing spawns.
- **Order**: the release pickup spawns before `PLAYER_DIED` is published, so every listener sees
  a consistent world; `ScoreKeeper` resets the chain before the presenter reacts.
- **Bombs reset to the difficulty value** (`bombsPerLife`, GDD §10), not to a literal.
