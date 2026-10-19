# Sequence diagram — meta — the country first and the feedback form (v0.26)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.26 §9.1
> (the country choice, the feedback questionnaire), §9.3, §9.8
> **Related ADRs**: ADR-0006 (save document), ADR-0009 (gestures), ADR-0021 (the country
> allowlist and preselection), ADR-0027 (the form link, the saved country)
> **Realizes**: UC3 (record a high score) and the new goal *Give feedback on the game* of
> [01-use-case](../system/01-use-case.md); the v0.26 states of [05-state-scenes](05-state-scenes.md)

## Context

Two flows of v0.26 that cross the scene machine and the host: the country asked once before the
first run, and the feedback form opened in a new tab. The grid's own moves are a menu like the
others (02-sequence-record-high-score).

## Diagram

```mermaid
sequenceDiagram
  title sd — Country first, then Give feedback
  actor Player
  participant Scenes as SceneMachine
  participant Choice as CountryChoice
  participant Link as FeedbackLink
  participant Host as SceneHost
  participant Browser as LinkPort (browser adapter)

  Player->>Scenes: Play on the title
  alt the save holds no country choice
    Scenes->>Host: countryOfLanguage()
    Host-->>Scenes: FR, or none
    Scenes->>Choice: open(FR)
    loop each step until OK or NONE
      Player->>Scenes: a direction, confirm, back or a tap
      Scenes->>Choice: step(frame)
    end
    alt OK or NONE
      Choice-->>Scenes: FR, or none
      Scenes->>Host: optionsChanged(country choice)
      Note over Host: saves the document (version 2)
    else back on an empty code
      Choice-->>Scenes: cancelled
      Scenes->>Scenes: Title, nothing saved
    end
  end
  Scenes->>Scenes: start the run (gesture prompt first from a gamepad)

  Note over Scenes: later — the run ended, name entry and high scores done
  Scenes->>Scenes: Feedback offer
  Player->>Scenes: Give feedback (tap, click or key)
  Scenes->>Link: url(count, version, score, level, country, device, lang)
  Link-->>Scenes: https://tally.so/r/ID?set=2&version=0.26.0&...
  Scenes->>Host: openLink(url)
  Host->>Browser: open(url) in the same gesture
  Browser-->>Host: opened, or refused
  alt opened
    Host-->>Scenes: opened
    Scenes->>Host: optionsChanged(count + 1)
    Scenes->>Scenes: Title
  else refused
    Host-->>Scenes: refused
    Scenes->>Scenes: OPEN BLOCKED for 2 s, the offer stays
  end
```

## Notes

- `FeedbackLink.url` is a pure domain function: every value comes from an allowlist (the set 1–3,
  the version string fixed at build, whole numbers, a `COUNTRY_CODES` code, `none` or empty, one of four
  device names, `en` or `fr`) and is encoded with `encodeURIComponent`; the player's name is never
  an input.
- The domain never touches `window`: the host forwards to a `LinkPort` whose browser adapter calls
  `window.open(url, '_blank')` inside the input event's handler and sets `opener` to `null` on the
  returned window; `null` returned means refused (ADR-0027 decisions 2 and 5).
- From a gamepad the opening waits in the gesture prompt for the next click, tap or key, like the
  run start (ADR-0009); the opening happens in that event's handler.
- The title's *Feedback* row takes the same path from `url(...)` on, with the last run's score and
  level, or 0 and 1 before any run of the session.
- The options' *Country* row opens the same `CountryChoice`, which returns to the options.
