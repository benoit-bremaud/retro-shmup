# Game Design Document — retro-shmup (codename)

| | |
|---|---|
| **Status** | Vertical slice — v0.32 (2026-10-28): v0.32 explains the chain multiplier in play (#147, owner 2026-10-28, §7.3, §8, §9.2, §9.3, §9.4): the first ×2 of a run floats **CHAIN ×2 - KILL FAST** for 1 s and every break from ×2 or more a **CHAIN BREAK** for 0.5 s, centred near the top of the field, on their own effect switch; no tutorial screen. v0.31 (2026-10-28): v0.31 shows and rewards an enemy bullet grazing the ship (#146, owner playtest 2026-10-28, §4.1, §8, §9.3, §9.4): the 6 × 6 hitbox is unchanged; a bullet crossing the drawn 32 × 24 ship outside that core scores 100 points once, outside the chain, with a small spark on its own effect switch. v0.30 (2026-10-26): v0.30 preselects the country from the browser time zone first, the browser language's region second, else none (#131, §9.1, ADR-0021 amendment): an English speaker in France gets `FR`; still offline, the player confirms. v0.29 (2026-10-22): v0.29 reverses the death penalty of v0.2 and v0.8 (#130, owner playtest): losing a life puts the ship back on the base weapon, the Spread at power level 1, and no P is released any more (§4.4, §4.6); bombs, chain and the last life are unchanged. v0.28 (2026-10-19): v0.28 fills an absent high-score table (no save, or an unreadable or newer one) with ten fictional players (150 000 down to 30 000) that real entries push out one by one (§9.1, #128). v0.27 (2026-10-19): v0.27 draws a 16 × 11 pixel flag right of the two-letter country code wherever the code is shown — the options' *Country* row, the High scores, the country choice once the code is known — the code alone when no flag exists (§9.1, §9.3, ADR-0028). v0.26 (2026-10-19): v0.26 asks the player's country once, at the first *Play*, and keeps it in the save (changeable in the options), so the name entry loses its country step; it grows the letter grid's rows for touch (#115); and it adds an optional feedback questionnaire, an external form opened in a new tab from a screen after each run and from the title menu (§9.1, §9.3, §9.8, ADR-0027). v0.25 (2026-10-16): v0.25 makes the menu rows taller where they fit, so a phone can tap them without zooming (#95, §9.1): each menu's row height is 32 logical px or less, by its row count and its header. v0.24 (2026-10-16): v0.24 makes the Laser bolt stop on the first enemy or boss it touches (#107, owner playtest): the Laser keeps its width and damage per level but no longer passes through; and it grows the ship's hitbox from 4 × 4 to a 6 × 6 body core, the wings still harmless (#106, §4.1). v0.23 (2026-10-16): v0.23 settles the audio brick G3 (§9.5): sound effects from a small in-house 8-bit synthesiser, CC0 NES-style music for the slice's screens, the *Audio* options sub-screen with two volumes. v0.22 (2026-10-16): v0.22 lets the hall-of-fame number 1's name drift now and then, very dimly, in the far background of a run (§9.4.1), on its own effect switch. v0.21 (2026-10-16): v0.21 fills the empty stretches of level 1 with filler rows that pay no P (§7.2.3): the average player saw no enemy for 83 s of the first 116 s, 65 s since. v0.20 (2026-10-16): v0.20 shows the game version to the player as a small page text outside the canvas (§9.9, ADR-0025 decision 6). v0.19 (2026-10-16): v0.19 makes the shield ring the shape that collides while a charge is held (#74): any enemy bullet or body touching the drawn 36 × 36 square consumes the charge, once. v0.18 (2026-10-16): v0.18 is the third rebalance of level 1 (#56), after the owner found it far too easy and a committed measurement bot confirmed it: enemy aimed, fan and triple bullets at 85 px/s, the Gunner tougher and faster-firing, the Heavy tougher, the Cruiser at 1 800 shots with faster volleys, and the 70 s formation no longer paying its P. v0.17 (2026-10-15): v0.17 draws the ships with the CC0 placeholder sprites of G4-1 (§3.2.1: the sprite per role, the small enemies drawn at 1× over their 16 × 16 hitbox, the Cruiser built from three ships, the shapes kept as the fallback). v0.16 (2026-10-14; amended 2026-10-15 by the owner after a design-versus-code audit: the High scores columns as built, the browser-shortcut rule of the capture, the name entry as built in G2-3, the attract mode of G2-3b): v0.16 settles the hall of fame of G2 (the letter grid for the name and the country, the high-score table and screen, the Ending card, leaving the slice-end interim). v0.15 (2026-10-14): v0.15 settles the controls screen of G1b (layout, key labels, the device edited, restore confirmation, save version 2). v0.14 (2026-10-14): v0.14 settles the options screens of G1a-3 (row texts and values, the title menu replacing tap-to-start, leaving a menu frees the ship's movement). v0.13 (2026-10-14): v0.13 designs the menus and the options of the screens brick, first part (G1a: title and pause menus, the options screen and its visual-effects sub-screen, menu navigation by touch and mouse, the save document's options). v0.12 (2026-10-14): v0.12 is the second rebalance iteration of level 1 (#45): the Cruiser takes 1 450 level-1 shots and three of the seven formations no longer pay the formation P. v0.11 (2026-10-13): v0.11 rebalances level 1 after the friends' playtest (harder, fewer drops, the ship slightly weaker than the attack; #45). v0.10 (2026-10-12): v0.1 consolidated the inception brainstorming (2026-10-07); v0.2 to v0.4 fold in the rules surfaced by the UML use-case, class and behaviour studies; v0.5 closes the gaps of the first playable build (screens, devices, base shot); v0.6 adds the initial values of the enemies brick; v0.7 settles the devices brick (portrait HUD strip, touch pause button, resuming and leaving Game over by tap or Start, mouse takeover, rotation pause); v0.8 settles the player kit (Spread and Laser tables, the death release hop, bomb, shield and pickup rules, P colours, the Carrier, HUD icons); v0.9 follows the brick-E playtest (difficulty ramp by script, a named top 10 with an optional country, pointer fire held by the left button or a steering finger with an autofire option, shot proportions for readability); v0.10 settles the level brick (the 120 s level-1 script, the Heavy, the Cruiser, the WARNING, the boss HP bar and timer, the end-of-level tally and the Results screen, a vertical slice ending after level 1) |
| **Working title** | *retro-shmup* (codename; the commercial title is still open) |
| **Genre** | Retro vertical-scrolling shoot'em up (shmup), 16-bit aesthetic |
| **Platform** | Web browser (desktop first, mobile playable), TypeScript + native Canvas 2D |
| **Release target** | itch.io (web build) for 1.0; Steam considered later |
| **Owner** | Benoît Bremaud (solo developer) |

This document is the **design contract**. Every rule below was decided and validated during the
inception session; the *Decision record* at the end lists the alternatives that were rejected and
why. Technical choices are recorded as ADRs under [`docs/decisions/`](../decisions/). Numeric values
marked *(initial)* are starting points to be tuned in playtests, not commitments.

---

## 1. Vision

### 1.1 Pitch

A starfighter against a mechanical armada. Shoot the ships that pour down the screen, catch the
power-ups they drop, grow from a pea-shooter to a screen-filling barrage, survive three levels and
their bosses. Short, readable, juicy, fair.

### 1.2 Goals

1. **A real, finished, published game** — not a prototype. 1.0 ships on itch.io with everything a
   published game needs (options, high scores, accessibility, credits).
2. **A portfolio piece** demonstrating a professional design process: this GDD, a UML study, ADRs,
   tests, CI, and a clean architecture that is the developer's own (no game framework).
3. **Learning by shipping** — small enough to finish, rich enough to be worth playing twice.

### 1.3 Design pillars

| Pillar | What it means in practice |
|---|---|
| **Readable tension** | Moderate bullet density (Raiden-like), slow readable bullets, a tiny player hitbox. Danger is always legible; every death is the player's fault. |
| **Juicy and fair** | Full game feel (flash, hit-stop, shake, particles, score pop-ups), and every effect can be switched off for photosensitivity. Death is costly but never a death spiral. |
| **Ship-able scope** | 3 levels, 3 bosses, 5 enemy roles, 5 pickups, 2 weapons. Nothing that does not serve those numbers goes into 1.0. |

### 1.4 Target audience

Players of classic arcade shmups (1942, Raiden, DoDonPachi) and curious itch.io browsers who will
give a web game 90 seconds. The game must be understood in those 90 seconds without a tutorial.

### 1.5 References

- **1942 / 1943** — vertical scrolling, formations, loop-de-loop escape.
- **Raiden** — two weapon colours (spread vs laser), five power levels, moderate bullet density.
- **Galaga** — reward for destroying a full formation.
- **DoDonPachi** — chain multiplier, death releases the power-up *(dropped in v0.29)*, bees as risk/reward items.
- **Fix Your Timestep!** (Glenn Fiedler) — deterministic fixed-step simulation.

---

## 2. Core loop

```
move & shoot  →  destroy enemies  →  catch what they drop  →  grow stronger
      ↑                                                            │
      └──────────── die: lose all power, earn it back ─────────────┘
```

Per level: scripted waves (~2 min) → warning → boss (≤ 90 s) → results tally → next level.
A full run is three levels, about 15–20 minutes. *(v0.10)* The vertical slice holds level 1
only: after its results the run is cleared and the game returns to the title (§9.1); levels 2 and
3 are additions to a data-driven level list.

---

## 3. Presentation

### 3.1 Screen and scale

- **Play field 240 × 320 px** (3:4, arcade vertical). It sits in a **logical screen** that also
  holds the HUD *(v0.5)*: **480 × 320** in landscape, the field centred between two 120 px HUD
  bands (ADR-0014); **240 × 352** in portrait, a 32 px HUD strip above the field (ADR-0015). The
  game uses, among the screens that fit the window, the one with the larger integer scale,
  landscape on a tie (ADR-0015).
- The logical screen is rendered off-screen and scaled by an **integer factor** (×3 = 1440 × 960 on
  a 1080p display in fullscreen) with nearest-neighbour sampling (`imageSmoothingEnabled = false`,
  `image-rendering: pixelated`). Never fractional scaling. The rest of the window is black.
- On phones in portrait the portrait screen is letterboxed top/bottom; the ship follows the
  finger.
- Scrolling is **vertical**: the starfield scrolls down, enemies enter from the top (and sides for
  some roles), the player's ship lives in the lower third.

### 3.2 Art direction

- **16-bit pixel art** (SNES / Mega Drive era): sprites 16 px (small enemies), 32 px (player,
  medium enemies), 48–64 px (large enemies), 96–160 px (bosses).
- **Production strategy**: CC0 placeholder assets during development, replaced by custom assets
  before release. Rendering is decoupled from logic (ADR-0001) so the swap touches no gameplay.
- **Per-level palette swaps** give each level its own enemy colour scheme at zero drawing cost.
- Identity twist (deferred to the custom-asset phase): an unusual palette and a recognisable hero
  ship, so the game does not read as a stock asset pack.
- **Shot readability** *(v0.9)*: the enemy bullets are the most visible element on the field
  (the shmup readability rule); player shots are drawn translucent and slimmer so they never
  bury them. Drawn sizes are presentation only — every hitbox stays as specified (§4.1, §4.3,
  §5.2.1) and is revisited only if playtests ask:

  | Shot | Drawn | Hitbox (unchanged) |
  |---|---|---|
  | Enemy bullet | 6 × 6 with a 2 × 2 white core | 4 × 4 |
  | Spread bullet | 2 × 6, at 60 % opacity | 2 × 8 |
  | Laser bolt | its §4.3 size, at 60 % opacity | its §4.3 size |

  The sprites of the assets brick keep these proportions.

### 3.2.1 Placeholder sprites *(v0.17, G4-1)*

The ships come from Kenney's **Pixel Shmup** pack (CC0, credited in `CREDITS.md`): one sheet of
24 ships, 32 × 32 cells, drawn nose down. Bullets, pickups and effects keep their shapes until a
later G4 step. Every sprite is centred on its entity's position; **hitboxes do not change**.

| Entity | Hitbox | Sprite (pack cell, drawn size) |
|---|---|---|
| Player | 6 × 6 *(v0.24; 4 × 4 before)* (ship box 32 × 32) | `ship_0000`, blue, turned nose up; 32 × 24 drawn. The bright cockpit square stays drawn on the hitbox (§4.1) |
| Popcorn | 16 × 16 | `ship_0010`, green small, at 1× (20 × 17 drawn) |
| Diver | 16 × 16 | `ship_0009`, red small, at 1× (24 × 17 drawn) |
| Gunner | 32 × 32 | `ship_0007`, yellow, at 1× (28 × 23 drawn) |
| Carrier | 32 × 32 | `ship_0004`, blue, at 1× (24 × 19 drawn) |
| Heavy (ring and fan) | 56 × 48 | `ship_0002`, green large, at 2× (64 × 48 drawn) |
| Cruiser | 112 × 48 | a hull, `ship_0012` grey large at 2× (64 × 48), between two wings, `ship_0016` grey at 1× (24 × 19) each, side by side: 24 + 64 + 24 = 112 wide. The forward turret is the 16 × 16 grey turret tile (`tile_0016`) on the hull, at the turret's place (§6.1); it breaks off in phase 2 as before, the wings stay |

- **Overhang**: a sprite may overhang its hitbox by a few pixels — the small enemies' wing tips
  (below) and the Heavy's 64 px wings over its 56 px box (4 px a side).
- **Small enemies at 1×** (owner, MCDA B 380/500): the pack has no 16 px ship; a 1× sprite
  overhangs its 16 × 16 hitbox by 2–4 px at the wing tips, so a shot on a wing tip passes through
  (in the player's favour, never the reverse). Halving the sprite to 16 (260/500) drew a 10 × 9
  ship inside a 16 × 16 hitbox — hits on empty space, against pillar *Readable tension*; growing the
  hitboxes (280/500) is a balance change left to the rebalance.
- **The Cruiser as a composite** (owner, MCDA A 410/500): it fills its 112 × 48 box; a single
  ship at 3× (96 × 72, 370/500) overhangs the box 12 px above and below while its wing tips
  leave the box partly empty, so the dangerous area would read wrong.
- **Hit flash** *(amended in G4-1b)*: a flashing enemy or boss is drawn as the white silhouette
  of its sprite (§9.4), baked at load; while the sheets are not loaded it stays its box in the
  flash colour; the switch keeps its meaning. Owner, MCDA B 460/500: a box hid the Cruiser for the
  whole fight, since sustained fire keeps it flashing (headless capture); a blink (330) and a
  translucent veil (295) read worse.
- **Fallback**: the game starts at once on the shapes it draws today; each sprite replaces its
  shape as soon as the sheet is loaded, and if the sheet never loads the whole run stays on the
  shapes, with no error shown to the player (ADR-0001 amendment).
- **No palette swap yet**: the per-level palettes (§3.2) wait for level 2.

### 3.3 Universe

Space, but the enemy is a **mechanical military armada**: cruisers, battleships, gantries,
turrets. The player flies a lone starfighter. Procedural starfield background with 2–3 parallax
layers, plus level-specific props (asteroids, shipyard structures, the mothership's hull).

| Level | Theme | Boss |
|---|---|---|
| 1 | Asteroid belt — the armada's vanguard | **Cruiser** (2 phases) |
| 2 | Orbital shipyard | **Gantry turret** (2–3 phases) |
| 3 | The mothership | **Mothership core** (3 phases, destructible parts) |

### 3.4 Narrative

Minimal, arcade style: one intro card (two sentences), one title card per level, one ending card
(two sentences). The gameplay tells the story. All text is localised (EN default, FR).

---

## 4. The player

### 4.1 Ship and movement

- 32 × 32 px sprite. Maximum speed *(initial: 150 px/s, i.e. the play field crossed in 1.6 s)*:
  keys and the d-pad move in eight directions at that speed; the analog stick moves at a speed
  proportional to its tilt, up to it; touch and mouse move the ship toward the pointer, never
  faster *(v0.5)*. The whole sprite stays inside the play field: its centre is clamped to x 16–224
  and y 16–304 *(v0.5)*.
- **Hitbox: 6 × 6 px** at the sprite's centre *(v0.24, #106; 4 × 4 from v0.1 to v0.23)*: the
  body core — the cockpit and the fuselage — not the wings. The visible ship is still much larger
  than what can be hit; bullets graze the wings. This is the genre's standard since the 1990s and the single most
  important fairness rule of the game. *(v0.10 playtest)* The ship's bright cockpit is drawn
  exactly on that hitbox, so the player can see where a bullet counts; only the drawing changes.
  *(v0.19)* While a shield charge is held, the 36 × 36 ring collides instead (§4.4).
  *(v0.24, #106)* The owner's playtest found the 4 × 4 square too forgiving (a bullet seen to
  cross the ship did not kill); the 6 × 6 core is a first step, to be playtested. A bullet crossing
  the drawn wings outside that core still passes, by design. At the fastest relative speed (ship
  150 px/s plus a 85 px/s bullet) a bullet moves 3.9 px per step, under the 10 px overlap window,
  so it can never skip the hitbox.
- **Graze** *(v0.31, #146, owner playtest 2026-10-28)*: a bullet passing through the wings read as
  a bug, so the pass-through is now shown and rewarded instead of removed. The **graze box** is the
  drawn ship, **32 × 24** centred on the sprite's centre (the hitbox's centre); an enemy bullet
  whose hitbox overlaps the graze box but not the 6 × 6 hitbox in a step **grazes**: it scores
  (§8) and gives a spark (§9.4). Each bullet grazes **at most once** in its life; a bullet that
  touches the hitbox in the same step hits and does not graze; a bullet that grazed and hits
  later still kills. Only a `Vulnerable` ship without a shield charge grazes: while invulnerable
  bullets pass with no reward, and while a charge is held the 36 × 36 ring collides instead (§4.4).
  Bodies, the boss and pickups never graze. The hitbox does not change.
- Spawn / respawn: the ship enters from the bottom with **2 s of invulnerability** (blinking); the
  fly-in *(initial: 0.5 s)* is part of those 2 s and gives no control. The ship flies in like this
  at the start of **every level** *(v0.4)*. It appears centred (x 120) fully hidden below the
  field (y 336) and flies straight up at constant speed to its resting point, y 272
  *(initial, v0.5)*; it neither fires nor is clamped during the fly-in.
- The invulnerability blink runs at **3 blinks per second** *(initial, v0.5)*, never faster: the
  photosensitivity threshold of WCAG 2.3.1. The ship is visible for the first half of each blink;
  the phase runs continuously from the start of the protection (fly-in or invulnerability), so the
  hand-over from fly-in to invulnerability and a bomb's extension keep it; the blink freezes with
  the pause. It is a §9.4 effect, with a non-flashing replacement that does not rely on colour
  alone (§9.7).
- While invulnerable the ship is not hit at all: enemy bullets and bodies **pass through** it
  *(v0.4)*.

### 4.2 Controls

| Priority | Input | Model |
|---|---|---|
| P0 | Keyboard | Move: arrows (primary), `W A S D` physical keys (secondary — the same keys read Z Q S D on AZERTY); opposite directions held together cancel. Fire `Space` / `Z` (held = continuous fire); bomb `X` / left `Shift`; pause `P`; `Enter` (main or keypad) confirm; `Esc` pauses in play and goes back in menus (fixed). Remappable. |
| P1 | Touch | The first finger on the play field drives the ship, which follows it **32 px above** *(initial)* so the thumb never hides it; lifting the finger leaves the ship where it is. Fires while a finger steers: lifting it stops firing *(v0.9; v0.8: autofire always on)*; bomb = on-screen button or second-finger tap *(v0.8: the second-finger tap only, for now — no bomb button is drawn; the portrait strip is full and its right end is far from the thumb; revisited with the options and screens)*; pause = on-screen button. A touch that starts outside the play field is a tap on the HUD, never a move *(v0.5)*. The **pause button** sits in the top-right corner of the screen in both orientations — 48 × 32 at the right end of the portrait HUD strip, 48 × 48 at the top of the right landscape band — and is drawn in play, in the pause and during the count-in, never on the title or in Game over *(v0.7)*. |
| P1 | Gamepad | Left stick (radial dead zone *(initial: 0.2)*) or d-pad move, the d-pad winning when pressed; `A` fire (held = continuous fire); `B` bomb; `Start` pause (Gamepad API, standard mapping). The last pad used is the active one *(v0.5)*. Remappable. `Start` is also a fixed `confirm` *(v0.7)*: it starts from the title, resumes from the pause and leaves Game over, as `Esc` both pauses and goes back on the keyboard. |
| P2 | Mouse | Ship follows the cursor; fires while the left button is held after a press on the field — a press outside the field never fires, even held; releasing the button anywhere stops it *(v0.9, ADR-0020; v0.8: autofire)*; right click bomb *(v0.5: `Space` stays the keyboard fire)*. The cursor is a crosshair over the game, centred on the ship's hitbox *(v0.7)*. The mouse takes the ship only when it moves to another play-field pixel or on a left press on the field *(v0.9 wording: the right button bombs and never takes the ship, ADR-0018 decision 4)*; a click outside the field (HUD, pause button) is a tap only, as for a finger *(v0.7)*. |

Inputs are translated to **intents** (`move`, `fire`, `bomb`, `pause`, `confirm`, `back`) so no
outcome ever depends on the device that produced them (one plain intent frame per step, ADR-0009;
the active device only chooses prompts and key labels).

**Several devices at once** *(v0.5, ADR-0015)*: the ship follows the last device that started
moving it; the buttons of every device combine *(v0.9)*: keyboard and gamepad fire is held by
their fire button as before, the mouse fires while its left button is held and touch while a
finger steers, so, with the autofire option off, no device fires without a player action. **Autofire option** *(v0.9, options screen)*: fire
always on, the v0.8 behaviour, for touchpad users and accessibility; it applies only while touch
or the mouse owns the movement, so a keyboard player who brushes the mouse gets autofire only until
a key or the stick moves the ship again (ADR-0020). A held pointer fire is sampled in every
scene; only Playing acts on it: a finger or left button still held when the count-in ends fires
at once, like a held keyboard key. Lost focus clears the steering finger and the mouse buttons
(ADR-0015 decision 5), so pointer fire stops. A second finger bombs without stopping or
restarting the first finger's fire.

**Bindings** *(v0.2)*: keyboard keys are bound by **physical key** (`KeyboardEvent.code`), so a
layout change (QWERTY, AZERTY) never breaks them; labels shown to the player use the active
layout. Each remappable intent (`move` ×4, `fire`, `bomb`, `pause`) has a **primary and a
secondary slot** per device. Remapping edits one slot; a key already used elsewhere **swaps**
with it, so no intent is ever left unbound. `confirm` and `back` are fixed (`Enter` / `Esc` on
keyboard; `A` / `B` on gamepad, in every scene, and `Start` also confirms *(v0.7)*) to prevent
lock-out; `Esc` is never bindable (browsers
also reserve it to leave fullscreen). `Z` and `X` are physical positions too: they never collide
with the `W A S D` block, on any layout. A "restore defaults" action exists per device. While
waiting for a new key, `Esc` cancels on keyboard; on gamepad the wait cancels itself after 5 s
(every button may be a binding). Touch and mouse have no discrete bindings and are not
remappable.

**The controls screen** *(v0.15, G1b)*: *Controls* (FR *COMMANDES*) joins the options. It
edits the device of the two that was used last, keyboard or gamepad (the keyboard before
either), named under the header (*KEYBOARD* / *CLAVIER*, *GAMEPAD* / *MANETTE*). While a cell is
being chosen the edited device follows the last keyboard or gamepad input, the name updating;
during a capture it is fixed, and the capture answers only an input of that device, whatever
device started it. The row is hidden only when the last device used is touch (a mouse player on
a computer still sees it and edits the keyboard).
- **Layout**: one row per remappable intent, in the order *UP* / *HAUT*, *DOWN* / *BAS*, *LEFT* /
  *GAUCHE*, *RIGHT* / *DROITE*, *FIRE* / *TIR*, *BOMB* / *BOMBE*, *PAUSE* / *PAUSE*, with its
  label (6 characters at most) and its two slots in two columns of 10 characters (an empty slot
  is blank); then *RESTORE DEFAULTS* / *PAR DEFAUT* and *BACK* / *RETOUR*. One cell is
  highlighted at a time: up and down change the row, left and right the column; on the last two
  rows left and right do nothing. `confirm`, or a tap or click on a cell, starts the capture of
  that slot.
- **Capture**: the cell shows *PRESS* / *APPUIE* (steady, no blink). Every key's browser default
  is prevented while waiting, except `Escape`'s. The next capturable key or button of the edited
  device binds that slot; `Escape` cancels on keyboard, and on gamepad the wait cancels itself
  after 5 s; a key outside the capturable set below is refused and the wait goes on. A tap or
  click, leaving the scene, or an automatic pause trigger (tab hidden, focus lost, the active
  gamepad lost) cancels the capture, and the screen stays on the cell. The step that receives the
  answer (a key, a button or a cancel) reads no menu action from its frame either, so `Escape`
  (which also sends `back` and `pause`), `B` or `Start` never act twice.
- **Browser shortcuts** (owner, 2026-10-15): a key pressed while Ctrl, Alt or Cmd/Meta is held is
  ignored by the game, in play and in capture, and keeps its browser action (copy, tab switch,
  zoom…). The Ctrl and Alt keys themselves, whose own press carries their flag, are not shortcuts
  and stay capturable.
- **Swap**: an input already bound to another slot of the same device moves to the captured slot
  and the two slots exchange. When the exchange would empty another intent's primary slot, that
  intent's secondary input moves up to primary; when it has none, the input is refused (the wait
  goes on), so no intent is ever left unbound.
- **Restore defaults** asks first (question *RESTORE DEFAULTS* / *PAR DEFAUT*, *NO* / *NON* first,
  then *YES* / *OUI*), like *Quit*, and resets the bindings of the device edited only.
- **Capturable keys and labels** (a closed set, each label 10 characters at most, in the menu
  font, which gains the digits 0–9 and four arrow glyphs): the letters `KeyA`–`KeyZ` and digits
  `Digit0`–`Digit9` show the character the player's keyboard prints for them — learned from the
  session's key events (each press pairs a physical key with its character), else from the
  browser's layout map where it exists, else the US character; a learned character the font
  cannot draw (an accent, `&`) falls back to the US character. The arrows show their glyph;
  `Space` *SPACE* / *ESPACE*; `ShiftLeft`, `ShiftRight` *SHIFT L*, *SHIFT R* / *MAJ G*, *MAJ D*;
  `ControlLeft`, `ControlRight` *CTRL L*, *CTRL R* / *CTRL G*, *CTRL D*; `AltLeft`, `AltRight`
  *ALT L*, *ALT R* / *ALT G*, *ALT D*; `Backspace` *BACKSPACE* / *EFFACER*; `Numpad0`–`Numpad9`
  *NUM 0*–*NUM 9*. Every other key (`Tab`, `F1`–`F12`, `MetaLeft`, `ContextMenu`, `Enter`,
  `NumpadEnter`, …) is refused. Gamepad buttons 0 to 15 are capturable, with their standard
  names (*A*, *B*, *X*, *Y*, *LB*, *RB*, *LT*, *RT*, *SELECT*, *START*, *L3*, *R3* and the d-pad
  arrows); button 16 (the home button, often the system's) is refused. The learned characters
  stay in memory: nothing is saved or sent (PRIV-1).
- **Saved** at once, in the save document's version 2: the options gain the bindings of both
  devices; version 1 migrates by adding the default bindings (ADR-0006 decision 4). The stored
  bindings are untrusted input, read by allowlist: every key code from the capturable set above,
  every button index from 0 to 15, a primary slot always present, no input bound twice on a
  device; a device whose bindings fail any check gets its defaults back.

**Activation** *(v0.2)*: browsers unlock audio and fullscreen only after a click, tap or key
press — a gamepad button does not count. If "Press Start" comes from a gamepad before any such
gesture, the game asks for one click, tap or key.

### 4.3 Weapons and power levels

Two weapons, selected by the colour of the last **P** pickup caught; **five power levels** shared
between them (switching weapon keeps the current level, as in Raiden). A run starts with the
**Spread** at level 1 *(v0.2: the more forgiving weapon, and effective against level 1's
formations)*.

| Weapon | Pickup | Character | Level 1 → 5 *(initial)* |
|---|---|---|---|
| **Spread** (red) | P-red | Wide fan of bullets, good against formations, lower single-target damage | 1 → 5 streams, widening fan, firing rate +50 % at L5 *(v0.8: +40 % before; cooldowns are whole steps)* |
| **Laser** (blue) | P-blue | Narrow beam, high single-target damage, demands aim | Beam width 2 → 8 px, damage ×1 → ×3; each bolt stops on the first enemy it touches *(v0.24; v0.8 to v0.23: passes through 1 → 3 enemies)* |

Damage output grows roughly ×1.0 / ×1.4 / ×1.9 / ×2.4 / ×3.0 from L1 to L5 *(initial)*. Enemy HP
is expressed in **level-1 shots** so this ratio is what the player feels as "power".

**What the ratio measures** *(v0.8)*: the damage per second of the **aimed shot on one target** —
the Spread's centre stream, or the Laser. The Spread's side streams add coverage, not power.
Every player bullet deals **at least 1** (one level-1 shot), so a Popcorn always dies in one hit.
Switching weapon keeps the power level and the running cooldown. The Laser's ratio is ×1.0 /
1.5 / 2.0 / 2.5 / 3.0 (half-shot steps); *(v0.24)* its coverage is its bolt width alone (v0.8 to v0.23: its pass-throughs).

**Spread levels** *(initial, v0.8)*: every bullet is 2 × 8 px at 360 px/s and leaves from the
nose; angles are measured from straight up, and a side stream flies along its angle.

| Level | Streams | Angles | Rate | Centre damage | Side damage | Centre ratio |
|---|---|---|---|---|---|---|
| 1 | 1 | 0° | 10/s | 1 | — | ×1.0 |
| 2 | 3 | 0°, ±6° | 10/s | 1.4 | 1 | ×1.4 |
| 3 | 3 | 0°, ±12° | 10/s | 1.9 | 1 | ×1.9 |
| 4 | 5 | 0°, ±6°, ±14° | 10/s | 2.4 | 1 | ×2.4 |
| 5 | 5 | 0°, ±8°, ±18° | 15/s | 2.0 | 1 | ×3.0 |

The level-5 rate is a cooldown of 4 steps (15/s, +50 %): cooldowns are whole steps, and the
neighbours are 5 steps (+20 %) or 3 steps (+100 %), so the "+40 %" of v0.2 is not reachable.

**Laser levels** *(initial, v0.8)*: the Laser fires **long bolts**, not a continuous beam:
10 bolts per second at 600 px/s, each 48 px long, its lower end at the nose; the 12 px gaps between
bolts read as a pulsed beam. *(v0.24, #107)* A bolt **stops on the first body it touches** — an
enemy, or the boss while it fights — deals its full damage there and is spent, as a Spread bullet
is. When it overlaps several bodies in one step, it hits the nearest along its path; a body behind
is reached only by a later bolt. *(v0.8 to v0.23: a bolt passed through 1 to 3 enemies.)*

| Level | Width | Damage | Enemies hit |
|---|---|---|---|
| 1 | 2 px | 1 | 1 |
| 2 | 3 px | 1.5 | 1 |
| 3 | 4 px | 2 | 1 |
| 4 | 6 px | 2.5 | 1 |
| 5 | 8 px | 3 | 1 |

**Spread level 1** *(initial, v0.5)*: one stream straight up from the ship's nose (16 px above its
centre), **10 shots per second**, bullets 2 × 8 px at **360 px/s** (the field crossed in under a
second), gone once fully above the field (side streams, v0.8: once fully outside the field). Holding fire shoots at that rate; the first shot leaves
at once, including the first step with control after the fly-in. The cooldown runs whether fire
is held or not, so tapping never fires faster than holding. One level-1 shot deals 1 damage.

### 4.4 Lives, shield, death

- **One hit = one life.** 3 lives at start *(initial)*, the ship in play included; at most 9
  (HUD limit); extra lives only from **1-UP** pickups.
- **Shield**: a pickup grants **one charge**, drawn as a ring around the ship. The next hit consumes
  the charge instead of a life (0.5 s invulnerability, no other penalty). Charges do not stack.
  *(v0.8)* The ring is 36 × 36, an outline in its own colour (never the hull's). A bullet or a
  body contact both consume the charge — the body survives, as for any contact (§5.2) — and the
  0.5 s of invulnerability restart the blink. The charge is kept until used, across levels; a run
  starts with none.
  *(v0.19)* While a charge is held, the drawn ring **is** the shape that collides: an enemy bullet
  or an enemy or boss body that overlaps the 36 × 36 square centred on the ship (a strict overlap,
  as every box test of the game: a shared edge does not count) consumes the charge and the ring
  disappears at once, even if it would have missed the 6 × 6 hitbox. The shield protects once and
  only once; with no charge, only the 6 × 6 hitbox counts again (§4.1). This holds only while the
  ship is vulnerable: during the respawn entry or any invulnerability (the 0.5 s after the absorb
  included) the ring is drawn but nothing touching it counts, and the charge stays.
- **On death**:
  1. *(v0.29, #130)* the ship goes back to the **base weapon**: the **Spread at power level 1**,
     whatever the weapon kind and level it held — all the power of the life is lost and must be
     earned again from the drops (v0.2 to v0.28: one level lost, the weapon kind kept),
  2. *(v0.29)* **no pickup is released** at the death (v0.2 to v0.28: a P of the current weapon
     colour, restoring the lost level, which rose 48 px then fell at 20 px/s, §4.6 of those
     versions); the death release and its motion no longer exist,
  3. the chain multiplier resets to ×1,
  4. bombs are reset to **2** (`bombsPerLife`, §10),
  5. the ship respawns after 1.5 s with 2 s of invulnerability (the 0.5 s fly-in included, §4.1).
  *(v0.8)* Steps 1 to 4 apply at the moment of death: the HUD shows the base weapon at level 1 and
  the 2 bombs during the explosion; on the last life too (the reset then only shows during the
  explosion, since Game over follows).
  Lives at 0 → **Game over** after the 1.5 s death sequence *(v0.4: the last explosion plays out)*
  (no continues in 1.0). The Game over screen lasts **3 s** *(initial, v0.6)*, or less when the
  player confirms — by `confirm`, a tap or a click, accepted only after a **1 s** lock *(initial,
  v0.7)* so a player still hammering fire never skips it; the title it returns to applies the same
  lock, so that hammering never starts a new run either. It shows **GAME OVER** in large letters over the run, which keeps playing
  without the ship, as on an arcade cabinet: waves keep coming, enemies fly and fire, the score
  stays as it was *(v0.6, owner playtest)*.

### 4.5 Bombs

- Stock **2 per life, maximum 5** *(initial)*; **Bomb** pickups add one. A run starts with 2.
- Effect: every enemy bullet on screen is cancelled, every enemy **including the boss** (on the field, v0.8; the boss only while it fights, v0.10, §6) takes heavy
  damage *(initial: 30 level-1 shots — 5–10 % of a boss)*, the player is invulnerable for **1 s**,
  large screen shake (toggleable). With an empty stock the input does nothing.
- **When** *(v0.8)*: only while the ship is in control — `Vulnerable` or `Invulnerable` (§4.1);
  never during the fly-in, while dead, after Game over, nor in the pause (the run does not step).
  One bomb per press: holding the button never chains bombs.
- **One step** *(v0.8)*: the bomb acts in the step of the press, before that step's collisions:
  it cancels the enemy bullets, then deals its damage **once** to every enemy whose box overlaps
  the play field — an enemy still outside the field is untouched. Its kills follow the normal
  path of a kill: score, chain, formation count, drops (cargo included) and the hit flash
  (§5.2). The invulnerability is max(time left, 1 s), and the ship blinks during it (§4.1): a
  bomb never shortens a protection.
- **Feedback** *(v0.8)*: a tint flash of the play field (about 300 ms of wall time) and a shake of
  the play field only (the HUD never shakes); two separate effects, each with its own switch
  (§9.3, §9.4). A new flash starts only when the previous one started at least 1/3 s earlier, so
  bombs dropped in a burst never flash more than 3 times per second (§9.7).
- A bomb used is noted for the end-of-level tally (no-bomb bonus lost).

### 4.6 Pickups

All pickups fall straight down at a slow speed *(initial: 40 px/s)* with a slight horizontal sway,
and are collected by touching them with the ship's sprite box (generous: 32 × 32). A pickup that
leaves the bottom of the screen is lost.

| Pickup | Visual | Effect | Typical source |
|---|---|---|---|
| **P-red** | Red "P" capsule | Select Spread; +1 power level (max 5) | Gunner, full Popcorn formations |
| **P-blue** | Blue "P" capsule | Select Laser; +1 power level (max 5) | Gunner, full Popcorn formations |
| **Shield** | Ring, in its own colour (never the hull's) | One shield charge | Carrier, Heavy |
| **Bomb** | Yellow plus-shaped "B" | +1 bomb (max 5) | Heavy, Carrier |
| **1-UP** | Green ship icon | +1 life | Rare: specific Carriers in the level script |

*(v0.8)* Placeholder shapes until the sprites: meta/05-state-scenes (player-kit brick additions).

**Pickup at its cap** *(v0.2, one rule)*: when the effect cannot apply — power already 5, bombs
already 5, a shield charge already held, lives already 9 — the pickup grants **1 000 points**
instead. A P of the other colour still switches the weapon (level unchanged); at level 5 it
switches **and** grants the 1 000 points *(v0.3)*. *(v0.8)* The 1 000 points are flat: never
multiplied by the chain; catching a pickup neither extends nor breaks the chain.

**Pickup rules** *(initial, v0.8)*:

- **Box and collection**: a pickup is a 16 × 16 box, collected when it overlaps the ship's full
  32 × 32 sprite box. The ship collects while `Entering`, `Invulnerable` or `Vulnerable`; never
  while `Dead` nor after Game over — the pickup keeps falling and is lost. A ship that dies in a
  step collects nothing in that step. Several pickups caught in one step apply one after the
  other, in the order of the active pickup list: a P-red and a P-blue caught together leave the
  weapon of the last.
- **Motion**: straight down at 40 px/s, swaying as a function of its age only:
  x = x0 + 8 · sin(2π · age / 2 s), x0 being the spawn x clamped to 16–224 so the whole box stays
  in the field. No random draw: the sway is the same on every replay. *(v0.29: the death release and
  its own motion are gone.)* Pickups freeze with the pause. A pickup is lost once its top edge reaches the
  bottom of the field (y 320).
- **At most 8** pickups at once *(initial)*; a spawn beyond that is dropped (ADR-0002), and the
  level simulation tests check that a level never needs more. *(v0.29: no death release spawns any more; the pool is
  filled by the script's own drops only, which the level simulation test checks.)*
- **P colours**: a full Popcorn formation gives a P of the **level's dominant colour** — red
  (Spread) in level 1 — at the position of the last member destroyed, even above the field; each
  pass of a looping script row is a new formation. *(v0.12)* A formation pays this P unless its
  script row says otherwise (`paysP`, §7.2): in level 1 four of the seven formations — those
  starting at 8 s, 50 s, 52 s and *(v0.18)* 70 s — pay none, so the three formation P lift the
  ship to power 4 and power 5 needs a Gunner's P (§5.2.1) as well; it comes, if at all, just
  before the boss *(v0.18; v0.12: three formations paid none, full power near 119 s from the
  formation P alone)*. A Gunner drops at 10 % *(v0.11; was 30 %)* a P-red or a P-blue,
  50 / 50, both decided by one random draw. The Carrier's cargo is chosen by the level script
  (§5.2.1).

Rule of thumb: everything that falls is good to catch. (This invariant is exactly what the 1.x
"ejected pilots" candidate would challenge — see §12.) *(v0.8)* One known tension: a P of the
other colour switches the weapon, so a Laser player may avoid a red P. It still raises the power
level by one (or pays 1 000 points at level 5), so catching it never costs power, only the
colour; the player chooses, which is the point of two colours.

---

## 5. Enemies

### 5.1 Design principle

An enemy is defined by the **question it asks the player** for the next one to three seconds, not
by its size. Size (sprite, HP, hitbox) is the envelope; the role is movement + attack + drop. Five
roles on three size tiers cover every wave the three levels need.

### 5.2 Roles

| Role | Question asked | Size | HP *(initial, L1 shots)* | Movement | Attack | Drop table *(initial)* | Score *(initial)* |
|---|---|---|---|---|---|---|---|
| **Popcorn** | "Where do I place my fire to clear the whole formation?" | Small (16 px) | 1 | Scripted formations of 5–8 along curves (S, sine, loop) | None, or one slow bullet per formation (later levels; none in level 1 *(v0.10)*) | None individually; **full formation destroyed = P** of the level's dominant colour, unless its script row pays none *(v0.12; every formation paid it before, level 1 has four that do not since v0.18, three in v0.12, §7.2.2)* | 100 |
| **Diver** | "Where must I *not* be?" | Small (16 px) | 1 | Enters, then dives straight at the player's position at the moment of the dive | Contact only | None | 150 |
| **Gunner** | "Kill first, or dodge first?" | Medium (32 px) | 10 *(v0.18; was 8)* | Enters from top or side, hovers 3–4 s, leaves | 1–3 aimed bullets per volley, every 0.8 s *(v0.18; 1 s in v0.11, 1.5 s before)* | P-red or P-blue (50 / 50 *(v0.8)*) at **10 %** *(v0.11; was 30 %)* | 300 |
| **Carrier** | "Do I catch it before it leaves?" | Medium (32 px) | 4 | Crosses the screen laterally, never stops | None | **100 %**: Shield, Bomb or 1-UP as chosen by the level script | 500 |
| **Heavy** | "How do I handle the pressure while I wear it down?" | Large (48–64 px; 56 × 48 *(v0.10)*) | 50 *(v0.18; was 40)* | Slow entry from the top, holds position 8–12 s (10 s *(v0.10)*), leaves | Bullet patterns: ring (12 bullets) or fan (5 bullets), every 2 s | Bomb or Shield at **30 %** *(v0.11; was 60 %)* | 1 000 |

- **Contact** *(v0.3)*: touching any enemy body, boss included, hits the player like a bullet; the
  enemy takes no damage from it. *(v0.19)* With a shield charge held, touching the ring counts (§4.4).
- **Bomb kills** *(v0.3)* count like shot kills: they extend the chain and count toward the full
  formation guarantee.
- Enemy bullets: speed 60–90 px/s *(initial)*, **10–40 on screen** at peak. No enemy bullet is
  ever faster than the player's ship *(v0.5 wording: player shots are faster by design)*.
- Every enemy flashes white briefly when hit (§9.4) (palette flash, no extra sprite) and shares a
  common explosion animation scaled by size tier.
- Enemies that leave the screen alive simply despawn (no penalty, no score).

### 5.2.1 Initial values of the first roles *(v0.6)*

All values *(initial)*, tuned in playtests. Hitboxes are the box of each size tier, centred on
the sprite, which may overhang it by a few pixels *(v0.17, §3.2.1; was "the full sprite box")*;
the player's tiny hitbox already carries the fairness (§4.1). HP and damage stay expressed in
level-1 shots (§4.3); the code counts them in tenths of a shot so that 1.4 or 2.5 leave no
rounding residue (ADR-0019).

| | Popcorn | Diver | Gunner | Carrier *(v0.8)* | Heavy *(v0.10)* |
|---|---|---|---|---|---|
| Hitbox | 16 × 16 | 16 × 16 | 32 × 32 | 32 × 32 | 56 × 48 (size tier Large) |
| HP | 1 | 1 | 10 *(v0.18; was 8)* | 4 | 50 *(v0.18; was 40)* |
| Movement | one every 1/3 s along the S curve below, at **70 px/s** downward | enters from the top at 60 px/s for 1 s, then dives in a straight line at **180 px/s** toward where the ship was at that moment, and keeps that heading until it leaves the field | flies in a straight line from its spawn point to its hover point in 1 s, hovers **3.5 s**, then flies back the way it came at 60 px/s | crosses the field horizontally in a straight line at **60 px/s**, away from the side it spawned on (spawn x < 120 → moves right, otherwise left); never stops | the Gunner's movement with its own values: from its spawn point (y −24, straight above its hover point) to its hover point in **2 s**, hovers **10 s**, then flies back the way it came — upward — at **40 px/s** |
| Attack | none | contact only | **1 aimed bullet** per volley: the first 0.8 s after it stops, then every 0.8 s while hovering (4 bullets per hover) *(v0.18; 1 s and 3 bullets in v0.11, 1.5 s and 2 bullets before)* | none (contact only) | set by the script row, every **2 s** while hovering, the first volley 2 s after it stops: **ring** — 12 bullets 30° apart at **60 px/s**, the whole ring turned by 15° every other volley; or **fan** — 5 bullets 15° apart centred on the aim at the ship, at **85 px/s** *(v0.18; was 75)* |
| Drop | formation P (§4.6), unless the script row sets `paysP` to false *(v0.12)* | none | P-red or P-blue at 10 % *(v0.11)* (§4.6) | its cargo, always: Shield, Bomb or 1-UP, set by the script row; an escaped Carrier drops nothing; a bomb kill drops the cargo | Bomb or Shield at 30 % *(v0.11)*, 50 / 50, from its one drop draw (as the Gunner's P) |
| Score | 100 | 150 | 300 | 500 | 1 000 |

The script is checked at load: a Carrier row without a cargo, a cargo on any other role, or a
Carrier whose spawn box overlaps the field is rejected.

**Heavy** *(v0.10, initial)*: one bomb (30 shots) leaves a Heavy at 20 level-1 shots *(v0.18; 10 before)*. The ring's
first bullet points straight down; the volley count is kept per Heavy, so every other volley is
the ring turned by 15° and the pattern is the same on every replay. The ring or the fan is chosen
by the script row (two archetypes, `HEAVY_RING` and `HEAVY_FAN`), never by a random draw.

- **S curve**: x = x0 + 40 · sin(2π · y / 160), the enemy moving down at 70 px/s from y −8 and
  leaving through the bottom; mirrored, the oscillation starts on the other side of its axis:
  x = x0 − 40 · sin(2π · y / 160). The group size, x0, the mirror, the spawn and hover points are
  script data (§7.2.1), never role constants.
- **Aim**: a Gunner aims, and a Diver dives, at the ship's current position whatever its state;
  when the ship is exactly on the shooter, the shot or dive goes straight down.
- **Enemy bullets**: 4 × 4 px at **85 px/s** *(v0.18; was 75)*, straight toward the ship's
  position when fired, still well under the ship's 150 px/s. *(v0.10)* Rings fly at 60 px/s
  along their own angles; fans, triples and aimed bullets at 85 px/s *(v0.18; was 75)*.
- **Leaving the field**: an enemy despawns (§5.2) only once it has been inside the field and is
  then fully outside it, so an enemy spawning outside the field is never removed on arrival.
- **At most** 48 enemy bullets, 16 enemies, 80 player bullets *(v0.8: 16 before; 5 streams ×
  15/s × ≈ 0.85 s ≈ 64)* and 8 pickups (§4.6) at once. The 40 enemy bullets of
  §5.2 and §6 are a readability limit for whoever writes waves and patterns, checked by the level
  simulation tests (peak ≤ 40 over a whole level); the pool of 48 is the engine's safety net and
  never cuts a legal pattern short *(v0.6)*. A spawn beyond a pool is
  dropped (ADR-0002): an enemy refused by a full pool simply never exists, and a formation counts
  it as refused, so destroying every member that did appear still earns the full-formation P.
  Up to 16 formations at once, one per enemy slot; the level simulation tests check a level
  never needs more *(initial)*.
- The hit flash (§9.4) lasts about 33 ms of wall time; the explosion burst lasts about 0.3 s
  (ADR-0010), at most 16 at once, the oldest recycled first.

### 5.3 Composition model

Enemies are **data, not classes**: an archetype is a configuration line combining
`EnemyStats` (HP, hitbox, sprite, score) + `MovementPattern` + `AttackPattern` + `DropTable`.
A sixth role in 1.x is a new line, not new code (Open/Closed). Detail in the UML class diagram.

### 5.4 Out of 1.0

Ground targets (two collision layers, terrain per level) and mid-bosses are **explicitly out** of
1.0; both are 1.x candidates and reuse existing machinery (Heavy stats, boss state machine).

---

## 6. Bosses

- One boss per level, announced by 3 s of silence, a "WARNING" banner and the boss track.
- **Phases by HP thresholds**: phase 2 at 66 % HP, phase 3 (level 3 only; levels 1–2 may use two
  phases) at 33 %. Each phase changes the bullet pattern and visibly **breaks a part** off the
  sprite (which may add a new attack).
- **Timer: 90 s.** When it expires the boss flees; the level ends without the boss bonus.
- **End of the fight** *(v0.4)*: when the boss is destroyed or flees, every enemy bullet on screen is
  cancelled and the boss body becomes harmless, so the player cannot die during the boss's dying
  or fleeing sequence.
- HP *(initial, L1 shots)*: Cruiser 1 800 *(v0.18; 1 450 in v0.12, 500 in v0.11, 300 in v0.10)*, Gantry turret 450, Mothership core 600 (the later bosses are rebalanced with their levels).
- Score: **10 000 + 100 × seconds remaining** on the timer *(initial)*. *(v0.10)* The bonus is
  flat: never multiplied by the chain, and it neither extends nor breaks the chain; hits on the
  boss score 0. The seconds remaining are the whole seconds the HUD shows (the steps left rounded
  up), so the bonus matches what the player saw.
- Boss bullets follow the same density ceiling (≤ 40 on screen) — bosses are read, not memorised.

**The warning** *(v0.10, initial)*: at the script's `warningAt` (120 s in level 1) the waves
stop — no row may spawn at or after `warningAt` − 4 s, a load check — and the enemies still on
the field live on. "WARNING" (FR "ATTENTION", title font) is shown over the field for **3 s** in
two slow blinks, under 3 per second (§9.7). The 3 s of silence and the boss track wait for audio
(screens and audio brick, G): until then the silence is a no-op. *(v0.23)* With audio (G3-2) the
level music fades out over the first 0.5 s of the warning, the warning sound plays, and the boss
track starts when the warning ends.

**Lifecycle** *(v0.10, initial)*: the boss **enters** — slides down from fully above the field,
not targetable, its body harmful — then **fights** while its 90 s timer runs, then is
**destroyed** (a 2 s explosion sequence) or **flees** (straight up at 60 px/s until off the
field); the level ends when either sequence ends. Shots pass through it except while it fights.
A **bomb** damages the boss only while it fights (300 tenths, as any enemy); in the warning or
the entry it has no effect on the boss. A bomb advances one phase per threshold crossed; one that brings it to 0 destroys it.
Its body hits the player while it enters and fights, never while destroyed or fleeing (above).
During the 2 s explosion sequence the ship keeps its control; its bullets are spent when the
level ends. If the ship is down when the sequence ends, the level end waits for its respawn; a
final death is Game over, which wins. The pause works normally during the warning and the fight, and the timer freezes
with it.

**Boss HUD** *(v0.10, initial)*: an HP bar at the top of the play field and the seconds left
(§9.2), from the start of the entry until the destroyed or fleeing sequence ends.

### 6.1 Level 1 boss — the Cruiser *(v0.10, initial)*

Alone, no escort. Values are tuned by playtest; at power 1 the Cruiser flees — a designed
failure, the bonus being the reward for growing the weapon.

| | Cruiser |
|---|---|
| Hitbox | 112 × 48 (its box never goes below y 80) |
| HP | 1 800 level-1 shots (18 000 tenths) *(v0.18; 1 450 in v0.12, 500 in v0.11, 300 in v0.10)*; phase 2 at 66 % (11 880 tenths; 9 570 in v0.12) |
| Timer and bonus | 90 s; 10 000 + 100 × seconds left |
| Entry | slides from y −24 to y 56 over **3 s**, at x 120 |
| Phase 1 | sways x = 120 ± 56 · sin(2π · t / 8 s); alternates a **fan** of 5 bullets 15° apart aimed at the ship at 85 px/s and a **ring** of 12 at 60 px/s, one volley every **0.9 s** (the first, a fan, 0.9 s into the fight), each pattern every 1.8 s *(v0.18; 75 px/s and 1 s before)* |
| Phase 2 | the forward turret breaks off (debris effect, §9.4); sways ±72 over 6 s; a **ring of 14** at 60 px/s every **1.25 s**, turned by 11.25° each volley, and an **aimed triple** (3 bullets 15° apart at 85 px/s) every **2.5 s** *(v0.18; a ring of 16, 1.5 s, 3 s and 75 px/s before)* |
| Flee | straight up at 60 px/s |
| Destroyed | a 2 s explosion sequence, then the level ends |

- The sway is centred on x 120 and starts there at the beginning of the fight. At the phase
  change the attack switches at once; the sway keeps its phase-1 path until the Cruiser next
  passes x 120, then follows the phase-2 path from there in the same direction, so the body never
  jumps. In phase 2 the box overhangs the field edges by up to 8 px at the ends of its sway.
- The phase-1 ring of 12 does not turn; its first bullet points straight down. The phase-2 ring
  turns by 11.25° per ring fired, counted from 0 at the phase change; its first ring and first
  triple fire 1.25 s and 2.5 s after the change *(v0.18; 1.5 s and 3 s before)*. Each pattern keeps its own count, so every replay is
  identical.
- Boss volleys follow the enemy-bullet pool's rule (§5.2.1): a bullet beyond the pool of 48 is
  dropped; the level simulation keeps the fight, phase 2 held for its whole timer, at ≤ 40.

---

## 7. Levels and pacing

### 7.1 Structure

Each level is a **declarative, typed, deterministic script**: an ordered list of timed events
(`at 8.0 s: spawn Popcorn ×6 on curve S-left`, `at 28.0 s: spawn Carrier carrying Shield`). The
same script with the same inputs and the same RNG seed always produces the same run — the
foundation for the headless simulation tests (ADR-0002) and for replays in v2.

Length *(initial)*: ~120 s of waves + ≤ 90 s of boss per level. *(v0.10)* Level 1: the opening
of §7.2 (0–45 s), a ramp (45–115 s, §7.2.2), the field drains, and the WARNING at 120 s
(`warningAt`); the script is checked at load: no spawn at or after `warningAt` − 4 s.

**Difficulty ramp** *(v0.9)*: the challenge rises **by script**, level after level and within a
level. Each level introduces new roles or patterns and grows denser and more aggressive. Level 1
becomes a real ~120 s script that builds up to the Heavy, then the boss (level brick), replacing
the 45 s interim loop (§7.2.2 *(v0.10)*); levels 2 and 3 reuse the roles with more HP, more shots and new
combinations. No hidden system adjusts the difficulty in 1.0: a rank that follows the player's
power and a harder second loop are left to after the playtests (1.x candidates, §10).

### 7.2 Level 1, the opening (pacing example and implicit tutorial)

| t (s) | Event | Teaches |
|---|---|---|
| 0 | Popcorn ×8 *(v0.11; was ×6)* on an S curve | Aim; full-formation reward (P drops) |
| 8 | Popcorn ×6 mirrored + Diver ×2 *(v0.12: this formation pays no P)* | Move; something aims at *you* |
| 18 | Gunner ×2 from the sides | Prioritise targets; dodge aimed bullets |
| 28 | Carrier crosses left → right with a Shield | Catch things before they leave |
| 32 | Popcorn ×8 + Gunner ×1 | Combine |
| 45 | Heavy from the top, ring pattern | Manage pressure; read a pattern |
| ~120 | Silence, WARNING, boss track *(v0.10: was 58 s; the ramp of §7.2.2 comes between)* | The boss grammar |

### 7.2.1 Script data of the first enemy rows *(v0.6, initial)*

Coordinates are play-field pixels (240 × 320, y down); "spawn" is where an enemy appears (for the
S curve, x0 is the curve's axis), "hover" where a Gunner stops. Members of a group appear one every
`interval`. Only Popcorn groups are formations (§5.2): a lone enemy or a group of another role
never is. *(v0.12)* A formation row may carry the optional property **pays P**
(default true: the formation pays the P of §4.6); a row with *pays P* false still spawns, fires
and scores, only its full-formation P is not paid. It is data in the level script, never an index
into it, so reordering the rows cannot move the reward. In the tables the rows without the P are
marked "no P".

| t (s) | Archetype | Count | Interval | Spawn | Hover / path |
|---|---|---|---|---|---|
| 0 | Popcorn | 8 *(v0.11)* | 1/3 s | x0 80, y −8 | S curve |
| 8 | Popcorn | 6 | 1/3 s | x0 160, y −8 | S curve, mirrored — no P *(v0.12)* |
| 8 | Diver | 1 | — | x 80, y −8 | dive |
| 8 | Diver | 1 | — | x 160, y −8 | dive |
| 18 | Gunner | 1 | — | (−16, 80) | (60, 80) |
| 18 | Gunner | 1 | — | (256, 80) | (180, 80) |
| 28 | Carrier | 1 | — | (−16, 64) | cross → right, cargo Shield *(v0.8)* |
| 32 | Popcorn | 8 | 1/3 s | x0 120, y −8 | S curve |
| 32 | Gunner | 1 | — | (120, −16) | (120, 80) |
| ~~40~~ | ~~Carrier~~ | ~~1~~ | ~~—~~ | ~~(256, 64)~~ | ~~cross ← left, cargo Bomb~~ *(v0.8 interim row, removed in v0.10: the Heavy is the Bomb source; 40 s is now Diver ×2, §7.2.2)* |

*(v0.8)* The level's dominant colour (§4.6) is red. The Bomb Carrier at 40 s is an interim row,
recorded as a deviation in the scene machine: it gives the Bomb pickup a source until the level
brick brings the Heavy, its real source, and is removed then *(v0.10: removed)*. No 1-UP Carrier
before the level brick: one per 45 s loop of the interim script would be far too generous
*(v0.10: one 1-UP Carrier at 78 s, §7.2.2)*.

### 7.2.2 Level 1, the ramp and the warning *(v0.10, initial)*

Same conventions as §7.2.1; a Heavy's spawn is straight above its hover point, fully above the
field. The rows follow the opening (0–32 s of §7.2.1, the Bomb Carrier row removed). Tuned by
playtest; the level simulation test keeps the whole script at **≤ 16 enemies** and **≤ 40 enemy
bullets** at once.

| t (s) | Archetype | Count | Interval | Spawn | Hover / path |
|---|---|---|---|---|---|
| 40 | Diver | 1 | — | x 80, y −8 | dive |
| 40 | Diver | 1 | — | x 160, y −8 | dive |
| 45 | Heavy (ring) | 1 | — | (120, −24) | (120, 72) |
| 50 | Popcorn | 8 *(v0.11)* | 1/3 s | x0 60, y −8 | S curve — no P *(v0.12)* |
| 52 | Popcorn | 6 | 1/3 s | x0 180, y −8 | S curve, mirrored — no P *(v0.12)* |
| 58 | Diver | 1 | — | x 60, y −8 | dive |
| 58 | Diver | 1 | — | x 180, y −8 | dive |
| 59 | Diver | 1 | — | x 100, y −8 | dive |
| 59 | Diver | 1 | — | x 140, y −8 | dive |
| 64 | Gunner | 1 | — | (60, −16) | (60, 64) |
| 64 | Gunner | 1 | — | (180, −16) | (180, 64) |
| 70 | Popcorn | 8 | 1/3 s | x0 120, y −8 | S curve — no P *(v0.18)* |
| 70 | Diver | 1 | — | x 40, y −8 | dive |
| 70 | Diver | 1 | — | x 200, y −8 | dive |
| 78 | Carrier | 1 | — | (−16, 48) | cross → right, cargo 1-UP |
| 82 | Gunner | 1 | — | (−16, 72) | (48, 72) |
| 82 | Gunner | 1 | — | (256, 72) | (192, 72) |
| 82 | Gunner | 1 | — | (120, −16) | (120, 56) |
| 90 | Heavy (fan) | 1 | — | (120, −24) | (120, 72) |
| 92 | Diver | 1 *(v0.11; was a Popcorn formation ×6)* | — | x 60, y −8 | dive |
| 93 | Diver *(v0.11)* | 1 | — | x 180, y −8 | dive |
| 102 | Heavy (ring) | 1 | — | (60, −24) | (60, 80) |
| 102 | Heavy (fan) | 1 | — | (180, −24) | (180, 80) |
| 110 | Popcorn | 8 | 1/3 s | x0 120, y −8 | S curve — the last formation P (the 3rd since v0.18, the 4th in v0.12) |
| 116–120 | — | — | — | — | calm: the field drains |
| 120 | WARNING | — | — | — | `warningAt`; the Cruiser (§6.1) |

*(v0.18)* Of the seven formations, in start order, those at 0 s, 32 s and 110 s pay the
formation P (3, 35 and 113 s into the level) and those at 8 s, 50 s, 52 s and 70 s do not; none
is removed, so the level keeps its enemies and its score. A player who catches every formation P
reaches power 4 at 113 s; power 5 needs a Gunner's P on top (10 % each), so it comes near 118 s in
the median measured run and some runs fight the Cruiser at power 4 *(v0.12: the 70 s formation
paid too, power 5 near 119 s from the formation P alone)*.

The 102 s pair is the peak of the level. *(v0.11)* The 92 s formation became two Divers on purpose: one formation P fewer, so the ship reaches its full power only near the boss, and only without dying. The one 1-UP of level 1 crosses high (y 48) at 78 s;
the Shield Carrier at 28 s stays; the Heavies are the Bomb and Shield sources (§5.2.1). The last
spawn is the 110 s formation's eighth member, at 112.3 s.

### 7.2.3 Level 1, the filler rows *(v0.21)*

The owner's daughter and the owner found level 1 too empty: a committed-bot measurement (the
AVERAGE profile of #56, 100 seeds) saw **no enemy on the field for 83 s of the first 116 s**
(median), because a player at power 2 or more kills a Popcorn or a Diver within a second, while
the script of §7.2.1 and §7.2.2 was paced for enemies that live longer. v0.21 adds the rows below
to the script, the rows of §7.2.1 and §7.2.2 unchanged. Every added row is a Popcorn formation
**with *pays P* false** or a lone Diver, so the power curve of v0.18 does not move (full power near
118 s); Gunners, Heavies and Carriers are not added, being the P, Bomb and Shield sources.
Same conventions as §7.2.1.

| t (s) | Archetype | Count | Interval | Spawn | Hover / path |
|---|---|---|---|---|---|
| 5 | Popcorn | 6 | 1/3 s | x0 160, y −8 | S curve, mirrored — no P |
| 10 | Diver | 1 | — | x 120, y −8 | dive |
| 12 | Popcorn | 6 | 1/3 s | x0 80, y −8 | S curve — no P |
| 15 | Diver | 1 + 1 | — | x 60 and x 180, y −8 | dive |
| 16 | Popcorn | 6 | 1/3 s | x0 120, y −8 | S curve — no P |
| 22 | Popcorn | 8 | 1/3 s | x0 120, y −8 | S curve — no P |
| 25 | Diver | 1 + 1 | — | x 80 and x 160, y −8 | dive |
| 26 | Popcorn | 6 | 1/3 s | x0 80, y −8 | S curve, mirrored — no P |
| 29 | Diver | 1 | — | x 120, y −8 | dive |
| 36 | Diver | 1 + 1 | — | x 60 and x 180, y −8 | dive |
| 38 | Popcorn | 6 | 1/3 s | x0 160, y −8 | S curve, mirrored — no P |
| 42 | Popcorn | 6 | 1/3 s | x0 80, y −8 | S curve — no P |
| 44 | Diver | 1 + 1 | — | x 60 and x 180, y −8 | dive |
| 55 | Popcorn | 6 | 1/3 s | x0 120, y −8 | S curve — no P |
| 57 | Diver | 1 | — | x 120, y −8 | dive |
| 60 | Popcorn | 6 | 1/3 s | x0 80, y −8 | S curve — no P |
| 61 | Diver | 1 + 1 | — | x 80 and x 160, y −8 | dive |
| 62 | Diver | 1 + 1 | — | x 60 and x 180, y −8 | dive |
| 66 | Popcorn | 6 | 1/3 s | x0 160, y −8 | S curve, mirrored — no P |
| 68 | Diver | 1 + 1 | — | x 80 and x 160, y −8 | dive |
| 74 | Popcorn | 8 | 1/3 s | x0 80, y −8 | S curve — no P |
| 75 | Diver | 1 + 1 | — | x 60 and x 180, y −8 | dive |
| 76 | Diver | 1 | — | x 120, y −8 | dive |
| 77 | Popcorn | 6 | 1/3 s | x0 120, y −8 | S curve — no P |
| 80 | Diver | 1 + 1 | — | x 100 and x 140, y −8 | dive |
| 86 | Popcorn | 6 | 1/3 s | x0 160, y −8 | S curve, mirrored — no P |
| 88 | Diver | 1 | — | x 120, y −8 | dive |
| 88 | Popcorn | 6 | 1/3 s | x0 80, y −8 | S curve — no P |
| 95 | Popcorn | 8 | 1/3 s | x0 120, y −8 | S curve — no P |
| 98 | Diver | 1 + 1 | — | x 60 and x 180, y −8 | dive |
| 99 | Popcorn | 6 | 1/3 s | x0 80, y −8 | S curve — no P |
| 101 | Diver | 1 | — | x 120, y −8 | dive |
| 107 | Diver | 1 + 1 | — | x 100 and x 140, y −8 | dive |
| 109 | Diver | 1 + 1 | — | x 60 and x 180, y −8 | dive |

A "1 + 1" row is two one-Diver rows at the same second. The 116–120 s calm (§7.2.2) stays, and
the ceilings of §7.2.2 still hold: **≤ 16 enemies and ≤ 40 enemy bullets at once** for a player
who never fires (the measured peak stays below the pool of 16, so no spawn is refused); denser
rows at 39, 48, 65, 72 and 93 s were tried and dropped because they broke that ceiling. Measured
with the bot (100 seeds): the median time without an enemy over the first 116 s falls from 83 s
to **65 s**; the average player dies 2.96 times per run (v0.19: 2.74) and loses 47 % of the runs
(45 %), within the guard of v0.18. The balance guard gains a band: **at most 70 s without an
enemy** in the first 116 s for the average player (median), so a later edit cannot empty the
level again. A larger fall needs tougher Popcorn or a higher ceiling (rejected for level 1, see
the decision record); levels 2 and 3 reach it by their own HP and density (§7.1).

### 7.3 Onboarding

No tutorial screen. Level 1 teaches one mechanic per wave (above). The title screen shows the
controls for the active input device, and the **first time** each pickup type appears in a run a
small label ("SHIELD", "BOMB", "1UP") floats above it for 1 s. *(v0.8)* The labels arrive with the
bitmap fonts of the screens brick (the title font has only A–Z and space, no digit for "1UP");
until then they are an interim deviation recorded in the scene machine.

*(v0.32, #147)* **Chain labels.** The HUD's ×N and its bar (§8, §9.2) are explained in play, never
by a screen: the **first time** the chain reaches ×2 in a run, **CHAIN ×2 - KILL FAST** /
**CHAINE ×2 - TUE VITE** floats for **1 s**; **every time** a chain at ×2 or more breaks (2 s
without a kill), **CHAIN BREAK** / **CHAINE ROMPUE** floats for **0.5 s**. A death resets the chain
without a label (the explosion already says it). Both are drawn in the `menu` font, which gains
the `×` glyph of the `hud` font, centred horizontally at the top of the play field (top edge at
field y 40, in play-field pixels whatever the layout), rising 8 px over their life, then gone; a new label replaces the one on screen. They follow
their own effect switch (§9.3, §9.4); off, the chain works the same, silently.

---

## 8. Scoring

- **Counter stop** *(v0.16, owner 2026-10-15)*: the score stops at **99 999 999**, the eight digits
  the HUD and the high scores show (the arcade way); a stored score above it is dropped.
- **Base points** per enemy (§5.2) and per boss (§6); a pickup at its cap gives a flat 1 000,
  outside the chain (§4.6) *(v0.8)*.
- **Graze** *(v0.31, #146, initial)*: **100** points per grazing bullet (§4.1), once per bullet,
  added flat — never multiplied by the chain, and it neither extends nor breaks the chain (like a
  pickup). Measured on the code with the balance bot (100 seeds, good / average / beginner): median
  scores 100 700 / 93 850 / 100 100 → **103 000 / 95 550 / 101 150** (+1 to +2 %), game over and
  boss kills unchanged, so the default High scores scale (150 000 → 30 000, §9.1) stays.
- **Chain multiplier ×1 … ×8** *(initial)*: every kill within **2 s** of the previous one extends the
  chain; the multiplier steps up every 5 chained kills (×2 at 5, ×3 at 10 … ×8 at 35) — a kill is
  scored at the current multiplier, then the chain steps up *(v0.4: the 5th kill scores ×1)*. The chain
  breaks after 2 s without a kill, and resets to ×1 on death. "Within 2 s" is inclusive: a kill
  exactly 120 steps after the previous one still extends the chain *(v0.6)*. The HUD shows the current multiplier
  and a shrinking chain timer bar. *(v0.32)* The first ×2 of a run and every break from ×2 or more
  are named by a short floating label (§7.3).
- **End-of-level tally** *(initial)*: full formations destroyed × 500; **no-bomb** 5 000;
  **no-miss** (no life lost) 10 000; remaining bombs × 1 000. *(v0.10)* Counted per level, added
  to the score flat (outside the chain) when the level ends: a formation completed by a bomb
  counts; only a life lost breaks the no-miss — a hit absorbed by the shield does not; any bomb
  used in the level loses the no-bomb; the bombs left are counted when the level ends. The boss
  bonus (§6) is scored when the boss is destroyed, not in the tally. A boss that flees adds no
  line; its bonus is scored only on destruction, before the tally.
- **Results screen** *(v0.10, initial)*: over a dim veil, the run frozen and the starfield
  scrolling, one line appears every **0.5 s**:

  | Line (EN) | Line (FR) | Value |
  |---|---|---|
  | FORMATIONS | FORMATIONS | the count, then the product: `3 × 500  1 500` |
  | NO BOMB | SANS BOMBE | 5 000 or 0 |
  | NO MISS | SANS PERTE | 10 000 or 0 |
  | BOMBS | BOMBES | the count, then the product: `2 × 1 000  2 000` |
  | TOTAL | TOTAL | the sum of the lines above, the bonus added to the score |

  Labels in the title font (A–Z and space only), numbers in the HUD font, which gains a space
  glyph (an empty cell) for these values; each label on its row
  at the left margin and its value right-aligned on the row below, so the longest line fits the
  240 px field in portrait (`10 × 500  5 000` is 15 HUD cells of 8 px, 120 px). A missed bonus is shown with 0, never hidden.
  *(v0.10, owner decision 2026-10-12)* A header LEVEL CLEAR / FIN DU NIVEAU, in the title font,
  stands above the lines. The player leaves by
  `confirm`, a tap or a click accepted after a **1 s** lock (as Game over, §4.4), or after
  **8 s**.
- **Local top 10** *(v0.9)* with a name of up to 8 characters and an optional country (arcade name
  entry, §9.1), stored in `localStorage` (ADR-0006, ADR-0021, §9.8). No online leaderboard in 1.0 (v2); the
  country is stored so the v2 board can use it.

---

## 9. Interface and meta

### 9.1 Screens (scene state machine)

```
Boot → Title ⇄ { Options, High scores, Credits }
Title → Playing ⇄ Paused → Options → Paused
Paused → Title (quit, after confirmation — the run is discarded, no name entry)
Playing → Level results → Playing (next level) | Ending
Ending | Game over → Name entry (if top 10) → High scores → Title
```

*(v0.26)* `Title → Country choice → Playing` at a *Play* while no country choice is saved;
`Options → Country choice → Options` at any time; and the run's end passes by the feedback offer:
`Ending | Game over → [Name entry → High scores] → Feedback offer → Title`. The title menu's
*Feedback* row opens the form directly, without the offer screen.

**The vertical slice** *(v0.10)*: one level, so the run is cleared when level 1 ends:
`Playing → Level results → Title`. The Ending card and the name entry come with the screens
brick (G); until then a cleared run, like Game over, returns to the title (an interim deviation
recorded in the scene machine). The level list is data: level 2 is an addition, not a change of
flow. A pending pause during the results is handled like one during a card (below).
*(v0.16: superseded for the cleared run)* A cleared run now goes Results → Ending (§9.1, the hall
of fame); a pause remembered during those Results is dropped, no play following them.

**Pause** *(v0.2)*: the player pauses at any moment (`pause` intent). The game also pauses on its
own when the tab is hidden, when the window loses focus, or when the gamepad in use disconnects —
and **never resumes on its own**. While paused the simulation is frozen (no tick, no timer, no
random draw), the music is ducked to −12 dB over 150 ms, game sounds stop and menu sounds stay
audible. Resuming shows a 1 s **3-2-1 count-in** (simulation still frozen). The frame loop keeps running; the paused scene
takes every step, so no paused time ever reaches the run *(v0.3)*. Quitting from pause asks for
confirmation, default "No"; a quit run is discarded and never offered the high-score entry.
*(v0.4)* An automatic trigger during a card, the results or the count-in is not lost: during the
count-in it returns to the pause at once; during a card or the results it is remembered and the
pause opens at the first step of play. Only the `pause` intent opens the pause; `back` is ignored
in play, so the gamepad `B` (bomb in play) never pauses. The keyboard `Esc` sends both `pause`
and `back`: it pauses in play and resumes from the pause menu. *(v0.7)* A change of screen layout
(a phone turned between portrait and landscape) is an automatic trigger too, and the gamepad
`Start` resumes from the pause (§4.2).

**Name entry** *(v0.9; v0.2: three initials)*: a name of **up to 8 characters** from A–Z, 0–9
and space, entered with an arcade **letter picker** usable on keyboard, gamepad, touch and mouse
(no system keyboard, no HTML field); no timer. The entry is optional: **skip** stores the name
`???`. *(Superseded in v0.26 for the country: it is chosen once before the first run, see the
country choice below.)* Then an optional **country**, preselected from the region of the browser language (for
example `fr-FR` → `FR`; none when the language has no region; *v0.30: the browser time zone first*), changeable or clearable; no
network call, no geolocation, nothing inferred beyond the language setting and, since v0.30, the browser time zone, both read offline (privacy, PRIV-1). The
country is shown as its 2-letter ISO 3166-1 code in the bitmap font, and as a pixel flag once the
sprites land (assets brick). *(Amended in v0.16: skipping, or confirming an empty name, records nothing; v0.9 stored `???`.)* the picker
controls per device are specified with the screens brick (G) in its UML study.

**The letter grid** *(v0.16, G2)*: the name is picked on a grid of cells 30 × 20 px, eight to a
row, under the name being built: eight slots, an empty one showing `-`, the next one on a bar.
The menu font gains `?` and `-` for this. The headings are drawn in the title font, the grid and
everything else in the menu font.
- **Name**: `A`–`Z`, `0`–`9` (36 cells), then *SPACE* / *ESPACE* (two cells wide), *DEL* / *EFF*
  and *OK* (40 places, 5 rows); under the grid, *SKIP* / *PASSER*, a row of its own the cursor
  reaches from the grid's last row, records nothing *(owner, 2026-10-14: the player is never made
  to appear in the table)* and returns to the title. The directions move the cursor, wrapping; a two-
  cell-wide cell is reached from either of its columns, and leaving it up or down keeps the column
  the cursor came from. `confirm` or a tap or click (on release, with the opening guard: the menus'
  rules of §9.1) adds the highlighted character; `back` (`Escape`, which also sends `pause`, and
  the gamepad's `B`) deletes the last one and never leaves; the name stops growing at eight
  characters. On *OK* the name is trimmed at both ends; an empty name, or one of spaces only,
  records nothing, like *SKIP* (ADR-0021, amended). The heading is *YOUR NAME* / *TON NOM*.
- **Country**, the next step *(superseded in v0.26: this step left the name entry; its grid, keys
  and cursor rule are now those of the country choice screen below)*: the same grid with the letters only, then *DEL* / *EFF*, *NONE* /
  *AUCUN* (two cells wide: no country) and *OK* (30 places, 4 rows), under the two-letter code
  being built, preselected from the browser language (ADR-0021 decision 4; *v0.30: the time zone first*). *OK* shows, and the
  cursor stops on it, only when the code is complete and in the allowlist; until then the cursor
  passes over its cell. *NONE* stores the entry without a country. The heading is *COUNTRY* /
  *PAYS*. The country step opens with the cursor on *OK* when the preselected code is known,
  else on `A` *(owner, 2026-10-15)*; there is no way back to the name, and *NONE* ends the entry
  at once.
- **As built** *(G2-3, owner 2026-10-15; the geometry superseded by v0.26 #115 below)*: the heading at y 48, the eight (or two) slots 16 px
  wide centred at y 88, the grid from y 120 (rows 20 px, *SKIP* ending at y 240); the name grid
  is 39 cells on 40 places, the country grid 29 cells on 30 places, the last two empty. A
  mostly-vertical tilt moves up or down, any other (a diagonal) sideways; left and right wrap
  within the row, up and down over the rows (so *SKIP* is also reached up from the first row),
  skipping empty places and a hidden *OK*; when *OK* disappears under the cursor, the cursor
  steps to the previous cell of its row. Spaces fill slots like characters; trimming happens on
  *OK*. The stored level is 1 while the slice has one level.
- *(v0.26, owner 2026-10-19)* **The country step is gone from the name entry**: the country is
  chosen once, before the first run (the country choice below), and the entry stores the saved
  choice, or no country when the player chose *NONE*. *OK* on the name, or `confirm` on it, stores
  the entry at once.
- *(v0.26, #115)* **Rows for touch**: the grid's rows are as tall as fit, by the rule of the menus
  (v0.25): `min(32, max(16, floor(free height / rows)))`, the free height being
  320 − 104 − 16 = 200 px under the slots with a 16 px bottom margin, the columns staying 30 px (eight to a
  row fill the 240 px field). The heading moves to y 40 and the slots to y 72; the grid starts at
  y 104. The name grid's 5 rows and *SKIP* (6 rows) and the country grid's 4 rows get 32 px each,
  about 43 CSS px on a 390 px-wide phone in portrait instead of 27. The cell is the whole 30 × 32
  box for a tap; the drawn highlight keeps a 1 px gap.
- Then the entry is stored (ADR-0021: name, optional country, score, the last level played, and
  the date as `YYYY-MM-DD`, given by the host — the domain reads no clock) and the high scores
  show it highlighted.
- `Pause` and the automatic pause triggers are ignored in the Ending, the name entry and the high
  scores: no run steps there.

**The high-score table** *(v0.16)*: ten entries, best first. A score above 0 enters it when the
table has fewer than ten entries or the score is strictly above the tenth; at equal scores the
older entry stays ahead. A run quit from the pause never enters it (§9.1). The **High scores**
screen (heading *HIGH SCORES* / *MEILLEURS SCORES* in the menu font: the title font would make the
French one 252 px wide) lists on ten rows, in the menu font, the rank (2), the name (8), the
country code (2), the score (7) and the level (1) in fixed columns (owner, 2026-10-15): the rank
right-aligned to end at x 24, the name from x 32, the country from x 104, the score
right-aligned to end at x 208, the level from x 224; the rows start at y 80, 16 px apart, and
the highlight spans x 8–232. The new entry is highlighted after a name entry, and an empty rank shows dashes. It is reached from
the title menu's *High scores* row (between *Play* and *Options*) and after a name entry; `back`,
`confirm` or a tap — a press started on the screen — returns to the title, locked for 1 s as
after Game over.

**The default table** *(v0.28, owner 2026-10-19, #128)*: while the save holds no table (a first
launch, a missing, unreadable or newer save, or no storage), the table starts with ten fictional players, so the screen
is never empty and a beginner has a target: ACE JP 150 000, NOVA FR 125 000, BLAZE US 110 000,
ORBIT DE 100 000, COMET GB 90 000, VEGA IT 80 000, ZEPHYR CA 70 000, PIXEL BR 60 000, LUNA ES
45 000, KITE KR 30 000, all at level 1 and dated 2026-10-19. They follow the table's rules like
any entry: a real score enters when strictly above the tenth and pushes the lowest out, and the
first real entry saves the whole table, fictional rows included. A stored table, even an empty
one, is kept as stored.

**The country choice** *(v0.26, owner 2026-10-19)*: the player picks a flag once, before
playing, not at every name entry. The screen is the name entry's former country step (the letter
grid with the letters only, *DEL* / *EFF*, *NONE* / *AUCUN* and *OK*; at the first *Play* the code is
preselected from the browser time zone, else the browser language's region (v0.30, ADR-0021 amendment of 2026-10-26), and from the options it starts on
the saved code, empty for *NONE*), heading *COUNTRY* / *PAYS*, with the rows of #115.
- It opens at a *Play* from the title while the save holds **no country choice** (a first launch,
  or a save written before v0.26); *OK* or *NONE* saves the choice (a code, or "none") and the run
  starts as from the title (through the gesture prompt when a gamepad starts before any gesture).
  `back` deletes a letter, and on an empty code returns to the title without saving: the question
  comes back at the next *Play*. The menus' 150 ms opening guard applies (the *Play* tap never
  lands on a cell); the cursor starts on *OK* when the preselected code is known, else on `A`.
- The options gain a *COUNTRY* / *PAYS* row (§9.3) showing the saved code, or `--` for none or no
  choice yet; activating it opens the same screen, which returns to the options, `back` included.
- *(v0.27, #125, ADR-0028)* **Flags**: once the typed code is complete and in `COUNTRY_CODES`,
  its 16 × 11 pixel flag is drawn 2 px right of the code's slots (the same flag as everywhere,
  below).

**Country flags** *(v0.27, owner 2026-10-19, #125, ADR-0028)*: wherever a country code is shown,
its pixel flag (16 × 11, the public-domain famfamfam set) is drawn **2 px right of the code**, its top 1 px
above the text's top (the 10 px font cell, centred on it): the options' *Country* row (the code
and the flag right-aligned together), each High scores row (the code stays at x 104, the flag
at x 120–136, left of the score), and the country choice. The letter grid stays the way to
choose (no flag picker: it would need scrolling). A territory with no flag of its own shows its
parent's (the set already draws BV and SJ as NO, HM as AU, UM as US; BL and MF show FR, BQ NL);
a code with no flag in the set (AQ, CW, IM, SS, SX, and GG, whose file is not public domain) or
a flag sheet not loaded shows **the code alone**, never a box or a placeholder. The champion's
name in the far background stays a name only (§9.4.1). Flags never flash or move, so they need
no switch.
- Changing the country changes later entries only; the table keeps each entry's own country.

**The feedback questionnaire** *(v0.26, owner 2026-10-19, ADR-0027)*: playtesters say what works,
what does not and what they would change, without the owner asking each by hand. It is
**optional** and never in the way.
- **Where the answers go**: an external form (Tally) that the owner edits on its site; the game
  only opens its address in a **new browser tab**. The game sends nothing itself, shows no e-mail
  address, and the questions change without a new game release.
- **The offer**: after every run end — Ending or Game over, after the name entry and the high
  scores when they show, never after a run quit from the pause — a *Feedback offer* screen:
  heading *YOUR OPINION* / *TON AVIS* (the title font has no `?`; amended in the feedback code brick, #122), one line *2 QUICK QUESTIONS* / *2 QUESTIONS RAPIDES*,
  then two menu rows, *GIVE FEEDBACK* / *DONNER MON AVIS* (the cursor starts on it) and *LATER* /
  *PLUS TARD*. *Later*, `back` or 20 s without input return to the title; *Give feedback* opens the
  form and returns to the title. `Pause` is ignored there, like on the high scores.
- **Always available**: the title menu gains *FEEDBACK* / *AVIS* as its last row, after
  *Options*; it opens the form at once (the title has four rows: *Play*, *High scores*, *Options*,
  *Feedback*).
- **The form**: one form with several **question sets**; each opening shows one set — **two
  questions** answered with one click, then *Did you meet a bug?* (yes / no) and an optional free
  text. The sets turn: the game counts the openings in the save and sends `set` = the count
  modulo **3** (3 sets, a constant of the game), plus `1`. Initial sets *(owner, in the form,
  editable there)*: 1 difficulty (too easy / just right / too hard) and wish to replay (yes /
  maybe / no); 2 controls (precise / fine / frustrating) and bullet readability (I see everything /
  sometimes lost / unreadable); 3 the boss (too easy / fine / too hard) and what made you lose
  (bullets / collisions / the boss / too few power-ups). In reserve, for later sets: level length,
  favourite weapon, music and sounds, overall rating, P frequency. *(An age band, picked by the
  owner, waits for the privacy review: the testers include children, GDPR Art. 8.)*
- **Privacy**: the form opens with a line saying the answers are anonymous and asking not to write
  names, e-mails or other personal data; the form keeps no IP or partial answers and the owner
  deletes answers after 12 months; the README's privacy section describes it (ADR-0027).
- **The context sent**, as the address's query parameters (the form's hidden fields), never
  personal data: `set`, `version` (§9.9, the `MAJOR.MINOR.PATCH` string only, without the commit), `score` and `level` of the last run
  (0 and 1 from the title before any run of the session), `country` (the saved code, `none` for no country, or empty when never asked),
  `device` (the device last used: `keyboard`, `gamepad`, `touch` or `mouse`) and `lang` (`en` or
  `fr`). Every value comes from an allowlist or is a number; the name is never sent.
- **Opening needs a gesture**: browsers block a new tab outside a click, tap or key press. A tap,
  click or key opens the tab at once; a gamepad press shows the gesture prompt, and the next click,
  tap or key opens it (ADR-0009). The tab is opened inside that input event's handler, never on a
  later frame. If the browser still refuses (it returns no window), the screen shows *OPEN
  BLOCKED* / *OUVERTURE BLOQUEE* for 2 s and the offer stays, and the count does not rise; refused
  from the gesture prompt, the game returns to the title with the same text (#122).
- **No form address configured** (a build without one): the *Feedback* row and the offer are not
  shown.

**The attract mode** *(v0.16, G2-3b, owner 2026-10-14 and 2026-10-15)*: after **10 s** on the
title without any input, the High scores show on their own for **6 s**, then the title comes
back, and so on while nobody plays. Any physical input counts — any key, bound or not, pressed
or held, a gamepad button or a tilted stick, a tap, a click, **a mouse move anywhere on the
page** (the side bands too) — and restarts the 10 s; the automatic pause triggers (focus loss,
rotation, a gamepad lost) are not inputs (ADR-0009, amended). A key or button held keeps the title
waiting. The attract
starts from the title only (never from the options, the controls or any other screen); the 1 s
lock after Game over counts as idle time. It shows the same table as the *High scores* row, empty
ranks as dashes even when the table is empty, with no row highlighted. During the attract any
input returns to the title **without doing anything else**: the title opens on *Play* with the
menus' opening guard (the press that ended the attract never acts, a key held across counts as
held), and **no 1 s lock**. The *Pause* key is such an input; it never pauses there.

**The Ending card** *(v0.16)*: after the Results of a cleared run, *VICTORY* / *VICTOIRE* in the
title font and the final score; `confirm` or a tap after a 1 s lock, or 6 s, leads to the name
entry when the score enters the table, else to the title. Its two sentences of story (§3.4) come
with the intro card's text, written with the assets brick. With it the slice-end interim
(`RUN_CLEARED` → Results → Title) ends: a cleared run goes Results → Ending.

**Menus** *(v0.13)*: every menu is a vertical list of rows that fits the 240 × 320 field without
scrolling (at most 12 rows of at least 16 logical px: 192 px of the 320). One row is highlighted.
- *(v0.25, #95)* **Row height**: each menu has its own row height, the tallest that fits, between
  16 and 32 logical px: `min(32, max(16, floor((320 − 2 × gap) / rows)))`, where `gap` is the
  space its header takes above the first row (none on the title, 16 for a header in the menu
  font, 32 in the title font, 48 on the controls screen: its title and the device line), kept
  free below the rows too. The rows stay centred on the field; the highlight bar, the hit area
  of a tap or click (the whole row band) and the text's centring follow the row height. At the
  usual phone scales (×4 portrait, 1.33 to 1.52 CSS px per logical px) the title, pause, quit
  and options rows (32 px) measure 43 to 49 CSS px, the *Visual effects* rows (24 px since v0.32, 12 rows; 26 px in v0.31, 28 px before) 32 to 36,
  the controls rows (24 px) 32 to 36 — against 21 to 24 CSS px before v0.25 (16 px rows).
  The page itself never zooms or scrolls under a finger (ADR-0018 decision 10); a deliberate
  pinch-zoom stays possible (WCAG 1.4.4). The name entry's letter grid is not changed here.
- **Title**: *Play*, *Options*; *(v0.16)* *High scores* between them; *(v0.26)* *Feedback* last,
  only when the build holds a form address. *Credits*
  with the assets (G4); a row is never shown before its screen exists. *(v0.14)* The title is a
  menu like the others: a run starts from *Play* (highlighted first, so `Confirm` still starts at
  once); a tap elsewhere on the screen no longer starts a run.
- **Pause**: *Resume*, *Options*, *Quit* (confirmation, default "No"). Options opened from the
  pause keep the simulation frozen and return to the pause; resuming still goes through the
  count-in.
- **Keyboard and gamepad**: up and down move the highlight (wrapping), `confirm` activates the
  row, `back` returns to the parent screen; left and right also flip a switch or step a choice.
- **Touch and mouse**: a tap or click **activates the row it lands on**, on release, and only if
  the release is on the row that was pressed (sliding off cancels, like native buttons). A press
  within 150 ms of the last activation on the same row is ignored, so a bouncing or doubled
  touch contact never flips a switch twice (checked when the press starts); a press within
  150 ms of a menu opening is ignored too, so a doubled tap on *Quit* never lands on *Yes*, the
  row then in its place. The mouse
  hover moves the highlight without activating. Every screen below the title shows a *Back* row,
  since touch has no `back` key. The highlight follows the last device used (ADR-0015).
- No menu has a timer or a timing-critical input (§9.7).
- *(v0.14)* **Leaving a menu for play frees the ship from the pointer**: every exit from a menu
  towards play (*Play*, *Resume*, `back` and the pause button in the pause) drops the movement
  owner if it is the mouse or touch, so a click on a menu row, which lies on the field, never
  hands the ship to the mouse and the ship never flies to where the menu was. The mouse takes the
  ship again by its next move on the field (ADR-0018 decision 4, unchanged otherwise). A keyboard
  or gamepad owner is kept, held direction included; buttons and the pause are untouched.
- *(v0.14)* **Switches and choices**: a row with a value shows its label on the left and its value
  on the right (*ON* / *OFF*, FR *OUI* / *NON*; the language as *ENGLISH* / *FRANCAIS*).
  Activating it — `confirm`, a tap, or a new left or right direction on keyboard and gamepad
  (detected on the edge, like up and down) — flips a switch or moves a two-value choice to its
  other value. The language value is always written in its own language (*ENGLISH*, *FRANCAIS*),
  whatever the game's language. A row that opens a sub-screen has no marker glyph.

### 9.2 HUD (outside the 240 × 320 play field)

Left: score, chain multiplier + timer bar, lives, bombs. Right: level number and name, weapon
colour and power level (1–5 pips), shield indicator. Lives are drawn as small ship icons, one
per reserve life (the ship in play not counted), and the chain timer as a shrinking bar *(v0.6)*. Boss HP bar at the top of the play field
during a boss fight *(v0.10, initial)*: a 1 px outline over x 8–232, y 4–8 of the field, filled in
proportion to the HP left, with a tick at 66 % (the phase-2 threshold); the seconds left in HUD
digits right-aligned under its right end (x 218–232, y 12–22); both drawn from the start of the
boss's entry until its destroyed or fleeing sequence ends, the timer showing 90 until the fight
starts. *(v0.10)* The HUD font draws digits, `×` and a space (§8). On narrow screens the HUD collapses into the top strip of the portrait
screen (§3.1) *(v0.5)*: two rows with 4 px margins — score then the reserve lives on the first,
the multiplier then the chain bar (aligned under the score) on the second — and the pause button
in its top-right corner (§4.2) *(v0.7)*. Positions and the 4 px margins are *(initial)*.
*(v0.32)* The HUD itself carries no help text: the chain labels of §7.3 explain the multiplier in
the play field.

**Player-kit items** *(initial, v0.8)*. Every icon differs by **shape**, not by colour only
(§9.7), each in its own palette colour; icons are 8 × 8:

| Item | Shape |
|---|---|
| Reserve life | a small ship (two rectangles) |
| Bomb | a plus sign, one per bomb in stock |
| Shield | a hollow square, while a charge is held |
| Weapon badge | Spread: three dots side by side; Laser: one vertical bar |
| Power | 5 pips of 3 × 8 px, every 6 px, filled up to the current level, hollow above |

- **Portrait strip** (`hud` pixels; everything ends at x ≤ 188, left of the pause button; row 1
  at y 4–14, row 2 at y 18–28): the shield icon on row 1 at x 172–180, y 5, after the lives; on
  row 2 the bombs at x 76 + 12 i, y 19, under the lives (5 icons end at x 132), the weapon badge
  at x 140–148, y 19, and the pips at x 152 + 6 i, ending at x 179.
- **Landscape bands**: the bombs in the left band at {x 8, y 66}, after the lives at y 52, every
  12 px. The right band starts below the pause button, at a margin x 368: y 56–76 stays reserved
  for the level number and name (level and screens bricks), then the weapon badge and the pips at
  y 84 (badge x 368–376, pips x 380 + 6 i, ending at x 407), and the shield icon at y 100.

### 9.3 Options

Music and SFX volume (separate), key / gamepad remap (§4.2), language (EN / FR), fullscreen,
and **visual effects**: one on/off switch per effect of §9.4, all default **on**. On first launch,
when the browser reports `prefers-reduced-motion`, screen shake, white flashes, hit-stop and slow
motion default to **off** *(v0.2)*, and so does the invulnerability blink, replaced by its
non-flashing form *(v0.5)*, and the bomb flash *(v0.8)*. *(v0.10)* The slow motion on boss death
is its own switch, on by default, off under `prefers-reduced-motion`; the debris and the WARNING
blink follow the explosions and the photosensitivity rule (§9.7). Browsers refuse fullscreen outside a user gesture: a change
made with a click, tap or key applies at once; otherwise the preference is applied at the next
click, tap or key press, including during a run *(v0.4, ADR-0009)*.

**Autofire (touch and mouse)** *(v0.9)*: off by default; when on, touch and the mouse fire all the time, as in v0.8,
for touchpad users and accessibility (§4.2, ADR-0020). Keyboard and gamepad are unchanged.

**Layout** *(v0.13)*: the options screen lists *Visual effects* ▸, *Autofire*, *Language*
(EN / FR), *Fullscreen* and *Back*. *Visual effects* opens a sub-screen: *All on*, *All off* (two
action rows; they ignore `prefers-reduced-motion`, which only presets a first launch), then one
switch per effect of §9.4 that the game draws (hit flash, hit-stop, screen shake, bomb flash,
invulnerability blink, muzzle flash, explosions with the boss debris, score pop-ups, boss slow
motion, the champion's name *(v0.22, §9.4.1)*, the graze spark *(v0.31)*, the chain labels *(v0.32)*; a switch appears with its effect), then *Back*. *Controls* (remap, §4.2) joins the options with the remap brick (G1b) and
*Audio* (the two volumes) with the audio brick (G3); neither is shown before. Every change
applies at once and is saved at once (ADR-0006).
*(v0.15)* *Controls* (*COMMANDES*) sits between *Visual effects* and *Autofire* (§4.2).
*(v0.26)* *COUNTRY* / *PAYS* ▸ sits between *Language* and *Fullscreen*; its value is the saved
code, or `--`; activating it opens the country choice (§9.1), which returns here.
*(v0.27)* The code is followed by its flag (§9.1, *Country flags*); `--` has none.
*(v0.23)* *Audio* ▸ (*AUDIO*) sits between *Visual effects* and *Controls*. It opens a sub-screen:
*MUSIC* / *MUSIQUE*, *SOUND EFFECTS* / *BRUITAGES*, then *BACK* / *RETOUR*. Each volume is a step
from 0 to 10 shown as its number; left / right move it by one (stopping at 0 and 10), an
activation adds one and wraps from 10 to 0, like every other value row. Defaults: music **7**,
sound effects **8** *(initial)*. The gain is (step / 10)², closer to how loudness is heard than a
straight line; step 0 is silence. A change applies at once (a menu sound plays at the new sound
effects volume) and is saved at once.
*(v0.14)* Row texts (EN / FR, capitals without accents): *OPTIONS*, *VISUAL EFFECTS* / *EFFETS
VISUELS*, *AUTOFIRE* / *TIR AUTO*, *LANGUAGE* / *LANGUE*, *FULLSCREEN* / *PLEIN ECRAN*, *BACK* /
*RETOUR*, *ALL ON* / *TOUT ACTIVER*, *ALL OFF* / *TOUT COUPER*, *BLINK* / *CLIGNOTEMENT*, *HIT
FLASH* / *FLASH IMPACT*, *EXPLOSIONS* / *EXPLOSIONS*, *SHAKE* / *SECOUSSE*, *BOMB FLASH* / *FLASH
BOMBE*, *SLOW MOTION* / *RALENTI*, *CHAMPION NAME* / *NOM DU CHAMPION* *(v0.22)*, *GRAZE* / *FROLEMENT* *(v0.31)*, *CHAIN HINTS* / *AIDE CHAINE* *(v0.32)*; the title menu *PLAY* / *JOUER*, *OPTIONS*, *HIGH SCORES* / *MEILLEURS SCORES*, *FEEDBACK* / *AVIS*
*(v0.26)*; *(v0.26)* *COUNTRY* / *PAYS*, and the feedback offer's *YOUR OPINION* / *TON AVIS*, *2 QUICK
QUESTIONS* / *2 QUESTIONS RAPIDES*, *GIVE FEEDBACK* / *DONNER MON AVIS*, *LATER* / *PLUS TARD*,
*OPEN BLOCKED* / *OUVERTURE BLOQUEE*, and the gesture prompt's *TAP OR PRESS A KEY* / *TOUCHE OU APPUIE* (#122). Hit-stop, muzzle
flash and score pop-ups get their texts with their effects. On the title the 1 s lock after Game
over or the Results ignores the whole menu (no highlight move, no activation).

### 9.4 Game feel (all effects individually toggleable in §9.3)

Hit flash (white, about 33 ms *(v0.6)*; the sprite's white silhouette *(v0.17, §3.2.1)*), hit-stop on large kills (2–3 frames), screen shake on bombs and boss
hits (the play field only; a bomb's shake is 4 logical px changing side every 33 ms and fading
out over 300 ms *(initial, v0.8)*), bomb flash (a tint of the play field, about 300 ms, at most 3 per
second *(v0.8)*), invulnerability blink (non-flashing replacement when off, §9.7) *(v0.5)*, muzzle flash,
explosion particles with size-scaled bursts, floating score pop-ups, slow
motion on boss death (0.5 s), boss "part breaks off" debris. *(v0.10, initial)* The slow motion
runs the game at half speed for 0.5 s of wall time from the boss's destruction (a time scale in
the loop: the explosion sequence keeps its 2 s of simulation, ADR-0010); explosions gain a Large
tier (the Heavy) and the boss's own; the debris is a burst of fragments where the broken part
was.
*(v0.31, #146, initial)* **Graze spark**: at a grazing bullet's position (§4.1), 4 small 1 × 1
fragments fly outward on the diagonals and fade over about **150 ms**: pale yellow for the first
half, a dimmer amber for the second (the render port has no transparency); no flash of the field,
no white, no sound (owner, 2026-10-28), so it stays within the photosensitivity rule (§9.7) at any
bullet density. Its switch is on by default, `prefers-reduced-motion` included (it moves little
and never flashes); off, the graze still scores, silently. A bullet grazing in the step the ship
dies scores only if the collision pass meets it before the killing bullet (deterministic, at most
100 points).
*(v0.32, #147)* **Chain labels** (§7.3): text only, no flash, no blink, so the switch is on by
default, `prefers-reduced-motion` included. With it, the visual-effects sub-screen reaches 12 rows of 24 px
(*All on*, *All off*, 9 switches, *Back*), the menu ceiling of v0.13.

### 9.4.1 The champion's name in the far background *(v0.22)*

A wink to the hall of fame (owner wish, 2026-10-13, re-asked 2026-10-16): now and then the name
of the number 1 of the high-score table drifts very dimly through the far background of a run.
Decoration only, it never competes with play.

- **What**: the name of the first entry of the table (§9.1), nothing else (no rank, no score, no
  country). An empty table shows nothing.
- **When**: in *Playing*, never on the title, its menus, Game over or the results. It first
  appears 40 s after the start of the run, then every 120 s (two or three passes in level 1). The
  pause, the count-in and the pause's screens keep it frozen with the starfield.
- **Look**: the menu font in the far-star colour (`starFar`), drawn right after the far star
  layer: under the middle and near stars and under every ship, shot, pickup and effect. No
  outline, no blink, no fade.
- **Motion**: downward at the far layer's 12 px/s, so a pass crosses the 320 px field in about
  28 s; its x is drawn once per pass from the presentation randomness, the whole name inside the
  field. Pure function of the background time, like the stars (ADR-0010): no gameplay draw, no
  allocation per frame.
- **Switch**: *CHAMPION NAME* / *NOM DU CHAMPION* in *Visual effects*, **on** by default, also
  under `prefers-reduced-motion` (a slow scroll like the stars, nothing flashes). A save without
  the key reads it as on, so the save stays version 2.
- **Later**: rare far-background objects (satellites, a distant planet) join this far layer with
  the art brick (G4), with their own design.

### 9.5 Audio

- **SFX** generated with an 8-bit synthesiser (jsfxr-style) *(initial list)*: player shot (spread,
  laser), enemy shot, hit, small / medium / large explosion, boss hit, boss phase change, boss
  death, pickup, power up, shield up, shield break, bomb, player death, 1-UP, menu move / confirm,
  warning, chain step, tally tick.
- **Music** *(initial)*: title, level 1, level 2, level 3, boss, final boss, results, game over —
  free chiptune tracks (CC0 / CC-BY) credited in `CREDITS.md`, replaced by custom tracks in the
  custom-asset phase (final boss first).
- Browser autoplay policy: audio starts on the first gesture *(v0.23: see* Unlock and visibility *below)*.

**The audio brick G3** *(v0.23, owner 2026-10-16)*:

- **The synthesiser** is the game's own small sfxr-style generator, not a library (no runtime
  dependency): square (with a duty), sawtooth, sine and noise waves, an attack / sustain / decay
  envelope, a frequency slide, vibrato and a simple low-pass. Each sound effect is a row of
  parameters in the code; the rows are rendered once, when audio unlocks, into sample buffers.
  The noise comes from the synthesiser's own seeded generator (a constant seed per sound, never
  the run's generator), so a sound is the same on every run and rendering never shifts gameplay.
- **Mix**: at most **16** sound effects at once (the oldest stops); the same sound started again
  within **33 ms** is skipped, so held fire never saturates; the player's shots sit lowest in the
  mix *(initial)*. The pause mix of ADR-0009 applies (music −12 dB, game sounds stopped, menu
  sounds kept).
- **The slice's music** is *NES Shooter Music* by SketchyLogic (OpenGameArt, **CC0**, credited in
  `CREDITS.md` though credit is optional): *Map* on the title and its menus, *Mercury* in level 1,
  *Boss* for the boss fight (its intro once, then its loop), one jingle on the Results and one on
  Game over (played once). The tracks ship as MP3 under `public/assets/audio/`, which every engine
  plays. Levels 2–3 and the final boss get their tracks with their levels.
- **Unlock and visibility**: the first click, tap or key unlocks audio (ADR-0009, §4.2
  *Activation*); before it the game is silent and nothing is queued. While the tab is hidden the
  audio is suspended, and it resumes when the tab shows again.
- **Saving**: the two volumes join the options in the save document; it stays at version 2, a
  missing volume reading as its default, as the champion's-name switch did (§9.8, v0.22).
- **Split** (owner, MCDA 425 / 500): this design, then G3-1 (synthesiser, Web Audio adapter, the
  sound effects on their events, volumes fixed at their defaults; the menu sounds of the
  title, pause and options menus), then G3-2 (with the chain step and the tally tick, which belong
  to the Results, and the menu sounds of the controls and name-entry screens) (music, the *Audio*
  sub-screen, the saved volumes).

### 9.6 Localisation

EN (default) and FR. Every player-facing string lives in a message catalogue; no string literals in
gameplay code. The one exception is the version label (§9.9), an identifier, not a sentence.

### 9.7 Accessibility

Tiny hitbox (fairness), pause at any time, no timing-critical menus, remappable controls,
photosensitivity toggles, no information conveyed by colour alone (pickups also differ by glyph
and shape), reduced-motion respected. *(v0.10)* Nothing on screen blinks or flashes more than 3
times per second: the WARNING banner blinks twice in 3 s.

### 9.8 Save data

`localStorage`, versioned schema *(key `retro-shmup.v1`)*: options (the autofire switch included, off by default; the music and sound-effects volumes *(v0.23)*)
and the top-10 table *(v0.9)*: name, country (optional), score, level reached, date. No account;
the only personal data are a name of 8 characters at most from the picker's alphabet and a
country the player chose. The document is untrusted input, validated by allowlist and parsed
without ever throwing (ADR-0006): the name matches A–Z, 0–9 and space with a length of 1 to 8, or
is exactly `???`; the country is absent or one code of the ISO 3166-1 alpha-2 allowlist kept in the
code; an entry failing either check is dropped (ADR-0021).
*(v0.26)* The options also hold the **country choice** — absent (never asked), `none`, or a code
of the allowlist; any other value reads as absent, so the question comes again — and the
**feedback count**, a whole number from 0 (absent or invalid reads as 0), raised by one at each
opening of the form. The save version stays 2: both fields are optional, as the volumes were in
v0.23.

### 9.9 Version label *(v0.20)*

The player can always read which build runs (owner request, 2026-10-16: playtesters quote it
in a report). It is a small **page text outside the canvas**, never drawn in the game: the
placeholder fonts have no `.` or `+` (ADR-0025 decision 6).

- **Text**: `v<version>+<short commit>`, for example `v0.1.0+abc1234`; without a commit (no git,
  no CI variable) just `v<version>`. The version is `package.json`'s, the commit is 7 hex
  characters; both are fixed at build time and never read at run time.
- **Place**: fixed in the bottom-right corner of the page, 8 px from the edges, 10 px
  monospace, white at 45 % opacity, visible on every screen (title, play, pause, results) in
  both orientations. It ignores pointer and touch (the press goes through to the game) and is
  not selectable. In a viewport the canvas fills exactly it may sit over the corner of the
  canvas (the landscape right band or the last portrait pixels of the field), never over a
  control: the touch pause button is top-right.
- **Not localised**: it is an identifier, not a sentence, so it bypasses the message catalogue
  (§9.6); the text is set with `textContent`.
- **Later**: brick G4 moves it into an Options / About row in the final font and removes the
  page text (ADR-0025 decision 6).

---

## 10. Difficulty

A single **Normal** profile ships in 1.0. The design nevertheless routes every difficulty knob
through one `DifficultyProfile` object (lives, bombs per life, shield charges, death penalty,
enemy HP multiplier, bullet speed multiplier, drop-rate multiplier) so that **Easy** and **Hard**
are one data line each in a later update, after itch.io feedback. YAGNI is respected: one
instance, no selection UI, in 1.0. *(v0.8)* The profile grows with the bricks that read its knobs:
the player-kit brick brings lives, bombs per life and the drop-rate multiplier (ADR-0019); the
death penalty stays a later knob, the rule being, since v0.29, a reset to the base weapon; the caps (power 5, bombs 5, lives 9, the 1 000-point bonus) are rules,
not knobs.

*(v0.9)* The difficulty **within** the Normal profile rises by script (§7.1, difficulty ramp), not
by a runtime system. A rank that follows the player's power (Battle Garegga style) and a harder
second loop after level 3 (DoDonPachi style) are decided after the playtests, for 1.x.

---

## 11. Scope

### 11.1 Version 1.0 (itch.io release)

3 levels + 3 bosses · 5 enemy roles with per-level palette swaps · 2 weapons × 5 levels ·
5 pickups · chain scoring + tally · keyboard, touch, gamepad, mouse · pause, fullscreen ·
local top 10 with name entry · options (volume, remap, language, accessibility) · EN / FR ·
full game feel with toggles · free chiptune + generated SFX · credits screen · deterministic
level scripts · GitOps deployment (Cloudflare Pages previews, itch.io via butler).

### 11.2 Version 1.x (post-release updates)

Boss practice mode · level select once finished · Easy / Hard profiles · CRT scanline overlay ·
end-of-run statistics · limited "continue" credits · mid-boss per level · ground targets ·
**ejected pilots / rescue mechanic (§12)** · custom art and music.

### 11.3 Version 2 (new chantiers)

Online leaderboard (Cloudflare Worker + KV) · replays (enabled by determinism) · PWA / offline ·
endless / score-attack mode built from the same wave bricks · Steam build (desktop wrapper,
achievements).

### 11.4 Explicitly out

Procedural level generation in the main mode · health bars for the player · dense bullet-hell
patterns · a game framework (Phaser) · ECS · continues in 1.0 · any backend in 1.0.

---

## 12. Signature-mechanic candidate (1.x): ejected pilots and rescue

**The idea** (owner, inception session): sometimes, when a ship explodes, its crew ejects in
escape pods that drift down slowly. Some of those pods carry **captured allied pilots** — the
player's own squadron, pressed into service by the armada. Catch the allies to rescue them; avoid
(or ignore) the hostile ones.

**Why it matters**: it would give the game a genuine identity ("free your squadron") and a
risk/reward layer that every player understands in one second. It is also a real design risk:
friend/foe must be readable in under 200 ms at 16 px, including for colour-blind players, and it
challenges the §4.6 invariant that everything falling is good to catch.

**Status**: deliberately **out of 1.0** ("keep it simple first"). A multi-lens design study
(precedents, scoring economy, readability, narrative, scope) is in progress; its brief will be
attached as an annex to this document, and the decision will be taken once the base game is
playable.

---

## 13. Technical constraints (summary — details in ADRs)

| Topic | Decision | ADR |
|---|---|---|
| Rendering | Native Canvas 2D behind a minimal `RenderPort`; a WebGL renderer may replace it later without touching gameplay | ADR-0001 |
| Screen | Logical screen 480 × 320 (landscape) or 240 × 352 (portrait) around the 240 × 320 field, integer scale in device pixels | ADR-0014, ADR-0015 |
| Input | One flat intent frame per step, physical-key bindings, gestures in the input adapter, devices combined | ADR-0009, ADR-0012, ADR-0015 |
| Simulation | Fixed timestep 60 Hz with accumulator, render interpolation, seeded RNG — deterministic; one seed per run, HP and damage in tenths of a shot, weapons as data | ADR-0002, ADR-0019 |
| Architecture | Object composition + patterns (Strategy, State, Object Pool, event bus, Command, ports); no ECS, no deep inheritance; UML-first; *(v0.10)* strategies built once by factories from tuning data, the boss one preallocated body outside the enemy pool | ADR-0003, ADR-0022 |
| Delivery | Cloudflare Pages (PR preview = staging, `main` = prod), itch.io via butler on tagged releases | ADR-0004 |
| Licensing | MIT for the code; assets under their own licences in `public/assets/` with `CREDITS.md` | ADR-0005 |
| Public hosting | `<game>.benoitbremaud.fr` (Cloudflare Pages custom domain, one project per game), attached once the title is final; `pages.dev` URLs before; catalogue in the portfolio's projects page, `benoitbremaud.fr/projets/#jeux` | ADR-0008, ADR-0016, ADR-0017 |
| Player data | `localStorage` only, versioned key; *(v0.9)* the top-10 entry holds a name of up to 8 characters and an optional country (§9.8) instead of three initials; no backend in 1.0 | ADR-0006, ADR-0021 |
| Performance | 60 fps on a 2019 mid-range phone; ≤ 4 ms of logic per frame; no allocation inside the game loop (pools) | ADR-0002 |
| Tests | Unit tests on the domain (TDD), headless level simulation with scripted inputs and seeded RNG, one browser smoke test in three engines (ADR-0026); render and audio mocked at their ports | ADR-0003, ADR-0026 |
| Quality gate | Local-first: husky hooks run gitleaks, lint, typecheck, tests with coverage, the dependency audit and the local SonarQube quality gate before every push; CI runs a light lint/typecheck/test job and the security scans | ADR-0007, ADR-0013 |

---

## 14. Open questions

| # | Question | Owner | When |
|---|---|---|---|
| 1 | Commercial title (check itch.io / Steam / trademark collisions) | Benoît | before the custom-asset phase |
| 2 | Art-direction twist (palette, hero silhouette) | Benoît + artist (TBD) | custom-asset phase |
| 3 | All *(initial)* tuning values | playtests | vertical slice onwards |
| 4 | Ejected pilots / rescue mechanic (§12) | design study → Benoît | after the base game is playable |
| 5 | Steam: wrapper choice (Tauri vs Electron), gamepad certification | — | v2 |

---

## 15. Glossary

**Shmup** — shoot'em up. **Popcorn** — trivial one-hit enemy. **Hit-stop** — a 2–3 frame freeze
on impact. **Juice** — feedback effects that make actions feel impactful. **Chain** — consecutive
kills within a time window. **Tally** — end-of-level bonus screen. **Vertical slice** — one level
fully playable at release quality, used to validate the design before producing the rest.

---

## Decision record (design decisions and rejected alternatives)

| Decision | Chosen | Rejected and why |
|---|---|---|
| Level-1 density *(v0.21)* | Owner, 2026-10-16: fill the empty stretches of level 1 with filler rows only, no P, the ceiling of 16 enemies kept (A1, 400/500; brick scope A, 425/500); guard band ≤ 70 s without an enemy | Levers: the ceiling raised to 20 enemies / 48 bullets (A2, 340/500: loosens a performance invariant, a busier screen for a child); Popcorn HP ×2 (A3, 340/500: reopens the v0.11/v0.12 time-to-kill). Scope: an Easy profile pulled forward from 1.x (D, 375/500); level 2 and the Gantry first (B, 330/500); a new enemy role or a 3rd weapon (C, 225/500: reopens the 5 roles and 2 weapons) |
| Version label *(v0.20)* | Owner, 2026-10-16: page text outside the canvas, `v<version>+<commit>`, always visible (A, 450/500, applies ADR-0025 decision 6) | An Options / About row in the canvas (B, 320/500: must be opened, needs `.` and `+` glyphs, a port and a screen); a title-screen footer in the canvas (C, 345/500: title only, new glyphs, revises the ADR) |
| Platform | Web (TS + Canvas) | Godot (less shareable, new language); Expo/RN (touch shmup ergonomics, heavier loop) |
| Scrolling | Vertical | Horizontal (does not match "targets fall"); fixed screen (no journey, flat bosses) |
| Art | 16-bit, CC0 then custom | 8-bit (bosses unreadable); vector neon (plan B if art becomes the bottleneck); hand-drawn from day one (blocks the slice) |
| Resolution | 240 × 320 | 270 × 480 (mobile-first, narrow on desktop); 224 × 288 (awkward scaling); adaptive (breaks balancing) |
| Weapons | 2 × 5 levels | 1 × 5 (less choice); Gradius option bar (complex to explain and balance) |
| Lives | 1 hit, 3 lives, shield charge | Health bar (bullets stop mattering); no shield (too hard for itch.io) |
| Death penalty *(v0.2, superseded by v0.29 below)* | −1 level + released pickup | Back to level 1 (death spiral); nothing (death is weightless) |
| Bomb | Stock, 2 per life | Rechargeable gauge (hard to balance, hoarded); none (no safety valve) |
| Difficulty | Normal only, profile modelled | 3 modes at 1.0 (triple balancing); no modes ever |
| Enemies | 5 roles / 3 sizes | 3 sizes (monotonous waves); + ground targets (two collision layers); + mid-boss (1.x) |
| Drops | Type per role, chance by rate, formation guarantee | Fully deterministic (no surprise); global random (target type meaningless) |
| Boss | HP-threshold phases + 90 s timer | Single phase (flat); targetable parts (1.x, sprite cost) |
| Score | Points + chain + tally | Points only (no replay value); medal items (sixth drop type, expert-oriented) |
| Levels | Declarative deterministic scripts | Procedural (not learnable, not comparable); hybrid endless mode → v2 |
| Bullets | Moderate (Raiden) | Bullet hell (niche, Canvas budget); sparse (flat bosses) |
| Universe | Space + mechanical armada | Military retro-futurist (kept the boss silhouettes); aliens (no battleship bosses); cartoon / organic (custom assets day one) |
| Narrative | Intro + ending cards | Per-level briefings (1.x candidate); none |
| Audio | Free chiptune + generated SFX | Custom from day one (blocks the slice); SFX only (boss without music) |
| Meta 1.0 | Pause, fullscreen, top 10, options, i18n, accessibility, credits | Online leaderboard (backend, anti-cheat, GDPR → v2); boss practice (1.x) |
| Rendering tech | Canvas 2D + RenderPort | PixiJS (unneeded GPU); Phaser (confiscates the architecture) |
| Architecture | Composition + patterns | ECS (oversized, poor UML fit); inheritance tree (explodes on crossed behaviours) |
| Tests | Pyramid + headless simulation + 1 smoke | Unit only (level regressions invisible); golden images (brittle) |
| TDD | Domain only | Everywhere (slows game feel work); none (domain coverage not guaranteed) |
| Deployment | Cloudflare Pages + itch.io | GitHub Pages (no private-repo Pages on Free plan, no native PR previews) |
| Rescue mechanic | 1.x candidate, study pending | In 1.0 (scope); dropped (identity potential too high to discard unstudied) |
| Key binding *(v0.2)* | Physical keys (`code`), primary + secondary slot, swap on conflict, fixed `confirm` / `back`, restore defaults | Character-based keys (break on AZERTY, `Z` clashed with ZQSD); single slot (loses the default alternates); unbind on conflict (can leave `pause` unbound) |
| Activation *(v0.2)* | A gamepad start before any click, tap or key asks for one | Starting silent and windowed (browsers unlock audio and fullscreen only on a gesture) |
| Pause *(v0.2)* | Manual or automatic (tab hidden, focus lost, gamepad lost), never auto-resume, music ducked, 1 s count-in | No auto-pause (hidden tabs freeze the loop: return mid-bullets); auto-resume (unfair restart) |
| Quit from pause *(v0.2)* | Allowed after confirmation, run discarded, no name entry | Record the score on quit (scores without finishing); no quit (only closing the tab) |
| Ending *(v0.2)* | Leads to name entry like Game over | `Ending → Title` (a full clear could not record its score) |
| Effect toggles *(v0.2)* | One switch per §9.4 effect; reduced-motion presets four to off (five with the v0.5 blink) | Two switches only (contradicted §9.4 and the project rules) |
| Edge rules *(v0.2)* | Start with Spread; no release at level 1; bombs hit the boss; capped pickup = 1 000 points; 9 lives max | Leaving them undefined (each would be decided ad hoc in code) |
| Contact and bomb kills *(v0.3)* | Enemy contact hits the player, not the enemy; bomb kills count for chain and formations; other-colour P at level 5 switches and scores 1 000 | Contact harmless (no reason to avoid bodies); bomb kills excluded (punishes the bomb twice) |
| Behaviour rules *(v0.4)* | Fly-in at every level start; bullets pass through an invulnerable ship; Game over after the death sequence; enemy bullets cancelled when the boss is destroyed or flees; kill scored before the chain steps; automatic pause remembered during cards | Game over at the hit (cuts the explosion); bullets consumed by an invulnerable ship; bullets kept after the boss (death during its sequence); automatic pause ignored during cards (play resumes unfocused) |
| Public hosting | One first-level subdomain per game on benoitbremaud.fr (ADR-0008); catalogue as the "Jeux" category of the portfolio's projects page, `/projets/#jeux` (ADR-0017) | Arcade subdomain with paths (routing Worker, shared storage); one repository for all games; the portfolio's own path; nested subdomains (viable, longer, inconsistent with the existing `bulle-de-je`); attaching the domain before the title is final (a rename strands saves) |
| Portrait screen *(v0.5)* | Portrait screen with a top HUD strip (§3.1), used when it fits with the larger integer scale (ADR-0015) | See ADR-0015, Alternatives considered |
| Base shot *(v0.5)* | Spread L1: one stream, 10 shots/s, 360 px/s | 15 shots/s at 480 px/s (less headroom to feel the power levels); no shot before enemies exist (no "move & shoot" in the first playable) |
| Devices together *(v0.5)* | The ship follows the device that owns the movement; buttons combine; *(v0.9)* the held pointer fire (left button, steering finger) combines like any button, and only the autofire option's always-on fire is limited to while touch or the mouse owns the movement (ADR-0015, ADR-0020) | See ADR-0015 and ADR-0020, Alternatives considered |
| Mouse bomb *(v0.5)* | Right click | See ADR-0015, Alternatives considered |
| Touch target *(v0.5)* | Absolute, 32 px above the first finger on the field; lifting keeps the ship in place | See ADR-0015, Alternatives considered |
| Stick *(v0.5)* | Radial dead zone, speed proportional to tilt up to the maximum, d-pad wins | See ADR-0015, Alternatives considered |
| Spawn and clamp *(v0.5)* | Straight fly-in from below the field; whole sprite kept in the field; blink 3 times per second (§4.1) | Centre-only clamp (wings clipped by the field edge); a faster arcade blink (above the photosensitivity threshold) |
| Enemy values *(v0.6)* | §5.2.1: full-box hitboxes, 75 px/s aimed bullets, Diver dive at 180 px/s, Gunner hover 3.5 s with one aimed bullet every 1.5 s | Hitboxes smaller than the sprite (the player's 4 × 4 hitbox already gives the fairness); three-bullet volleys from the start (kept for later levels) |
| Game over time *(v0.6)* | 3 s, shortened by Confirm | Waiting for Confirm only (a player who walked away sees a frozen screen forever) |
| Game over screen *(v0.6, owner playtest)* | Large "GAME OVER" (title font, message catalogue, "GAME OVER" in EN and FR) over the run playing on without the ship | A wordless frozen field (first design: read as a bug in playtest); only the starfield scrolling behind a frozen field; "PARTIE TERMINÉE" in French (longer, needs É) |
| Gunner entry *(v0.6)* | Straight line from a scripted spawn point to a scripted hover point, back the same way; sides and top share one movement (§7.2.1) | Every Gunner from the top in the enemies brick (a recorded deviation from §7.2, to undo later) |
| Chain window *(v0.6)* | Inclusive: a kill exactly 2 s after the previous one extends the chain | Strict (needs a 119-step timer or a different step order) |
| Lives icons *(v0.6)* | Reserve lives only, as in the arcade | Every life, the ship in play included |
| Portrait HUD strip *(v0.7)* | Two rows, 4 px margins, pause button in the top-right corner | One row (8 lives overflow, no room for the button); the HUD font at 1× (unreadable); drawing over the field |
| Touch pause button *(v0.7)* | Top-right corner in both orientations, drawn in play, pause and count-in | Top-left (competes with the score); the whole strip (accidental pauses); portrait only |
| Resuming without a keyboard *(v0.7)* | The gamepad `Start`; any tap or click until the pause menu (an interim deviation, recorded in the scene machine) | Only the pause button (hard to discover); `Start` keeps doing nothing in the pause |
| Leaving Game over *(v0.7)* | `confirm`, a tap or a click after a 1 s lock; the same lock on the title reached from Game over | No lock (hammering fire skips it and restarts a run); timer only |
| Mouse cursor and takeover *(v0.7)* | Crosshair; takes the ship only on a real move or a press on the field | Default arrow (hides the ship); hidden cursor; any move or click takes the ship |
| Rotation during play *(v0.7)* | Automatic pause | Play on while the screen rearranges |
| Player-kit scope *(v0.8)* | One brick: Spread and Laser on 5 levels, the 5 pickups, bombs, shield, the death rule, the drop sources (formation P, Gunner, Carrier cargo), the Carrier, the HUD items; the Heavy, ring and fan attacks, the boss and the tally go to the level brick | The Carrier and the Heavy together (too big for one brick); no new enemy (Shield, Bomb and 1-UP unreachable) |
| Power ratio *(v0.8)* | Measured on the aimed shot on one target (Spread centre stream, Laser); side streams add coverage; every bullet deals at least 1 (§4.3) | Literal 1 to 5 streams (no centre stream at even levels, 0.5-damage pairs, a Popcorn needing two hits); the ratio on the total output (side bullets under 1 damage) |
| Spread level-5 rate *(v0.8)* | 15 shots/s, a 4-step cooldown (+50 %) | +40 % (14 shots/s, a cooldown of 4.3 steps: not a whole number); a 5-step cooldown (+20 %, too little to feel) |
| Laser shape *(v0.8)* | Long pulsed bolts from the player bullet pool; "passes through N" enemies, so it hits N + 1; full damage on every body crossed, each body once | A continuous beam (segment collision, a new shape, damage per step); "hits at most N" (the level-1 Laser would equal the level-1 Spread) |
| Death release motion *(v0.8, void since v0.29: no release)* | Rises 48 px over 0.8 s, then falls at 20 px/s; released on the last life too | The v0.2 drift at 40 px/s from the death point (gone 1.4 s after the death, before the ship returns at 2 s: uncatchable); a slower fall only; held in place until the respawn |
| P colours *(v0.8)* | Formation P of the level's dominant colour (red in level 1); Gunner P red or blue, 50 / 50, from its one drop draw; the other-colour switch is accepted as a choice (§4.6) | The P takes the player's current colour (the second weapon would never be offered); a P cycling between colours (timing-based, unreadable at 16 px, colour-only information) |
| Carrier *(v0.8)* | 32 × 32, 4 HP, 500 points, a straight horizontal crossing at 60 px/s, no attack, 100 % script cargo; Shield Carrier at 28 s; an interim Bomb Carrier at 40 s; no 1-UP before the level brick | A 1-UP Carrier in the 45 s interim loop (a life every loop, far too generous) |
| Bomb timing and reach *(v0.8)* | One step, before the collisions; on-field enemies only, through the normal kill path; invulnerability max(time left, 1 s); usable in control only (`Vulnerable`, `Invulnerable`), one per press | Damage to enemies not yet on the field (kills the player never saw); a bomb during the fly-in or the death sequence (a free clear at every respawn, or a bomb lost to a dead ship); a fixed 1 s that can shorten a longer protection |
| Bomb shake *(v0.8)* | 4 logical px, changing side every 33 ms, fading out over 300 ms, the field only, deterministic (no random draw), its own switch | 2 px for 200 ms (too discreet for the "large shake" of §4.5); 8 px for 500 ms (hides the enemy bullets the bomb just cleared and the next ones) |
| Touch bomb *(v0.8)* | No drawn bomb button for now; the second-finger tap stays the only touch bomb; revisited with the options and screens | A landscape-only button (two behaviours by orientation); the bomb-stock icon as the tap target (the portrait strip is full and far from the thumb); a button over the play field (hides play) |
| Shield *(v0.8)* | One charge, a 36 × 36 ring outline in its own colour; absorbs a bullet or a body (the body survives), 0.5 s of invulnerability with the blink restarted; kept until used; none at the start | A ring in the hull's cyan (reads as part of the ship) |
| Shield collision *(v0.19)* | While a charge is held, enemy bullets and enemy or boss bodies collide with the drawn 36 × 36 square (the ring), not the 4 × 4 hitbox: any touch consumes the charge, once (#74, owner, 2026-10-16). Chosen by MCDA 395 / 500. Measured with the bot (100 seeds): the charge now breaks on near misses and is worth far less (beginner boss kill 41 → 13 %, average game over 28 → 45 %, good game over 18 → 37 %); the balance guard bands are widened to the measured values (beginner boss kill ≥ 10 %, average game over ≤ 50 %) rather than compensating with more shields | An inscribed Ø36 circle with the ring redrawn round (360 / 500: same measured balance, a new circle primitive on the render port); a 24 × 24 square with a smaller ring (285 / 500: the ring inside the 32 px sprite, unreadable); the ring for bullets only (measured identical: bullets alone consume the charge, so an exception for bodies buys nothing); more shield sources to compensate (300 / 500: a new tuning cycle) |
| HUD icons *(v0.8)* | Lives, bombs, shield, weapon badge and power pips told apart by shape (§9.2) | Icons told apart by colour only (§9.7) |
| Pickup rules *(v0.8)* | 16 × 16 box against the ship's 32 × 32 box; sway as a pure function of age; collected while `Entering`, `Invulnerable` or `Vulnerable`, after the hazards of the step; several in one step in the order of the active pickup list; a pool of 8; the cap bonus flat, outside the chain | A random sway (a cosmetic consuming gameplay draws); collection while dead (a dead ship would still power up); the cap bonus multiplied by the chain |
| Difficulty ramp *(v0.9)* | By script: each level adds roles or patterns, denser and more aggressive; level 1 a real ~120 s script up to the Heavy and the boss; levels 2–3 reuse roles with more HP, more shots, new combinations (§7.1) | Only more enemies on screen (density without new reading); decided after playtest, 1.x: a rank following the player's power (Battle Garegga: opaque, a new system), a harder second loop after level 3 (DoDonPachi) |
| Top-10 name *(v0.9)* | Up to 8 characters (A–Z, 0–9, space) with an arcade letter picker on every device; optional, "skip" stores `???` (§9.1, ADR-0021) | Three initials (less personal); free text with the system keyboard (an HTML field in a pixel game, poor on gamepad, free input to validate) |
| Top-10 country *(v0.9)* | Optional, preselected from the browser time zone, else the browser language's region *(v0.30)*, no network; the ISO 3166-1 code in the bitmap font, then a pixel flag with the sprites; stored for the v2 board (§9.1, §9.8, ADR-0021) | IP geolocation (a network call, forbidden in 1.0, privacy); the Geolocation API (permission prompt, disproportionate); no preselection (more friction); pixel flags for ~200 countries in 1.0 (asset cost); postponing to v2 |
| Pointer fire *(v0.9)* | Mouse fires while the left button is held; touch fires while a finger steers; an autofire option (the v0.8 behaviour) in the options; keyboard and gamepad unchanged (ADR-0020). Scored 46 | Always-on autofire kept (38: little control); mouse hold + touch always-on (35: touchpad and accessibility worse); a click toggling fire (41: state invisible without an indicator); fire only while moving (30); an option only (38) |
| Shot proportions *(v0.9)* | Enemy bullets drawn 6 × 6 with a 2 × 2 white core; Spread drawn 2 × 6, Laser at 60 % opacity; player shots translucent and slimmer; hitboxes unchanged; the sprites keep the proportions (§3.2) | Waiting for the sprites (enemy bullets lost in player fire); enemy bullets only; maximal contrast (player shots nearly invisible, firing feedback lost); smaller player hitboxes (balance risk); a 24 × 24 ship (balance) |
| Level 1 length *(v0.10)* | The §7.2 opening (0–45 s) kept without the interim Bomb Carrier, a ramp 45–115 s, the field drains, WARNING at 120 s (`warningAt`); no spawn at or after `warningAt` − 4 s (load check). Scored 33/35 | The boss at 58 s (20/35: no ramp, contradicts §7.1); the first Heavy pushed to ~100 s (21/35: a long stretch with no new reading) |
| Level 1 rows *(v0.10)* | §7.2.2: Divers at 40 s, a ring Heavy at 45 s, mirrored formations, Gunners from the top and then from three sides, the 1-UP Carrier high at 78 s, a fan Heavy at 90 s, the ring and fan pair at 102 s as the peak, the last formation at 110 s; ≤ 16 enemies and ≤ 40 enemy bullets checked by simulation. Scored 34/35 | Less dense (29/35: the ramp flattens before the boss); denser (24/35: the peak breaks the readability ceiling) |
| Heavy *(v0.10)* | 56 × 48, tier Large, 40 HP, 1 000 points; the Gunner's enter-hold-leave with its own values (2 s in, 10 s hold, out upward at 40 px/s); a ring of 12 at 60 px/s every 2 s turned 15° every other volley, or a fan of 5 at 75 px/s every 2 s; Bomb or Shield at 60 %. Scored 37/40 | A fixed ring (31/40: a safe lane once found); a 1.5 s, 75 px/s ring (32/40: too aggressive for its first appearance at 45 s) |
| Cruiser *(v0.10)* | §6.1: 112 × 48, 300 shots, 90 s, phase 2 at 66 %; a 3 s entry; phase 1 a fan and a ring alternating; phase 2 the turret breaks off, a turning ring of 16 every 1.5 s and an aimed triple; alone; flees at power 1 by design. Scored 36/40 | One pattern per phase and no debris (34/40: flatter, the break unseen); 3 phases with an escort (28/40: level-3 material, density risk) |
| After level 1 *(v0.10; superseded in part by v0.16, the hall of fame)* | The slice has one level: `RUN_CLEARED` → Results → Title; the Ending and the name entry with brick G (interim deviation); a data-driven level list. Scored 34/35 | Loop level 1 harder (15/35: contradicts the second loop deferred to 1.x, §10); straight to Game over (11/35: a cleared run read as a failure) |
| Results *(v0.10)* | §8: lines one every 0.5 s, a missed bonus shown with 0, leave by confirm or tap after a 1 s lock or after 8 s; only a life lost breaks the no-miss; bomb-completed formations count; the boss bonus flat, outside the tally and the chain; boss hits score 0. Scored 34/35 | All lines at once with zeros hidden (23/35: the player never learns the missed bonuses); a counting-up score with a skip (29/35: better with the tally tick of the audio brick, revisited then) |
| Boss staging *(v0.10)* | Waves stop at `warningAt`, enemies on the field live on; WARNING / ATTENTION for 3 s in two blinks; silence a no-op until audio; HP bar at the top of the field with a 66 % tick and the seconds left; bomb on the boss only while it fights, a crossed threshold advancing the phase; contact kills in the entry and the fight; the boss box above y 80; slow motion 0.5 s on its own switch; the ship keeps control during the 2 s explosion; one 1-UP Carrier; Popcorn bullets out of level 1; pause, timer and results pause as elsewhere | Validated by the owner as one batch with the technical decisions of ADR-0022, each the recommended option of the conception study; no alternative was scored separately |
| Level 1 balance *(v0.11, superseded in part by v0.12 below)* | After the friends' playtest (owner, 2026-10-13: "harder, more enemies, fewer power-ups, the ship always slightly weaker than the attack so the player plays strategically"), target "tense" (scored 90 against moderate 80 and hard 73). A headless study of 22 value sets with four scripted players picked set 18: Gunner P 30 → 10 %, Heavy drop 60 → 30 %, Gunner fire every 1.5 → 1 s, Popcorn rows at 0 s and 50 s ×6 → ×8, the 92 s formation → 2 Divers, Cruiser 300 → 500 shots. Measured: P per run about 11 → 8, power 5 reached near 120 s instead of 60–90 s, an average player dies about twice (once in the waves) with 15 % game over and 85 % boss kills. Not met by values alone: a skilled player still kills the Cruiser in about 10 s (target 40–70 s); the next iteration uses a more realistic scripted player and the testers' feedback (#45). Scored 83 | Ship set 18 and wait (71); better bots first (67); soften the Cruiser's phase 1 with HP ×3 (61); Cruiser HP 12 000 (an average player always loses) |
| Level 1 balance *(v0.12, superseded in part by v0.18 below)* | Second iteration of #45, superseding the v0.11 row for these values only (owner, 2026-10-14, after a measurement study with an "average player" bot swept over reaction times of 0.15 / 0.25 / 0.40 s, 100 to 300 seeds). (1) Cruiser 500 → **1 450 level-1 shots** (14 500 tenths), phase 2 at 66 % = 9 570 tenths; (2) the formations at **8 s, 50 s and 52 s no longer pay the formation P** (a per-row *pays P* property, default true; F1 0 s, F3 32 s, F6 70 s and F7 110 s keep it); no enemy or formation removed; Gunner 10 %, Heavy 30 %, Carrier, `dropRateScale` and the P-blue weighting unchanged. Measured, 300 seeds, bots good / average / beginner (0.15 / 0.25 / 0.40 s): Cruiser fight 42 / 42 / 44 s (target 40–70 s); the average bot dies 1.45 times per run (target 1–2); game over 10 % / 19 % / 32 %; boss killed 90 / 81 / 69 %, never fled; power 5 first reached at about 119 s, just before the boss (v0.11: 60 s in the same model). Limits, stated plainly: the bots are models, not humans (they collect P by drifting into drops and do not chase the rest); the step from power 4 to 5 rests on the 7th formation's P, so a player who misses it fights the boss at power 4, longer and harder, a cliff to watch in the playtest; the waves cannot be judged by bots and wait for the testers. | Cruiser HP 13 500 tenths (fight 36–38 s, too easy), 14 000 (fight at the edge of the band, average-bot deaths 1.12 but an unexplained 100 % game over of the dodger bot), 15 000 (average-bot deaths 0.87, just under the target; the fallback if the average game over must stay under 15 %: 11 % / 21 %), 15 500 (no better than 15 000), 16 000 (too hard, 25 % game over for the good bot); Gunner P 10 → 5 % (no measurable effect); fewer formations or every second formation without P (the average bot never reaches power 5, 23–45 % game over); removing formations (contrary to the owner's "more enemies") |
| Menus and options *(v0.13)* | G1a of the screens brick (owner, 2026-10-14): G split into G1 save, menus and options → G2 hall of fame → G3 audio → G4 art; G1 split into G1a (menus, simple options) and G1b (remap). Touch and mouse activate a menu row on release (slide-off cancels, 150 ms re-press guard, a visible *Back* row, hover highlights); options as sub-screens (*Visual effects* with *All on / All off*); rows appear only with their screen (no volume before audio, no controls before G1b) | Two taps (select then activate: 41/50, heavy on a phone for every switch); on-screen arrows (30/50); one scrolling list (30/50); one "reduced effects" switch instead of ten (contrary to §9.3, one switch per effect, needed for photosensitivity); everything in one G1 PR (32/50); for the G order, screens as one block (42/50), art first (35/50), audio first (32/50) against the chosen order (47/50) |
| Options screens *(v0.14)* | G1a-3 (owner, 2026-10-14): a row with a value shows label left, value right; any activation (confirm, tap, left or right) flips it, the two-value language choice included; the title becomes a menu (*Play* first) and a stray tap no longer starts a run; leaving a menu for play drops a mouse or touch owner of the movement (keyboard and gamepad owners kept), so a mouse click on *Resume* never hands the ship to the mouse (scored 46/50 against keeping the ADR-0018 jump, 33/50: a keyboard player clicking *Resume* would see the ship fly to the menu's place and could die without acting) | Left and right stepping a choice and confirm opening a list (no third value exists); the jump to the cursor kept |
| Controls screen *(v0.15)* | G1b (owner, 2026-10-14): one row per intent with two slot columns, one cell highlighted, the capture shown as *PRESS* (45→46/50); key labels learned from the session's key events, then the browser layout map, then US, with fixed names and arrow glyphs (46/50); the device edited is the last of keyboard and gamepad, followed live while choosing and fixed during a capture, the row hidden on touch only; restore defaults asks first; a closed set of capturable keys (labels of 10 characters at most, the rest refused) and buttons 0–15; an exchange that would empty a primary promotes the secondary or is refused; the answering step reads no menu action; save version 2 with a v1 migration and allowlist parsing of the bindings | One row per slot on two pages (31/50, no scrolling rule); a sub-screen per intent (34/50, two screens per capture); the layout map then US only (38/50: wrong on Firefox and Safari with AZERTY); US names always (30/50, contrary to "labels use the active layout"); a full font now (30/50, part of G4) |
| Menu row height *(v0.25)* | Owner, 2026-10-16, #95: each menu's rows as tall as fit, 16 to 32 px by its row count and header gap (B, 435/500: 43–49 CSS px on the title and pause at ×4) | Uniform 24 px rows (A, 410/500: about 32 CSS px, no menu reaches 44); 32 px rows on touch only with scrolling long menus (E, 325/500: a touch layout and scrolling, contrary to the no-scrolling rule); a fractional scale filling the screen (C, 230/500: breaks ADR-0014, 26 CSS px at most) |
| Hall of fame *(v0.16)* | G2 (owner, 2026-10-14): the name on a letter grid (43/50: 6 taps for a 6-letter name on a phone, the directions and `confirm` elsewhere, `back` deletes); the country on the same grid with the letters only, *OK* shown only for a complete code in the allowlist (44/50, revised up from the first analysis: a big-cell grid already built, 3 taps to change it); a score enters above the tenth only, ties keep the older entry first; *High scores* in the title menu; the Ending card *VICTORY* with the score, its two story sentences deferred to the assets brick | The arcade letter wheel (30/50: about 80 presses for a name, small arrows on a phone); the grid plus typing on a physical keyboard (42/50: a text capture in the adapter for little gain, kept for later if testers ask); the country as a two-letter spinner over valid codes (37/50) or a scrolling list (31/50, no-scrolling rule); *MISSION COMPLETE* in the title font (252 px, wider than the field) |
| Skipping the name entry *(v0.16, amended)* | Owner, 2026-10-14: *SKIP*, or *OK* on an empty name, records nothing and returns to the title — the player is never made to appear in the table (42/50) | Store the score as `???` (44/50 on paper, the v0.2 arcade rule, but against the owner's intent); both buttons, *SKIP* and *ANONYMOUS* (40/50) |
| Level 1 balance *(v0.18)* | Third iteration (#56), superseding the v0.12 row for these values only (owner, 2026-10-16, "far too easy": waves, boss, ship power, the whole level). A committed measurement bot (`tests/support/average-player.ts`: sample-and-hold looks every 0.15 / 0.25 / 0.40 s, a miss chance, a dodge that reads every bullet's path over 0.8 s; seeded) measured v0.12 on 200 seeds: the average bot dies 0.56 times, 2 % game over, kills the Cruiser in 27 s of its 90 s, reaches power 5 at 88 s. Lever package chosen by MCDA: a mixed, attenuated package (405/500) over durability only (385), bullet pressure only (360), slower power only (340), scarcity (275). Values chosen (V7, 415/500): aimed, fan and triple bullets 75 → **85 px/s** (rings stay 60); Gunner HP 8 → **10** shots, fire 1 → **0.8 s**; Heavy HP 40 → **50**; Cruiser 1 450 → **1 800** shots (18 000 tenths, phase 2 at 11 880), phase-1 volley 1 → **0.9 s**, phase-2 volley 1.5 → **1.25 s** with its ring 16 → **14** bullets (owner amendment 2026-10-16, 465/500: the ring of 16 at 1.25 s peaked at 45 enemy bullets, over the 40 of §6.1; the ring of 14 peaks at 40 and keeps the average-bot figures, beginner boss kills 24 → 41 %; rejected: a ring of 12, 415; the 1.5 s volley back, 370; raising the limit to 46, 325); the **70 s formation pays no P**. Measured on the code with the ring of 14, 100 seeds, good / average / beginner: game over 18 / 28 / 59 %, boss killed 82 / 73 / 41 %, the average bot dies 2.3 times, Cruiser fight 38 / 39 / 41 s, power 5 near 118 s (with the ring of 16, 200 seeds: 10 / 30 / 77 %, 90 / 70 / 26 %). Isolated effects on the average bot: bullets 85 none, Gunner none, Heavy +0.3 deaths, Cruiser 2 200 +0.6 deaths and +11 s, faster volleys +0.6 deaths, 70 s without P moves power 5 from 88 to 118 s; the levers compound. Limits: the bots are models (one is non-monotonic on some sets), so the numbers are bands to guard, not exact targets; the waves' feel waits for the testers. | V9 (385/500: Cruiser 2 000 and the 70 s P kept, power 5 still at 88 s, contrary to "ship power"); V2 (385/500: bullets 90, at the edge of a cliff — 100 px/s gives the good bot 73 % game over); V1 and V4 (280 and 315/500 under the first bot: the beginner almost never finishes) |
| Placeholder sprites *(v0.17)* | G4-1 (owner, 2026-10-15): Kenney *Pixel Shmup* (CC0) for the player, the five roles and the Cruiser; small enemies at 1× over their 16 × 16 hitbox (380/500); the Cruiser as hull ×2 between two 1× wings with the turret tile (410/500); the player's nose-up copy and the 2× sizes baked at load (430/500); `drawSprite` returns whether it drew, the presentation draws its shape otherwise (475/500) | Halving the small ships to 16 (260/500: hitbox larger than the drawing); hitboxes grown to the sprites (280/500, a balance change); the Cruiser as one ship ×3 (370/500) or kept as shapes (300/500); a `flipY` port parameter (360/500); a `hasSprite` query (440/500); the fallback drawn inside the adapter (270/500) |
| Sprite hit flash *(v0.17, G4-1b)* | Owner, 2026-10-15, after a headless capture showed the Cruiser as a white box for its whole fight: the flash draws the sprite's white silhouette, baked at load, through `drawSprite`'s `frame` (460/500); the box stays the fallback without sheets | The white box (325/500: sustained fire keeps the boss flashing); a blink instead of the flash (330/500); a translucent white veil over the sprite (295/500) |
| Champion's name *(v0.22)* | Owner, 2026-10-16: the number 1's name only, in *Playing*, menu font in the far-star colour under every other layer but the far stars, 12 px/s, first at 40 s then every 120 s, nothing with an empty table, its own effect switch on by default; satellites and a planet deferred to G4 art. Chosen by MCDA 470 / 500 | The name with satellites and a distant planet now (380 / 500: sprites still to draw, more background noise); the name on the title and attract screens only (385 / 500: not "far away during the game") |
| Audio *(v0.23)* | Owner, 2026-10-16, G3: SFX from an in-house sfxr-style synthesiser rendered once at unlock (440/500); the slice's music = SketchyLogic *NES Shooter Music*, CC0 (450/500); volumes 0–10 per step, defaults 7 / 8, gain (step / 10)², *Audio* between *Visual effects* and *Controls*, 16 voices, a repeat within 33 ms skipped (one batch); save kept at version 2, missing volumes = defaults (470/500); design then two code PRs (425/500) | The jsfxr npm package at run time (395/500: first runtime dependency); pre-rendered WAV files (350/500: ~22 files, no reproducible source); ppeak's *Action Chiptune* pack, CC-BY (325/500: modern sound, no game-over cue); no music in the slice (250/500); a save version 3 with a migration (300/500); one code PR (305/500) or three (375/500) |
| Laser stops on the first hit *(v0.24)* | Owner, 2026-10-16 playtest (#107): a bolt is spent on the first enemy or boss it touches, nearest along its path; width and damage per level unchanged; the pass-through memory stays in the code with zero pass-throughs (data only) | The v0.8 pass-through 1 → 3 (read as a bullet going through an enemy); removing the pass-through machinery from the code (a refactor with no player-visible gain) |
| Player hitbox *(v0.24)* | Owner, 2026-10-16 (#106): the hitbox grows from 4 × 4 to a 6 × 6 body core (cockpit and fuselage), to be playtested (415/500); the level-1 balance bot measured 6 × 6 outside the v0.18 bands, which are widened to the measured values until the playtest settles them (the balance guard of #56); the wings still let bullets through; the cockpit square drawn on it grows with it; no tunnelling (3.9 px per step for a 10 px window) | Keeping 4 × 4 (first recommended, 430/500: the owner found it too forgiving in play); 8 × 8 as is (400/500: the bot's good player at 74–81 % Game over, the beginner at 1–2 % boss kills); 8 × 8 with a compensating rebalance in the same PR (320/500: two changes in one playtest); the hitbox as the 32 × 24 sprite (unfair deaths on the wings, a full rebalance) |
| Country first *(v0.26)* | Owner, 2026-10-19: the country is chosen once, at the first *Play* while none is saved, and changed in the options; the name entry loses its country step (440/500); the screen at the first *Play* rather than at boot (425/500: the attract mode keeps running); the letter grid's rows grown for touch in the same brick (#115, 430/500) | The country before every run (340/500: a step per run); asked first and kept preselected in the name entry (385/500: one step per entry still); the screen at boot (345/500: blocks the attract mode); #115 as its own PR later (320/500: two passes on the same grid) |
| Feedback questionnaire *(v0.26)* | Owner, 2026-10-19 (ADR-0027): optional; an external Tally form opened in a new tab, no e-mail address shown, questions edited in the form without a release (445/500); one form whose question set is picked by a hidden `set` field, one form per set as the fallback if the form cannot branch on a hidden field (445/500); 3 sets of two one-click questions, then *bug?* and a free text (400/500: about twice the answers per question with ~10 testers); offered after every run end and always in the title menu (400/500) | A pre-filled `mailto:` link (375/500: the owner's address public, no mail client on many computers); answers kept locally with an export (330/500); a fixed form (380/500: no rotation); 5 sets (305/500) or 6 (280/500: ~2 answers per question); multiple-choice questions drawn in the canvas (325/500); an HTML form over the canvas (370/500: a text field in the page, against the no-field rule); offered once a session (380/500) or only from the title (350/500) |
| Country flags *(v0.27)* | Owner, 2026-10-19 (#125, ADR-0028): a 16 × 11 pixel flag beside the code, the letter grid kept for the choice (410/500); the public-domain famfamfam 16 × 11 set packed in one sheet (450/500); the flag right of the code (460/500: a missing flag leaves no hole, the code column stays at x 104); parent flags for the territories without one, else the code alone; no flag in the far-background name (410/500: §9.4.1 keeps one dim colour) | A flag picker grid replacing the letters (235/500: needs scrolling); codes only (390/500); emoji flags (none on Windows, not pixel art); flag-icons SVG rasterised (340/500: blurry) or flags drawn from data in code (350/500: ~250 specs, poor emblems); the flag left of the code (395/500); a dimmed colour flag (380/500) or a bright one (310/500) in the far background |
| Default high scores *(v0.28)* | Owner, 2026-10-19 (#128): ten fictional players on a tightened scale 150 000 → 30 000 (460/500: the balance bot's medians, 88 500 to 101 600, land mid-table), used only while the save holds no table, pushed out by real entries | An empty table (no target); a wide scale up to 500 000 (out of reach); a flat scale; a separate fixed list beside the real table |
| Death penalty *(v0.29)* | Owner, 2026-10-22 (#130, playtest), superseding the v0.2 row and the v0.8 release motion: losing a life puts the ship back on the **base weapon, the Spread at power level 1** (MCDA 395/500; same weapon kind at level 1 390, a level-2 return 335); **no P is released** at the death (445/500; keeping the one-level P 295, releasing the whole lost power 235: with the reset to the Spread a "P of the current colour" would hand every player a Spread level, a rule that no longer means anything); **bombs (2), chain (×1) and the last life unchanged** (430/500; bombs 3 as compensation 325, chain kept 275). Risk, stated plainly: the v0.2 row rejected "back to level 1" as a death spiral; the level-1 balance (#56, v0.18: bot medians 88 500 / 94 750 / 101 600, the default High scores scale 150 000 → 30 000 of #128) was measured with the one-level penalty and is **re-measured in the code PR** with the committed bot, which re-sets the bands and the scale (445/500; a throwaway patch measured here 360, hand estimates 280); measured on the code (100 seeds, good / average / beginner): game over 60 / 61 / 97 % → **98 / 98 / 100 %**, boss killed 40 / 40 / 3 % → **2 / 2 / 0 %**, average deaths 3.32 → 3.91, power 5 reached 52 → 35 % (average), Cruiser fight unchanged (40 s), median scores unchanged (100 700 / 93 850 / 100 100), so the default High scores scale stays 150 000 → 30 000; the owner accepted the harder level (MCDA 415/500: guard bands re-anchored on the measure; widening them until the playtest 340; compensating now with more P, a design change, 315), compensation after the playtest. The Spread is level 1's dominant weapon and the formations' P keep coming, so the cliff is the Laser player, who loses their weapon; watch it in the playtest | Same weapon kind at level 1; return at level 2; one-level P kept (inconsistent after the reset); the whole lost power released (undoes the request); compensation by bombs or a kept chain (new exceptions to "a death resets"); measuring on a throwaway patch (figures nobody can replay) |
| Country preselection *(v0.30)* | Owner, 2026-10-26 (#131, option A of 2026-10-22, 450/500): the **time zone first** (`Intl.DateTimeFormat().resolvedOptions().timeZone`, e.g. `Europe/Paris` → `FR`), then the region of the browser's first language, then none (465/500); the zone → country table **generated from the IANA `zone.tab`** and its backward links, one country per zone, kept only for codes in `COUNTRY_CODES`, committed as domain data and refreshed with releases (455/500). `UTC`, `Etc/*` and unknown zones give no country, so the language decides; a VPN does not change the time zone (system clock); the code is still only a default, stored once the player confirms | The language first, the time zone as fallback (395/500: an English speaker in France keeps `US`, the defect of #131); the time zone only when the language agrees (415/500: a vote rule for the same answers); a hand-written table of ~50 zones (355/500); `zone1970.tab` taking its first country (385/500: `Europe/Berlin` also covers DK, NO, SE); an IP lookup (network call, third party, forbidden in 1.0) |
| Graze *(v0.31)* | Owner, 2026-10-28 (#146, playtest: bullets crossing the wings read as a bug), option D of the triage (410/500: keep the 6 × 6 hitbox, add a graze): the **graze box is the drawn 32 × 24 ship minus the 6 × 6 hitbox** (445/500); **100 points**, flat (365/500); **once per bullet** (470/500); **neutral for the chain** (410/500); a **spark only, on its own switch, no sound** (430/500; a spark and a tick 415, close: revisit after the playtest). Only a `Vulnerable` ship without a shield charge grazes | A ~12 × 10 hitbox with a rebalance (330/500); the whole sprite as hitbox (280/500); visibility only (410/500, tie broken toward the reward); a per-pixel wing mask (340/500: one mask per sprite, redone with the final art); the 32 × 32 ship box (315/500: rewards empty space); 500 points (290/500: breaks the scale) or 10 (275/500: unnoticed); a graze per step of contact (250/500: parking on a bullet pays) or with a global delay (340/500); a graze extending the chain timer (295/500) or counting as a chained kill (220/500); a +100 pop-up per graze (350/500: clutter) |
| Chain labels *(v0.32)* | Owner, 2026-10-28 (#147: the ×N and its bar were never explained), option D of the triage (450/500: a first-×2 label and a break label): **CHAIN ×2 - KILL FAST** / **CHAINE ×2 - TUE VITE** and **CHAIN BREAK** / **CHAINE ROMPUE** (475/500; the `menu` font gains `×`); the first ×2 of a run for **1 s**, every break from ×2 or more for **0.5 s**, none at a death (450/500); their **own switch** *CHAIN HINTS* / *AIDE CHAINE*, on by default (450/500); **fixed, centred near the top of the field**, rising 8 px (435/500) | A label only for the first ×2 (435/500); a help page (300/500) or both (345/500); COMBO wording (420/500) or CHAINE ×2 - VITE (380/500); both labels 1 s (390/500) or 1.5 s / 0.75 s (380/500); one shared LABELS switch with the pickup labels (370/500) or the explosions switch (270/500); under the HUD multiplier (400/500) or following the ship (305/500) |
