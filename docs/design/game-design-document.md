# Game Design Document — retro-shmup (codename)

| | |
|---|---|
| **Status** | Design phase — v0.2 (2026-10-08): v0.1 consolidated the inception brainstorming (2026-10-07); v0.2 folds in the rules surfaced by the UML use-case study |
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
- **DoDonPachi** — chain multiplier, death releases the power-up, bees as risk/reward items.
- **Fix Your Timestep!** (Glenn Fiedler) — deterministic fixed-step simulation.

---

## 2. Core loop

```
move & shoot  →  destroy enemies  →  catch what they drop  →  grow stronger
      ↑                                                            │
      └──────────── die: lose one power level, recover it ─────────┘
```

Per level: scripted waves (~2 min) → warning → boss (≤ 90 s) → results tally → next level.
A full run is three levels, about 15–20 minutes.

---

## 3. Presentation

### 3.1 Screen and scale

- **Internal resolution 240 × 320 px** (3:4, arcade vertical). The game is rendered to an
  off-screen canvas at this size and scaled by an **integer factor** (×3 = 720 × 960 on a 1080p
  display) with nearest-neighbour sampling (`imageSmoothingEnabled = false`,
  `image-rendering: pixelated`). Never fractional scaling.
- On 16:9 displays the play field sits centred; the side bands carry the **HUD** (see §9.2).
- On phones in portrait the play field is letterboxed top/bottom; the ship follows the finger.
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

- 32 × 32 px sprite, eight-direction movement, constant speed *(initial: 150 px/s, i.e. the play
  field crossed in 1.6 s)*. Movement is clamped to the play field.
- **Hitbox: 4 × 4 px** at the sprite's centre. The visible ship is much larger than what can be
  hit; bullets graze the wings. This is the genre's standard since the 1990s and the single most
  important fairness rule of the game.
- Spawn / respawn: the ship enters from the bottom with **2 s of invulnerability** (blinking).

### 4.2 Controls

| Priority | Input | Model |
|---|---|---|
| P0 | Keyboard | Move: arrows (primary), `W A S D` physical keys (secondary — the same keys read Z Q S D on AZERTY); fire `Space` / `Z` (hold = autofire); bomb `X` / `Shift`; pause `P`; `Enter` confirm; `Esc` pauses in play and goes back in menus (fixed). Remappable. |
| P1 | Touch | The ship follows the finger with a vertical offset so the thumb never hides it; autofire always on; bomb = on-screen button or second-finger tap; pause = on-screen button. |
| P1 | Gamepad | Left stick / d-pad move; `A` fire; `B` bomb; `Start` pause (Gamepad API). Remappable. |
| P2 | Mouse | Ship follows the cursor; autofire; right click or `Space` bomb. |

Inputs are translated to **intents** (`move`, `fire`, `bomb`, `pause`, `confirm`, `back`) so the
game never knows which device produced them (Command pattern, see the UML study).

**Bindings** *(v0.2)*: keyboard keys are bound by **physical key** (`KeyboardEvent.code`), so a
layout change (QWERTY, AZERTY) never breaks them; labels shown to the player use the active
layout. Each remappable intent (`move` ×4, `fire`, `bomb`, `pause`) has a **primary and a
secondary slot** per device. Remapping edits one slot; a key already used elsewhere **swaps**
with it, so no intent is ever left unbound. `confirm` and `back` are fixed (`Enter` / `Esc` on
keyboard, `A` / `B` in menus on gamepad) to prevent lock-out; `Esc` is never bindable (browsers
also reserve it to leave fullscreen). `Z` and `X` are physical positions too: they never collide
with the `W A S D` block, on any layout. A "restore defaults" action exists per device. While
waiting for a new key, `Esc` cancels on keyboard; on gamepad the wait cancels itself after 5 s
(every button may be a binding). Touch and mouse have no discrete bindings and are not
remappable.

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
| **Spread** (red) | P-red | Wide fan of bullets, good against formations, lower single-target damage | 1 → 5 streams, widening fan, firing rate +40 % at L5 |
| **Laser** (blue) | P-blue | Narrow piercing beam, high single-target damage, demands aim | Beam width 2 → 8 px, damage ×1 → ×3, pierces up to 1 → 3 enemies |

Damage output grows roughly ×1.0 / ×1.4 / ×1.9 / ×2.4 / ×3.0 from L1 to L5 *(initial)*. Enemy HP
is expressed in **level-1 shots** so this ratio is what the player feels as "power".

### 4.4 Lives, shield, death

- **One hit = one life.** 3 lives at start *(initial)*, the ship in play included; at most 9
  (HUD limit); extra lives only from **1-UP** pickups.
