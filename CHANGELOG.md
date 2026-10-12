# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Fixed-step 60 Hz game loop, Canvas 2D renderer with integer scaling and a parallax starfield
  (#5).
- First playable build on keyboard: title screen, the ship's fly-in, movement clamped to the
  field, the level-1 Spread shot (#8).
- Deployment of every playable build on Cloudflare Pages (#10).
- Pause with a 3-2-1 count-in, HUD digits (#15).
- Enemies: Popcorn formations on S curves, Divers and Gunners from the first rows of level 1,
  aimed enemy bullets, collisions, 3 lives, death and respawn, Game over (#17).
- Score with a chain multiplier ×1 to ×8 and its bar, reserve-life icons, hit flash and
  explosions, an arcade Game over over the running wave (#18).
- Portrait screen with a top HUD strip, chosen when it gives the larger integer scale (#21).
- Touch and mouse controls: the ship follows the finger or the cursor, autofire, a touch pause
  button, tap to resume and to leave Game over after a 1 s lock, a crosshair cursor, a pause when
  the screen is rotated (#22).
- Gamepad controls: stick with a radial dead zone or d-pad, `A` fire, `Start` pause and confirm,
  a pause when the pad is lost (#23).
- Seeded drops per run: Gunners drop a red or blue P at 30 %, every fully destroyed Popcorn
  formation drops a P of the level's colour; pickups fall with a sway (#26).
- Spread and Laser on five shared power levels; the Laser passes through up to three enemies,
  nearest first; HUD weapon badge and power pips (#27).
- The Carrier, crossing the field with a cargo it always drops; Shield, Bomb and 1-UP pickups
  with a 1 000-point bonus at the cap; HUD bombs and shield (#28).
- Bombs (`X` / `Left Shift`, gamepad `B`, right click, a second finger): every enemy bullet
  cancelled, every enemy on the field hit, 1 s of invulnerability; the shield absorbs one hit; a
  death costs a power level, released as a P, and resets the bombs to 2; bomb flash and field
  shake, off by default under reduced motion (#29).
- The Heavy, a large enemy hovering 10 s that fires a turning ring of 12 bullets or a fan of 5
  aimed at the ship, and drops a Bomb or a Shield at 60 %; level 1 becomes a 120 s script that
  ramps up to a pair of Heavies at 102 s, with one 1-UP Carrier at 78 s (it still loops at 120 s
  until the boss arrives).
- The Cruiser, level 1's boss: the waves stop at 120 s, a 3 s warning, a slide-in, then a 90 s
  fight in two phases (a fan and a ring in turn, then a turning ring of 16 and an aimed triple
  from 66 % HP), destroyed in a 2 s sequence or fleeing when the timer runs out; the bonus is
  10 000 + 100 per second left. Shots and the bomb hurt it only while it fights. The level ends
  on its destruction or escape and a "LEVEL CLEAR" banner (EN / FR) shows for 3 s before the
  title; the boss is drawn as grey boxes until the HUD and effects of the next PRs. The level no
  longer loops at 120 s.

### Changed

- The rules a run applies (kills, drops, the boss, the bomb) move from `Run` to a `RunRules` class,
  with no change in behaviour (ADR-0023 decision 7).
- The mouse fires while the left button pressed on the field is held and touch while a finger
  steers, instead of always (ADR-0020); enemy bullets are drawn larger with a white core and
  player shots shorter and translucent, so the danger reads first (GDD v0.9).
