# Class and sequence diagram — audio — synthesiser, sounds and music (v0.23)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.23 §9.3,
> §9.5, §6 (the warning)
> **Related ADRs**: ADR-0009 decision 3 (the audio port controls the mix), ADR-0010 (events, no
> allocation), ADR-0002 (deterministic simulation), ADR-0005 (asset licences)
> **Realizes**: the sound of every use case of play and menus; *Change options* (the *Audio*
> sub-screen). Built in G3-1 (#105) but for the classes tagged *planned* (G3-2: music and the
> saved volumes).

## Context

The domain names sounds and tracks and decides **when** they play; the adapter decides **how**.
The synthesiser is pure arithmetic (no browser API), so it lives in the domain and is unit-tested;
only `WebAudioPlayer` touches `AudioContext`. Sounds follow the run's events: as ADR-0010 and the component
diagram say, `RunPresenter` maps events to sounds; it delegates the mapping to a small
`RunSounds` module (subscribed to `RunEvents`, calling `AudioPort.play`) so the presenter does not
grow. The adapter keeps two tables of its own, so the port stays as ADR-0009 drew it: which `SfxId`
are menu sounds (kept by the pause mix), and per `TrackId` its file, whether it loops (the boss
track: intro once, then loop; the jingles: once) and its loop start. The
music follows the scene. Shots have no event *(owner, G3-1, 470/500 over new
`PlayerFired` / `EnemyFired` events)*: `World` counts the bullets it spawns (`playerShots`,
`enemyShots`, exposed by the snapshot) and `RunSounds.frame` plays one shot sound per drawn frame
whose counter moved, so a five-bullet volley is one sound and the simulation only counts. Menu
sounds come from the scene machine's `stepMenu` (a highlight move, an activation) in the title,
pause and options menus; the controls and name-entry screens, the chain step and the tally tick
join in G3-2 (*planned*).

## Diagram

```mermaid
classDiagram
  class AudioPort {
    <<interface, domain/ports>>
    +play(sfx: SfxId) void
    +music(track: TrackId | null) void
    +setVolumes(music: number, sfx: number) void
    +setPaused(paused: boolean) void
  }
  class SfxParams {
    <<data, domain/audio>>
    +wave: square | saw | sine | noise
    +duty, attack, sustain, decay
    +frequency, slide, vibrato, lowPass, gain
  }
  class UI_SOUNDS {
    <<data, domain/audio>>
    +readonly Sfx[]
  }
  class SFX_TABLE {
    <<data, domain/audio>>
    +Record~SfxId, SfxParams~
  }
  class renderSfx {
    <<pure function, domain/audio>>
    +renderSfx(params, sampleRate) Float32Array
  }
  class RunSounds {
    <<module used by RunPresenter, domain/presentation>>
    +RunSounds(audio: AudioPort, events: RunEvents)
    +frame(snapshot: WorldSnapshot) void
  }
  class SceneMusic {
    <<pure function, domain/scenes, planned>>
    +trackOf(scene, bossStage) TrackId | null
  }
  class volumeGain {
    <<pure function, domain/audio>>
    +volumeGain(step 0..10) number
  }
  class WebAudioPlayer {
    <<adapter, src/adapters>>
    +unlock() void
    +setHidden(hidden: boolean) void
    -buffers: Map~SfxId, AudioBuffer~
    -MAX_VOICES: number = 16
    -lastStart: Map~SfxId, number~
    -TRACKS: Record~TrackId, TrackFile~
  }
  class SceneMachine {
    <<domain/scenes>>
  }
  class RunPresenter {
    <<domain/presentation>>
  }
  class Main {
    <<composition root, src/app>>
  }
  class Options {
    <<domain/options, volumes planned>>
    +musicVolume: 0..10
    +sfxVolume: 0..10
  }
  WebAudioPlayer ..|> AudioPort
  WebAudioPlayer ..> renderSfx : renders SFX_TABLE at unlock
  renderSfx ..> SfxParams
  SFX_TABLE o-- SfxParams
  RunPresenter ..> RunSounds : delegates event to sound
  RunSounds ..> AudioPort : play
  SceneMachine ..> SceneMusic : trackOf
  SceneMachine ..> AudioPort : play menu sounds, setPaused, music planned
  WebAudioPlayer ..> UI_SOUNDS : kept by the pause mix
  Main ..> volumeGain : setVolumes at start-up (from the options in G3-2)
  SceneMachine ..> Options : reads
```

## Unlock, play and visibility

```mermaid
sequenceDiagram
  participant P as Player
  participant M as main.ts (composition root)
  participant DI as DeviceInput (adapter)
  participant WA as WebAudioPlayer (adapter)
  participant R as Run (domain)
  participant RS as RunSounds (domain)
  P->>DI: first click, tap or key
  DI->>WA: unlock() inside the gesture handler
  WA->>WA: resume AudioContext (in the handler), then render SFX_TABLE once just after it
  R-->>RS: EnemyDestroyed (detail = size tier)
  RS->>WA: play(explosion of that tier)
  WA->>WA: skip if the same sound started < 33 ms ago, else start a voice (oldest stopped past 16)
  Note over WA: before unlock, play and music do nothing and queue nothing
  P->>M: tab hidden (visibilitychange)
  M->>WA: setHidden(true) suspends the context; false resumes it
```

## Rules carried

- `renderSfx` is deterministic: its noise uses its own `SeededRandom` seeded with a constant
  per row, never the run's stream (rendering at unlock must not shift the gameplay sequence,
  ADR-0002) and never `Math.random()`; the same row gives the same samples.
- No allocation in the loop: buffers are rendered at unlock; `play` only starts a buffer source
  (a browser object, outside the simulation).
- The music never advances the simulation clock; the warning's fade and the boss track follow the
  scene and the run's `BossWarning` event (GDD §6).