- **Shield**: a pickup grants **one charge**, drawn as a ring around the ship. The next hit consumes
  the charge instead of a life (0.5 s invulnerability, no other penalty). Charges do not stack.
- **On death**:
  1. the current power level drops by **one** (never below 1),
  2. a **P pickup of the current weapon colour** is released at the death position and drifts down
     slowly — catching it restores the lost level; at level 1 there is nothing to restore, so
     nothing is released *(v0.2)*,
  3. the chain multiplier resets to ×1,
  4. bombs are reset to **2**,
  5. the ship respawns after 1.5 s with 2 s of invulnerability.
  Lives at 0 → **Game over** (no continues in 1.0).

### 4.5 Bombs

- Stock **2 per life, maximum 5** *(initial)*; **Bomb** pickups add one.
- Effect: every enemy bullet on screen is cancelled, every enemy **including the boss** takes heavy
  damage *(initial: 30 level-1 shots — 5–10 % of a boss)*, the player is invulnerable for **1 s**,
  large screen shake (toggleable). With an empty stock the input does nothing.
- A bomb used is noted for the end-of-level tally (no-bomb bonus lost).

### 4.6 Pickups

All pickups fall straight down at a slow speed *(initial: 40 px/s)* with a slight horizontal sway,
and are collected by touching them with the ship's full sprite (generous: 32 × 32). A pickup that
leaves the bottom of the screen is lost.

| Pickup | Visual | Effect | Typical source |
|---|---|---|---|
| **P-red** | Red "P" capsule | Select Spread; +1 power level (max 5) | Gunner, full Popcorn formations, death release |
| **P-blue** | Blue "P" capsule | Select Laser; +1 power level (max 5) | Gunner, full Popcorn formations, death release |
| **Shield** | Cyan ring | One shield charge | Carrier, Heavy |
| **Bomb** | Yellow "B" | +1 bomb (max 5) | Heavy, Carrier |
| **1-UP** | Green ship icon | +1 life | Rare: specific Carriers in the level script |

**Pickup at its cap** *(v0.2, one rule)*: when the effect cannot apply — power already 5, bombs
already 5, a shield charge already held, lives already 9 — the pickup grants **1 000 points**
instead. A P of the other colour still switches the weapon (level unchanged).

Rule of thumb: everything that falls is good to catch. (This invariant is exactly what the 1.x
"ejected pilots" candidate would challenge — see §12.)

---

## 5. Enemies

### 5.1 Design principle

An enemy is defined by the **question it asks the player** for the next one to three seconds, not
by its size. Size (sprite, HP, hitbox) is the envelope; the role is movement + attack + drop. Five
roles on three size tiers cover every wave the three levels need.

### 5.2 Roles

| Role | Question asked | Size | HP *(initial, L1 shots)* | Movement | Attack | Drop table *(initial)* | Score *(initial)* |
|---|---|---|---|---|---|---|---|
| **Popcorn** | "Where do I place my fire to clear the whole formation?" | Small (16 px) | 1 | Scripted formations of 5–8 along curves (S, sine, loop) | None, or one slow bullet per formation | None individually; **full formation destroyed = guaranteed P** of the level's dominant colour | 100 |
| **Diver** | "Where must I *not* be?" | Small (16 px) | 1 | Enters, then dives straight at the player's position at the moment of the dive | Contact only | None | 150 |
| **Gunner** | "Kill first, or dodge first?" | Medium (32 px) | 8 | Enters from top or side, hovers 3–4 s, leaves | 1–3 aimed bullets per volley, every 1.5 s | P-red or P-blue (role-specific) at **30 %** | 300 |
| **Carrier** | "Do I catch it before it leaves?" | Medium (32 px) | 4 | Crosses the screen laterally, never stops | None | **100 %**: Shield, Bomb or 1-UP as chosen by the level script | 500 |
| **Heavy** | "How do I handle the pressure while I wear it down?" | Large (48–64 px) | 40 | Slow entry from the top, holds position 8–12 s, leaves | Bullet patterns: ring (12 bullets) or fan (5 bullets), every 2 s | Bomb or Shield at **60 %** | 1 000 |

- Enemy bullets: speed 60–90 px/s *(initial)*, **10–40 on screen** at peak. No bullet is ever
  faster than the player's ship.
- Every enemy flashes white for 2 frames when hit (palette flash, no extra sprite) and shares a
  common explosion animation scaled by size tier.
- Enemies that leave the screen alive simply despawn (no penalty, no score).

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
- HP *(initial, L1 shots)*: Cruiser 300, Gantry turret 450, Mothership core 600.
- Score: **10 000 + 100 × seconds remaining** on the timer *(initial)*.
- Boss bullets follow the same density ceiling (≤ 40 on screen) — bosses are read, not memorised.

---

## 7. Levels and pacing

