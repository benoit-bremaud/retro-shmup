# Sequence diagram — render — loading the sprite sheets and the fallback (G4-1)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.17 §3.2.1
> (the fallback: the game starts at once on its shapes)
> **Related ADRs**: ADR-0001 amendment 2026-10-15, ADR-0008 (CSP `img-src 'self'`)
> **Realizes**: the types of [04-class-sprites](04-class-sprites.md)

## Context

How the two sheets reach the renderer without delaying the first frame, and what a frame draws
before, after, or without them.

## Diagram

```mermaid
sequenceDiagram
  title sd — loading the sprite sheets
  participant Main as main.ts
  participant Img as HTMLImageElement ×2
  participant Bank as SpriteBank
  participant Frames as frame loop
  participant Pres as RunPresenter
  participant R as Canvas2DRenderer
  Main->>Img: src = assets/sprites/ships.png, tiles.png
  Main->>Frames: start (does not wait for the images)
  par the images decode
    Img-->>Main: decode() resolves (both)
    Main->>Bank: bake(ships, tiles, newCanvas)
    Note over Bank: one off-screen canvas per SpriteId and its white<br/>flash silhouette, 2× and nose-up copies made here
  and frames run
    Frames->>Pres: draw(snapshot, alpha)
    Pres->>R: drawSprite(popcorn, x, y, frame 0 or flash)
    R->>Bank: get(popcorn)
    alt baked
      Bank-->>R: baked sprite (image, flash, size)
      R-->>Pres: true (drawn: the image, or the flash for frame 1)
    else not baked yet, or failed
      Bank-->>R: undefined
      R-->>Pres: false
      Pres->>R: drawRect(the shape of today, white while it flashes)
    end
  end
  opt either decode() rejects
    Img-->>Main: rejected
    Main->>Main: console.warn, nothing baked
    Note over Pres,R: every frame keeps the shapes,<br/>no message to the player
  end
```

## Notes

- The sheets are same-origin files under `public/assets/sprites/`, so the CSP's `img-src 'self'`
  (ADR-0008) allows them and no canvas is tainted.
- `bake` runs only when both images decoded: a run never mixes sprites from one sheet with
  shapes for the other sheet's ids.
- Baking happens between two frames on the main thread; the sheets are small (≈ 2 KB and ≈ 4 KB),
  so it costs well under a frame.
