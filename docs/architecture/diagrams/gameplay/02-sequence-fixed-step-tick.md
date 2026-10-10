# Sequence diagram — gameplay — one frame, fixed-step simulation (1.0)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.4 §9.1,
> §9.4, §13
> **Related ADRs**: ADR-0002 (fixed timestep, clamp, interpolation), ADR-0009 (intent frame,
> press latching), ADR-0010 (time scale, wall-clock effects), ADR-0014 (step units)
> **Realizes**: UC1 steps 5–8 and UC2 of [01-use-case](../system/01-use-case.md); components
> of [03-component](../system/03-component.md)

## Context

What happens during **one browser frame** while a run is on screen: how wall time becomes a
whole number of fixed simulation steps, where input is read, where the pause is decided, and how
the frame is drawn with interpolation. It is the loop where determinism is won or lost. Inside
`Run.step` see the fixed order in [04-class-domain](04-class-domain.md) and the two other
sequences. The loop counts wall time in milliseconds (`STEP = 1000 / 60` ms); the domain receives
`dt` in seconds, `1 / 60` (ADR-0014).

## Diagram

```mermaid
---
title: sd — one frame, fixed-step simulation
---
sequenceDiagram
  autonumber
  participant Browser as Browser (rAF)
  participant FL as FrameLoop
  participant Clock as Clock
  participant Scenes as SceneMachine
  participant Input as InputPort
  participant Run as Run
  participant Presenter as RunPresenter
  participant Render as RenderPort

  Browser->>FL: frame callback
  FL->>Clock: now()
  Clock-->>FL: t (ms)
  Note over FL: wallDtMs = min(t − last, 250) — ADR-0002 clamp
  FL->>Scenes: timeScale()
  Note right of Scenes: 1 unless the scene is Playing — then asks RunPresenter
  Scenes-->>FL: s (0 to 1)
  Note over FL: accumulator += wallDtMs × s
  loop while accumulator ≥ STEP
    FL->>Input: read(frame)
    Note right of Input: fills the reused frame — presses latched since the last read
    FL->>Scenes: step(1/60 s, frame)
    alt [scene is Playing and Pause in pressed]
      Note over Scenes: enter Paused — the run does not step
    else [scene is Playing, or Count-in on its last step without Pause]
      Note over Scenes: a last Count-in step hands over to Playing first — 05-state-scenes
      Scenes->>Run: step(1/60 s, frame)
      Scenes->>Run: outcome()
      Run-->>Scenes: PLAYING, LEVEL_CLEARED, RUN_CLEARED or GAME_OVER
      Note over Scenes: a change of outcome triggers a scene transition — 05-state-scenes
    else [any other scene]
      Note over Scenes: the scene consumes the step — Pause is remembered or ignored per 05-state-scenes
    end
    Note over FL: accumulator −= STEP
  end
  Note over FL: alpha = accumulator / STEP
  FL->>Scenes: render(alpha, wallDtMs)
  Note over Scenes: frozen scene — alpha = 1 and wallDtMs = 0 for the whole frame
  Scenes->>Render: setRegion field, starfield at the background clock
  Scenes->>Run: snapshot()
  Run-->>Scenes: previous and current positions, HUD values
  Scenes->>Presenter: draw(snapshot, alpha, wallDtMs)
  Presenter->>Render: setRegion field, sprites at interpolated positions
  Presenter->>Render: setRegion hud, drawHud — score, chain, lives
  Note over Presenter: effects advance by wallDtMs, unscaled — ADR-0010
  Scenes->>Render: overlays of the scene — veil, pause icon, count-in
  Scenes->>Render: present()
```

## Notes

- **Determinism**: the run only sees `step(1/60 s, frame)`; the number of steps per frame varies
  with the display rate and the time scale, never their length (ADR-0002).
- **The pause is decided before the run steps**, in the step that carries `Pause`, and only in
  `Playing`; the other scenes apply their own rule (05-state-scenes). Returning from a hidden tab,
  the clamp bounds the catch-up to 250 ms, consumed by the Paused scene.
- **The scene machine draws the frame**: it draws the starfield from its background
  clock, counted in steps of the scrolling scenes (05-state-scenes), passes the run's snapshot to
  `RunPresenter.draw(snapshot, alpha)`, then the HUD region. In the first playable it draws the
  empty HUD bands itself; the HUD contents move into `RunPresenter` with scoring and are drawn
  after the bands. The presenter takes `wallDtMs` when its first wall-clock effect lands.
- **Frozen scenes draw at `alpha = 1`**: `Paused`, `Count-in` and `Game over` take every step
  without stepping the run, while the loop keeps computing `alpha`; `SceneMachine.render` picks
  `alpha = 1` once for the whole frame, starfield and snapshot, so the frozen picture never
  wobbles, and hands the presenter `wallDtMs = 0`, so effects freeze too.
- **One input read per step**: a press is consumed by exactly one step even when a frame runs
  several, and a tap shorter than a step is not lost (latched by the adapter).
- **Time effects never touch the run**: during hit-stop `s` falls to 0 and the loop takes no
  step; the presenter keeps animating on unscaled `wallDtMs`, and the effect ends on wall time
  (ADR-0010). Outside `Playing` the scale is 1, so a slow motion never spills into the results
  or the pause. The boss timer and the chain window, counted in steps, are untouched.
- **Rendering reads, never writes**: the presenter uses the snapshot and its HUD getters;
  nothing on the render path changes simulation state.
- Outside a run (menus) the same loop runs; `SceneMachine` draws its screen instead of delegating.