### 7.1 Structure

Each level is a **declarative, typed, deterministic script**: an ordered list of timed events
(`at 8.0 s: spawn Popcorn ×6 on curve S-left`, `at 28.0 s: spawn Carrier carrying Shield`). The
same script with the same inputs and the same RNG seed always produces the same run — the
foundation for the headless simulation tests (ADR-0002) and for replays in v2.

Length *(initial)*: ~120 s of waves + ≤ 90 s of boss per level.

### 7.2 Level 1, first 60 seconds (pacing example and implicit tutorial)

| t (s) | Event | Teaches |
|---|---|---|
| 0 | Popcorn ×6 on an S curve | Aim; full-formation reward (P drops) |
| 8 | Popcorn ×6 mirrored + Diver ×2 | Move; something aims at *you* |
| 18 | Gunner ×2 from the sides | Prioritise targets; dodge aimed bullets |
| 28 | Carrier crosses left → right with a Shield | Catch things before they leave |
| 32 | Popcorn ×8 + Gunner ×1 | Combine |
| 45 | Heavy from the top, ring pattern | Manage pressure; read a pattern |
| 58 | Silence, WARNING, boss track | The boss grammar |

### 7.3 Onboarding

No tutorial screen. Level 1 teaches one mechanic per wave (above). The title screen shows the
controls for the active input device, and the **first time** each pickup type appears in a run a
small label ("SHIELD", "BOMB", "1UP") floats above it for 1 s.

---

## 8. Scoring

- **Base points** per enemy (§5.2) and per boss (§6).
- **Chain multiplier ×1 … ×8** *(initial)*: every kill within **2 s** of the previous one extends the
  chain; the multiplier steps up every 5 chained kills (×2 at 5, ×3 at 10 … ×8 at 35). The chain
  breaks after 2 s without a kill, and resets to ×1 on death. The HUD shows the current multiplier
  and a shrinking chain timer bar.
- **End-of-level tally** *(initial)*: full formations destroyed × 500; **no-bomb** 5 000;
  **no-miss** (no life lost) 10 000; remaining bombs × 1 000.
- **Local top 10** with three-letter initials (arcade name entry), stored in `localStorage`
  (ADR-0006). No online leaderboard in 1.0 (v2).

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

**Pause** *(v0.2)*: the player pauses at any moment (`pause` intent). The game also pauses on its
own when the tab is hidden, when the window loses focus, or when the gamepad in use disconnects —
and **never resumes on its own**. While paused the simulation is frozen (no tick, no timer, no
random draw), the music is ducked to −12 dB over 150 ms and the SFX are silenced. Resuming shows a
1 s **3-2-1 count-in** (simulation still frozen); the frame clock is reset so no time elapsed
during the pause reaches the simulation. Quitting from pause asks for confirmation, default
"No"; a quit run is discarded and never offered the high-score entry.

**Name entry** *(v0.2)*: three characters from A–Z, 0–9, space and `.`, starting at `AAA`; no
timer. On touch, an on-screen letter grid.

### 9.2 HUD (side bands, outside the 240 × 320 play field)

Left: score, chain multiplier + timer bar, lives, bombs. Right: level number and name, weapon
colour and power level (1–5 pips), shield indicator. Boss HP bar at the top of the play field
during a boss fight. On narrow screens the HUD collapses into a thin strip at the top.

### 9.3 Options

Music and SFX volume (separate), key / gamepad remap (§4.2), language (EN / FR), fullscreen,
and **visual effects**: one on/off switch per effect of §9.4, all default **on**. On first launch,
when the browser reports `prefers-reduced-motion`, screen shake, white flashes, hit-stop and slow
motion default to **off** *(v0.2)*. The fullscreen preference is reapplied on the next "Press
Start" gesture (browsers refuse fullscreen without one).

### 9.4 Game feel (all effects individually toggleable in §9.3)

Hit flash (2 frames white), hit-stop on large kills (2–3 frames), screen shake on bombs and boss
hits, muzzle flash, explosion particles with size-scaled bursts, floating score pop-ups, slow
motion on boss death (0.5 s), boss "part breaks off" debris.

### 9.5 Audio

- **SFX** generated with an 8-bit synthesiser (jsfxr-style) *(initial list)*: player shot (spread,
  laser), enemy shot, hit, small / medium / large explosion, boss hit, boss phase change, boss
  death, pickup, power up, shield up, shield break, bomb, player death, 1-UP, menu move / confirm,
  warning, chain step, tally tick.
- **Music** *(initial)*: title, level 1, level 2, level 3, boss, final boss, results, game over —
  free chiptune tracks (CC0 / CC-BY) credited in `CREDITS.md`, replaced by custom tracks in the
  custom-asset phase (final boss first).
