# State machine diagram — meta — a run sent online, as the game sees it (v0.40)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.35, v0.36, v0.37, v0.40 §9.1
> (*Send online*, send errors #173, *WAIT* #177), §9.3 (*Online scores*), §9.8
> **Related ADRs**: ADR-0031, ADR-0032 (one key per run); retro-leaderboard ADR-0001 (verdicts), ADR-0004 (erasure)
> **Realizes**: UC9 and UC10 of [01-use-case](../system/01-use-case.md)

## Context

The client's copy of one run's status, kept under its own key `retro-shmup.online.v1.<id>` (ADR-0032). The server's own state
machine is retro-leaderboard `05-state-run`; the game only mirrors the statuses `GET /v1/runs/{id}`
returns and forgets the run once it is erased. Notation: `trigger [guard] / effect`.

## Diagram

```mermaid
---
title: stm — a kept online run (client view)
---
stateDiagram-v2
  state "Not sent" as NotSent
  state "Sending" as Sending
  state "Pending" as Pending
  state "Verified" as Verified
  state "Rejected" as Rejected
  state "Unverifiable" as Unverifiable
  state "Expired" as Expired
  state "Erasing" as Erasing

  [*] --> NotSent
  NotSent --> Sending : SEND [fewer than 20 kept at SEND, no other send or erasure under way] / POST /v1/runs
  NotSent --> NotSent : SEND [fewer than 20 kept, another send or erasure under way] / WAIT
  NotSent --> NotSent : SEND [20 or more kept] / ERASE AN ONLINE SCORE FIRST
  Sending --> Pending : 202 / keep id and token
  Sending --> NotSent : too long, unsupported, 400, 429 or 5xx / error line
  Sending --> NotSent : 409, offline or timeout / error line, TO ERASE SEE PRIVACY
  Sending --> NotSent : 202 unreadable / error line, TO ERASE SEE PRIVACY
  Sending --> Pending : 202, token not stored / keep watching, TO ERASE SEE PRIVACY, no ERASE
  Pending --> Verified : status verified
  Pending --> Rejected : status rejected
  Pending --> Unverifiable : status unverifiable
  Pending --> Expired : status expired
  Pending --> Pending : status pending, offline or error
  Pending --> [*] : 404 / remove its key
  Verified --> [*] : 404 / remove its key
  Rejected --> [*] : 404 / remove its key
  Unverifiable --> [*] : 404 / remove its key
  Expired --> [*] : 404 / remove its key
  Pending --> Erasing : erase, confirmed [no other send or erasure under way] / DELETE
  Verified --> Erasing : erase, confirmed [no other send or erasure under way] / DELETE
  Rejected --> Erasing : erase, confirmed [no other send or erasure under way] / DELETE
  Unverifiable --> Erasing : erase, confirmed [no other send or erasure under way] / DELETE
  Expired --> Erasing : erase, confirmed [no other send or erasure under way] / DELETE
  Erasing --> [*] : 204 or 404 / remove its key
  Erasing --> Pending : failed [was pending]
  Erasing --> Verified : failed [was verified]
  NotSent --> [*] : not now, back or after(20 s)
  note right of Erasing : v0.37, an erase confirmed while another send or erasure is under way shows WAIT and keeps the status
```

## Notes

- **When the status is asked**: the status screen every 15 s for 2 minutes at most while the run
  is pending; *Online scores* once per opening for every kept run, so a run the server erased by
  its retention (`404`, retro-leaderboard ADR-0004) leaves the list and frees its slot.
- **A failed erasure returns to the status it left** (drawn for two statuses; the three others
  likewise).
- **A stored status outside the five** makes its key invalid: the reader ignores it and never
  removes it (ADR-0006, ADR-0032), so the run leaves the list while its token stays in the
  storage; only a hand-edited storage can cause it.
