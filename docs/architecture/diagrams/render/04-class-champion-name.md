# Class and sequence diagram — render — the champion's name in the far background (v0.22)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.22 §9.4.1,
> §9.3
> **Related ADRs**: ADR-0010 (presentation time, unseeded presentation randomness), ADR-0021
> (high-score table), ADR-0006 (save parsing by allowlist)
> **Realizes**: §9.4.1; no use case of its own (the player does nothing)

## Context

The name is background decoration, so it lives in the presentation next to the starfield and
reads only what the scene machine hands it: the number 1's name (from `SaveStore.highScores`),
the run's background time and the effect switch. The starfield is split so the name sits between
the far layer and the two nearer ones. The adapter gains one font id, `far`: the menu glyphs in
the far-star colour (the render port has no alpha).

## Diagram

```mermaid
classDiagram
  class Starfield {
    +draw(render, timeSeconds) void
    +drawLayers(render, timeSeconds, from, to) void
  }
  class ChampionName {
    <<presentation>>
    -name : string
    -pass : number
    -x : number
    +constructor(random)
    +setName(name: string) void
    +draw(render, runSeconds) void
  }
  class ChampionTuning {
    <<const>>
    +firstAtS = 40
    +everyS = 120
    +speed = 12
  }
  class EffectSettings {
    +championName : boolean
  }
  class SceneMachine {
    -backgroundSteps
    -runStartSteps
    +render(alpha, wallDtMs) void
  }
  class SaveStore {
    +highScores : readonly HighScoreEntry[]
  }
  class RenderPort {
    <<port>>
    +drawText(text, x, y, font: FontId) void
  }
  class FontId {
    <<type>>
    hud | title | menu | far
  }
  SceneMachine --> Starfield : far layer, then near layers
  SceneMachine --> ChampionName : between them, in play and in the pause
  SceneMachine ..> SaveStore : number 1's name at run start
  SceneMachine ..> EffectSettings : championName switch
  ChampionName ..> ChampionTuning
  ChampionName ..> RenderPort : drawText(..., 'far')
  RenderPort ..> FontId
```

```mermaid
sequenceDiagram
  participant SM as SceneMachine
  participant SS as SaveStore
  participant SF as Starfield
  participant CN as ChampionName
  participant R as RenderPort
  Note over SM: entering Playing from the title
  SM->>SS: highScores[0]?.name
  SM->>CN: setName(name or '')
  Note over SM: each rendered frame
  SM->>SF: drawLayers(r, t, 0, 1)
  alt in play or in the pause, effects.championName, name not empty
    SM->>CN: draw(r, runSeconds)
    CN->>CN: pass = floor((runSeconds - 40) / 120), new pass draws x
    opt the pass is still inside the field
      CN->>R: drawText(name, x, y, 'far')
    end
  end
  SM->>SF: drawLayers(r, t, 1, 3)
```

## Notes

- `runSeconds` is the background time since the run started, so the pause and the frozen scenes
  stop the name with the stars. `y = -10 + 12 × (runSeconds − 40 − 120 × pass)` (−10: the menu cell's height); the name is drawn
  only while `y < 320`.
- `x` is drawn once per new pass from the presentation randomness, keeping the whole name inside
  the 240 px field: no gameplay draw, no allocation per frame.
- `EffectSettings.championName` is optional in the parsed save: missing means on, so save version
  2 is kept; a present non-boolean, `null` included, is invalid like any other switch.
- "In the pause" is every scene that is frozen and does not scroll (Paused, Count-in, the quit
  confirmation, the pause's options screens): the name stays where it was, like the stars.
