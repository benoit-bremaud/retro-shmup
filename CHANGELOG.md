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
