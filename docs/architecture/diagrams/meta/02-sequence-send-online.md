# Sequence diagram — meta — send a run online and erase it (v0.35)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.35 §9.1
> (*Send online*), §9.3 (*Online scores*), §9.8
> **Related ADRs**: ADR-0006 (untrusted stored data), ADR-0027 (new-tab gesture rule), ADR-0031
> (recording, codec, sending, kept runs); retro-leaderboard ADR-0001, ADR-0003, ADR-0004
> **Realizes**: UC9 and UC10 of [01-use-case](../system/01-use-case.md); the online states of
> [05-state-scenes](05-state-scenes.md)

## Context

The game's only network exchange. The recording itself happens step by step during the run
([04-class-run-recording](../gameplay/04-class-run-recording.md)); this diagram starts at the run
end. The domain never awaits: it starts a request through `LeaderboardPort` and reads the
handle's result on a later step.

## Diagram

```mermaid
sequenceDiagram
  title sd — Send a run online, then erase it
  actor Player
  participant Scenes as SceneMachine
  participant Online as OnlineRuns
  participant Rec as RunRecorder
  participant Port as LeaderboardPort (fetch adapter)
  participant Store as StoragePort
  participant LB as Online leaderboard

  Note over Scenes: run end, after the hall of fame, OnlineOffer guard holds
  Scenes->>Online: offer(run result)
  Player->>Scenes: SEND
  alt 20 runs kept
    Online-->>Scenes: refused (erase an online score first)
  else a name and room left
    Online->>Rec: records(), frames()
    Rec-->>Online: a view of the records, their count
    Online->>Port: submit(records, frames, seed, score, name, country)
    Note over Port: RecordColumns, then deflate-raw, base64url, size guard (codec 1)
    Port->>LB: POST /v1/runs {game shmup, mode arcade, version, seed, codec 1, frames, inputs, score, name, country}
    alt 202
      LB-->>Port: {id, deletionToken}
      Port-->>Online: handle done: id, token (parsed by allowlist)
      Online->>Store: write retro-shmup.online.v1 (id, token, score, sentAt, pending)
      loop every 15 s, 2 minutes at most, while the screen is open
        Online->>Port: status(id)
        Port->>LB: GET /v1/runs/{id}
        LB-->>Port: {status}, or 404
        Port-->>Online: status, or unknown (the item is dropped)
      end
      Online->>Store: write the last status
    else too long, 409, 400, 429, 5xx, offline or timeout
      Port-->>Online: handle failed: stable code
      Online-->>Scenes: error line, offer stays, nothing kept
    end
  end

  opt later: Options, Online scores, erase confirmed
    Player->>Scenes: erase the highlighted run
    Scenes->>Online: erase(id)
    Online->>Port: erase(id, token)
    Port->>LB: DELETE /v1/runs/{id} (Authorization: Bearer token)
    alt 204 or 404
      Port-->>Online: erased
      Online->>Store: drop the item
    else offline or server error
      Port-->>Online: failed
      Online-->>Scenes: error line, the item stays
    end
  end
```

## Notes

- **Consent**: nothing is built or sent before *SEND*; the cursor opens on *NOT NOW*. *PRIVACY*
  opens `GET /privacy` in a new tab by the feedback form's gesture rule (ADR-0027).
- **No retry of a send**: a failed `POST` keeps nothing; the player may press *SEND* again
  (a second identical run that did reach the server answers `409 duplicate-run`).
- **The token never leaves the browser except in the `DELETE` header**; it is never logged,
  never put in a URL and never dropped to make room (GDD v0.35 §9.8).
- **Polling stops** when the player leaves the screen or after 2 minutes; *Online scores* asks
  again, one run at a time, only for runs still `pending`.
