# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Design only (no code yet): losing a life will put the ship back on the base weapon, the Spread
  at power level 1, and no P is released at the death; bombs, chain and the last life are
  unchanged. The level-1 balance and the default High scores scale are re-measured with the
  code (GDD v0.29 §4.4, #130).
- A first launch (or a missing, unreadable or newer save) starts the High scores with ten
  fictional players, 150 000 down to 30 000, that real scores push out one by one; a stored
  table, even empty, is kept as stored (GDD v0.28 §9.1, #128).
- The country is asked once, before the first run, and kept; it can be changed in the options
  (GDD v0.26 §9.1, #115).
- Menu rows are as tall as the screen allows, up to 32 px, so a phone can tap them without
  zooming: about 43–49 CSS px on the title, pause and options menus (GDD v0.25 §9.1, #95).
- The ship's hitbox grows from 4 × 4 to a 6 × 6 body core; bullets through the wings still pass,
  and the cockpit square drawn on the hitbox grows with it (GDD v0.24 §4.1, #106).

### Fixed

- A Laser bolt no longer passes through enemies: it stops on the first enemy or boss it touches
  (GDD v0.24 §4.3, #107).

### Added

- A 16 × 11 pixel flag beside the country code in the options, the High scores and the
  country choice; the code alone where the flag set has none (GDD v0.27 §9.1, #125).
- An optional feedback questionnaire: a *Feedback* title row and an offer after each run open a
  short external form in a new tab; hidden when the build sets no form address (ADR-0027, #122).
- Sound: synthesised retro sound effects for play and menus, kept for menus during the pause
  (GDD v0.23 §9.3, #105).
- Music by scene — title, level 1, boss intro and loop, Results and Game over jingles (CC0, by
  SketchyLogic) — ducked in the pause and faded at the WARNING; an *Audio* options screen with
  saved music and sound-effect volumes (GDD v0.23 §9.5, #110).
- The hall-of-fame number 1's name drifts dimly through the far background now and then, on
  its own visual-effects switch (GDD v0.22 §9.4.1, #98, #99).
- Level 1 is denser: filler Popcorn formations and Divers fill its empty stretches, and the
  balance guard keeps the time without an enemy at 70 s or less (GDD v0.21 §7.2.3, #94, #96).
- The game version, `v<version>+<short commit>`, shown as page text in the bottom-right corner
  (GDD v0.20 §9.9, #88).
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
- Spread and Laser on five shared power levels; a Laser bolt hits the nearest enemy first
  (it stops there since GDD v0.24, #107); HUD weapon badge and power pips (#27).
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
  fight in two phases (a fan and a ring in turn, then a turning ring of 16 (14 since GDD v0.18) and an aimed triple
  from 66 % HP), destroyed in a 2 s sequence or fleeing when the timer runs out; the bonus is
  10 000 + 100 per second left. Shots and the bomb hurt it only while it fights. The level ends
  on its destruction or escape and a "LEVEL CLEAR" banner (EN / FR) shows for 3 s before the
  title; the boss is drawn as grey boxes until the sprites. The level no longer loops at 120 s.
- The boss's HUD: a WARNING banner (ATTENTION in French) that blinks twice in the 3 s of warning
  and stays steady when the blink effect is off, then an HP bar at the top of the field with a
  tick at 66 % and the seconds left, from the start of the entry to the end of the sequence.
- Animated explosions: a shrinking core and fragments flying out, sized by tier (small, medium,
  large) and never white (photosensitivity); the ship now explodes when it dies; the Cruiser's
  turret bursts into debris when it breaks off, and its destruction chains a big burst and five
  smaller ones on the hull, one every 1/3 s, with 0.5 s of slow motion (its own switch, off by
  default under reduced motion).
- The end-of-level tally and the Results screen: under a LEVEL CLEAR header (FIN DU NIVEAU in
  French), one line every 0.5 s — formations destroyed × 500, no bomb 5 000, no miss 10 000, bombs
  left × 1 000, and the total, added to the score when the level ends; a missed bonus shows as 0.
  Confirm, a tap or a click leaves after 1 s, or the title comes back after 8 s. It replaces the
  3 s "LEVEL CLEAR" banner.
- A high scores screen from the title (the local top 10, with the country), and a VICTORY card
  with the final score after a cleared run.
- Enter your name in the high scores: a top-10 score opens a letter grid for an 8-character name,
  then an optional country (preselected from your browser language), saved in the browser; skip
  it and nothing is recorded.
- An attract mode: after 10 s on the title without touching anything, the high scores show for
  6 s, then the title again; any key, button, click or mouse move brings the title back.
- Sprites: the ship, the five enemy roles and the Cruiser are drawn with Kenney's *Pixel Shmup*
  placeholder sprites (CC0), hits flash as a white silhouette; if the images fail to load the
  game keeps its shapes (#75, #76).
- A controls screen in the options: every keyboard and gamepad action on two keys or buttons,
  changed by pressing the new one (a key already used swaps places), shown with the letters your
  own keyboard prints; restore the defaults per device. Saved in the browser.
- An options screen, from the title and from the pause: visual effects one by one or all at once,
  autofire for touch and mouse, English or French, fullscreen; every change applies at once and
  is saved. The title is a menu (PLAY, OPTIONS), and clicking a menu with the mouse no longer
  makes the ship jump to the cursor.
- A pause menu: RESUME and QUIT, by keyboard, gamepad, touch or mouse (a tap acts when the
  finger lifts on the same row); QUIT asks first, NO highlighted, and YES returns to the title.
  Tapping anywhere no longer resumes; the pause button and Esc still do.
- The options are saved in the browser (`localStorage`, one versioned document, nothing sent
  anywhere); the options screens that change them come next. A missing or damaged save simply
  gives the defaults.

### Changed

- Versioning policy (ADR-0025): SemVer 2.0.0, the save document and the URL parameters as
  public surface, manual signed releases from `v0.1.0` on.
- Level 1 is rebalanced a third time, much harder (GDD v0.18, #56): aimed, fan and triple enemy
  bullets at 85 px/s (was 75), Gunners take 10 shots (was 8) and fire every 0.8 s (was 1 s),
  Heavies take 50 shots (was 40), the Cruiser takes 1 800 shots (was 1 450; phase 2 from 11 880
  tenths) and fires every 0.9 s then 1.25 s (was 1 s then 1.5 s) with a phase-2 ring of 14 (was 16), and the 70 s formation no
  longer drops a P. A seeded measurement bot (`tests/balance`) now guards the balance.
- Level 1 is rebalanced a second time (GDD v0.12, #45): the Cruiser takes 1 450 level-1 shots
  (was 500; phase 2 from 9 570 tenths) and the formations at 8 s, 50 s and 52 s no longer drop a
  P, so full power comes just before the boss.
- Level 1 is harder after the friends' playtest (GDD v0.11, #45): Gunners drop a P at 10 % (was
  30 %) and fire every 1 s (was 1.5 s), Heavies drop a Bomb or a Shield at 30 % (was 60 %), the
  0 s and 50 s Popcorn formations have 8 members (was 6), the 92 s formation becomes two Divers,
  and the Cruiser takes 500 level-1 shots (was 300), its phase 2 from 3 300 tenths.
- The ship's bright cockpit is now exactly its 4 × 4 hitbox, at the centre, so a bullet that
  visibly crosses the hull or a wing without hitting is no longer confusing: the yellow square
  shows where a bullet counts (playtest of 2026-10-12; the hitbox itself is unchanged).
- The rules a run applies (kills, drops, the boss, the bomb) move from `Run` to a `RunRules` class,
  with no change in behaviour (ADR-0023 decision 7).
- Leftovers removed with no change in behaviour: the `Pool<T>` interface and `FixedPool.size`
  (ADR-0024), `RunConfig.script` (use `levels`), `LevelTally.reset()` until level 2 needs it, the
  unused second slot of `Body.volleys` (now one counter) and the copy of `sequenceAttack` groups.
- The mouse fires while the left button pressed on the field is held and touch while a finger
  steers, instead of always (ADR-0020); enemy bullets are drawn larger with a white core and
  player shots shorter and translucent, so the danger reads first (GDD v0.9).