- Browser autoplay policy: audio starts on the "Press Start" gesture.

### 9.6 Localisation

EN (default) and FR. Every player-facing string lives in a message catalogue; no string literals in
gameplay code.

### 9.7 Accessibility

Tiny hitbox (fairness), pause at any time, no timing-critical menus, remappable controls,
photosensitivity toggles, no information conveyed by colour alone (pickups also differ by glyph
and shape), reduced-motion respected.

### 9.8 Save data

`localStorage`, versioned schema *(key `retro-shmup.v1`)*: options and the top-10 table (initials,
score, level reached, date). No account, no personal data beyond three letters.

---

## 10. Difficulty

A single **Normal** profile ships in 1.0. The design nevertheless routes every difficulty knob
through one `DifficultyProfile` object (lives, bombs per life, shield charges, death penalty,
enemy HP multiplier, bullet speed multiplier, drop-rate multiplier) so that **Easy** and **Hard**
are one data line each in a later update, after itch.io feedback. YAGNI is respected: one
instance, no selection UI, in 1.0.

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
| Simulation | Fixed timestep 60 Hz with accumulator, render interpolation, seeded RNG — deterministic | ADR-0002 |
| Architecture | Object composition + patterns (Strategy, State, Object Pool, event bus, Command, ports); no ECS, no deep inheritance; UML-first | ADR-0003 |
| Delivery | Cloudflare Pages (PR preview = staging, `main` = prod), itch.io via butler on tagged releases | ADR-0004 |
| Licensing | MIT for the code; assets under their own licences in `public/assets/` with `CREDITS.md` | ADR-0005 |
| Public hosting | `<game>.benoitbremaud.fr` (Cloudflare Pages custom domain, one project per game), attached once the title is final; `pages.dev` URLs before; catalogue at `benoitbremaud.fr/jeux/` | ADR-0008 |
| Player data | `localStorage` only, versioned key, no personal data beyond three initials; no backend in 1.0 | ADR-0006 |
| Performance | 60 fps on a 2019 mid-range phone; ≤ 4 ms of logic per frame; no allocation inside the game loop (pools) | ADR-0002 |
| Tests | Unit tests on the domain (TDD), headless level simulation with scripted inputs and seeded RNG, one browser smoke test; render and audio mocked at their ports | ADR-0003 |
| Quality gate | Local-first: husky hooks run gitleaks, lint, typecheck, tests with coverage and the local SonarQube quality gate before every push; CI keeps only Gitleaks and a light lint/typecheck/test job | ADR-0007 |

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
| Platform | Web (TS + Canvas) | Godot (less shareable, new language); Expo/RN (touch shmup ergonomics, heavier loop) |
| Scrolling | Vertical | Horizontal (does not match "targets fall"); fixed screen (no journey, flat bosses) |
| Art | 16-bit, CC0 then custom | 8-bit (bosses unreadable); vector neon (plan B if art becomes the bottleneck); hand-drawn from day one (blocks the slice) |
| Resolution | 240 × 320 | 270 × 480 (mobile-first, narrow on desktop); 224 × 288 (awkward scaling); adaptive (breaks balancing) |
| Weapons | 2 × 5 levels | 1 × 5 (less choice); Gradius option bar (complex to explain and balance) |
| Lives | 1 hit, 3 lives, shield charge | Health bar (bullets stop mattering); no shield (too hard for itch.io) |
| Death penalty | −1 level + released pickup | Back to level 1 (death spiral); nothing (death is weightless) |
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
| Pause *(v0.2)* | Manual or automatic (tab hidden, focus lost, gamepad lost), never auto-resume, music ducked, 1 s count-in | No auto-pause (hidden tabs freeze the loop: return mid-bullets); auto-resume (unfair restart) |
| Quit from pause *(v0.2)* | Allowed after confirmation, run discarded, no name entry | Record the score on quit (scores without finishing); no quit (only closing the tab) |
| Ending *(v0.2)* | Leads to name entry like Game over | `Ending → Title` (a full clear could not record its score) |
| Effect toggles *(v0.2)* | One switch per §9.4 effect; reduced-motion presets four to off | Two switches only (contradicted §9.4 and the project rules) |
| Edge rules *(v0.2)* | Start with Spread; no release at level 1; bombs hit the boss; capped pickup = 1 000 points; 9 lives max | Leaving them undefined (each would be decided ad hoc in code) |
| Public hosting | One first-level subdomain per game on benoitbremaud.fr, catalogue `/jeux/` on the portfolio (ADR-0008) | Arcade subdomain with paths (routing Worker, shared storage); one repository for all games; the portfolio's own path; nested subdomains (viable, longer, inconsistent with the existing `bulle-de-je`); attaching the domain before the title is final (a rename strands saves) |
