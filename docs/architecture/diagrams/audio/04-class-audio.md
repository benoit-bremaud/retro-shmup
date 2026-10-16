# Class and sequence diagram — audio — synthesiser, sounds and music (v0.23)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.23 §9.3,
> §9.5, §6 (the warning)
> **Related ADRs**: ADR-0009 decision 3 (the audio port controls the mix), ADR-0010 (events, no
> allocation), ADR-0002 (deterministic simulation), ADR-0005 (asset licences)
> **Realizes**: the sound of every use case of play and menus; *Change options* (the *Audio*
> sub-screen). Built in G3-1 (#105: synthesiser, sound effects, pause mix) and G3-2 (music, the
> *Audio* sub-screen, the saved volumes, the remaining sounds).

## Context

The domain names sounds and tracks and decides **when** they play; the adapter decides **how**.
The synthesiser is pure arithmetic (no browser API), so it lives in the domain and is unit-tested;
only `WebAudioPlayer` touches `AudioContext`. Sounds follow the run's events: as ADR-0010 and the component
diagram say, `RunPresenter` maps events to sounds; it delegates the mapping to a small
`RunSounds` module (subscribed to `RunEvents`, calling `AudioPort.play`) so the presenter does not
grow. The adapter keeps two tables of its own, so the port stays as ADR-0009 drew it: which `SfxId`
are menu sounds (kept by the pause mix), and per `TrackId` its files (`TRACK_FILES`: the boss
track's intro, played once, then its loop; the jingles play once, every other track loops). The
music follows the scene: the scene machine looks its track up in `SCENE_MUSIC` after each step,
the run's scenes through `runTrack(boss state)`, and the adapter acts on a change only. Shots have no event *(owner, G3-1, 470/500 over new
`PlayerFired` / `EnemyFired` events)*: `World` counts the bullets it spawns (`playerShots`,
`enemyShots`, exposed by the snapshot) and `RunSounds.frame` plays one shot sound per drawn frame
whose counter moved, so a five-bullet volley is one sound and the simulation only counts. Menu
sounds come from the scene machine's `stepMenu` (a highlight move, an activation) in the title,
pause, options and *Audio* menus, and from a change of the highlighted cell or an action on the
controls and name-entry screens. `RunSounds.frame` plays the chain step when the multiplier rises;
the Results scene plays the tally tick on each new line (`tallyLineAppears`).

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
  class Track {
    <<data, domain/audio/music>>
    title | level-1 | boss | results | game-over
    +JINGLES: Track[]
  }
  class runTrack {
    <<pure function, domain/audio/music>>
    +runTrack(boss: BossState) Track | null
  }
  class SCENE_MUSIC {
    <<data, domain/scenes>>
    +Record~Scene, Track | run~
  }
  class volumeGain {
    <<pure function, domain/audio>>
    +volumeGain(step 0..10) number
    +nudgeVolume(step, direction) number
    +cycleVolume(step) number
    +isVolumeStep(value: unknown) boolean
  }
  class WebAudioPlayer {
    <<adapter, src/adapters>>
    +WebAudioPlayer(createContext, loadFile: LoadAudioFile)
    +unlock() void
    +setHidden(hidden: boolean) void
    -buffers: Map~SfxId, AudioBuffer~
    -MAX_VOICES: number = 16
    -lastStart: Map~SfxId, number~
    -TRACK_FILES: Record~Track, string[]~
    -trackBuffers: Map~file, AudioBuffer~
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
    <<domain/options>>
    +musicVolume: 0..10
    +sfxVolume: 0..10
  }
  class LiveOptions {
    <<domain/options>>
    +apply(row) boolean
    +nudge(row: VolumeRow, direction) void
  }
  WebAudioPlayer ..|> AudioPort
  WebAudioPlayer ..> renderSfx : renders SFX_TABLE at unlock
  renderSfx ..> SfxParams
  SFX_TABLE o-- SfxParams
  RunPresenter ..> RunSounds : delegates event to sound
  RunSounds ..> AudioPort : play
  SceneMachine ..> SCENE_MUSIC : track after each step
  SCENE_MUSIC ..> Track
  SceneMachine ..> runTrack : the run's scenes
  SceneMachine ..> AudioPort : play menu sounds, setPaused, music, setVolumes
  SceneMachine ..> volumeGain : at start-up and on each volume change
  WebAudioPlayer ..> UI_SOUNDS : kept by the pause mix
  WebAudioPlayer ..> Track : TRACK_FILES, JINGLES
  Main ..> WebAudioPlayer : fetch of public/assets/audio as LoadAudioFile
  LiveOptions ..|> Options
  SceneMachine ..> LiveOptions : changes on the Audio sub-screen
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
  Note over WA: before unlock, play does nothing; music only remembers the scene's track
  P->>M: tab hidden (visibilitychange)
  M->>WA: setHidden(true) suspends the context; false resumes it
```

## Music through a run

```mermaid
sequenceDiagram
  participant SM as SceneMachine (domain)
  participant WA as WebAudioPlayer (adapter)
  Note over WA: at unlock, every track file is fetched and decoded once, one at a time, the track asked for first
  SM->>WA: music(title) after each step on the title (a repeat changes nothing)
  WA->>WA: start the title loop once its file is decoded
  SM->>WA: music(level-1) from Play
  SM->>WA: setPaused(true) in the pause: duck to −12 dB over 150 ms
  SM->>WA: setPaused(false) at the count-in: back over 1 s
  SM->>WA: music(null) at the WARNING: fade out over 0.5 s
  SM->>WA: music(boss) at its entrance: intro once, then the loop from the intro's end
  SM->>WA: music(results) or music(game-over): the jingle once, the track before stopped
```

## Rules carried

- `renderSfx` is deterministic: its noise uses its own `SeededRandom` seeded with a constant
  per row, never the run's stream (rendering at unlock must not shift the gameplay sequence,
  ADR-0002) and never `Math.random()`; the same row gives the same samples.
- No allocation in the loop: buffers are rendered at unlock; `play` only starts a buffer source
  (a browser object, outside the simulation).
- The music never advances the simulation clock; the warning's fade and the boss track follow the
  scene and the boss's state (GDD §6), read from the snapshot after each step.
- A track file that fails to fetch or decode leaves that track silent; the game plays on.
