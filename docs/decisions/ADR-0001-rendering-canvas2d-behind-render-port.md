# ADR-0001: Native Canvas 2D rendering behind a minimal RenderPort

**Status:** Accepted — 2026-10-07

## Context

The game renders a 16-bit pixel-art vertical shmup at an **internal resolution of 240 × 320 px**,
drawn to an off-screen canvas and scaled by an **integer factor** (×3 = 720 × 960 on a 1080p
display) with nearest-neighbour sampling; fractional scaling is forbidden (GDD §3.1). Sprites range
from 16 px (small enemies) to 96–160 px (bosses) (GDD §3.2), with per-level palette swaps and a
two-frame white hit flash (GDD §3.2, §5.2).

The draw-call budget per frame is modest. Derived from the GDD ceilings at peak: 2–3 starfield
layers (§3.3), about 20 enemies, 10–40 enemy bullets (§5.2, §6), about 15 player bullets (§4.3),
one boss, a few pickups, about 30 explosion particles (§9.4) and the HUD (§9.2): **roughly 150
draw calls per frame**, an internal estimate the vertical slice must confirm. Bullet density is
deliberately moderate (Raiden-like; "bullet hell" rejected in the GDD Decision record).

Owner requirements that shape the decision:

1. **Zero runtime dependency** — the architecture is the developer's own, as a portfolio piece and
   the subject of the UML study (GDD §1.2; CLAUDE.md forbids adding a game framework or rendering
   library without an explicit request).
2. **The renderer must be swappable** later (for example WebGL or PixiJS) **without touching
   gameplay** (GDD §13; CLAUDE.md: "The domain never imports the browser"), and **tests mock the
   render port, never the domain** (ADR-0003): the port is the headless-simulation seam.
3. **Performance budget** (GDD §13, owned by ADR-0002): 60 fps on a 2019 mid-range phone, at most
   4 ms of logic per frame, no allocation inside the game loop.
4. Game-feel effects (screen shake, flashes, the 1.x CRT scanline overlay) must be individually
   toggleable and respect `prefers-reduced-motion` (GDD §9.3, §9.4, §11.2).

## Decision

**Native Canvas 2D (`CanvasRenderingContext2D`) is the only renderer in 1.0.** Gameplay code depends
on a **minimal `RenderPort` interface**; `Canvas2DRenderer` is its **sole adapter** and the only
module allowed to reference `HTMLCanvasElement`, `CanvasRenderingContext2D` or `document`.

Sketch of the port (signatures only; the authoritative version is the UML class diagram validated
before implementation, per CLAUDE.md "Design before code"):

```ts
export type SpriteId = string;          // key into the loaded sprite sheet(s)
export type FontId = 'hud' | 'title';   // bitmap fonts, no system text

export interface RenderPort {
  clear(): void;
  drawSprite(id: SpriteId, x: number, y: number, frame?: number, flipX?: boolean): void;
  drawRect(x: number, y: number, w: number, h: number, colour: string): void;
  drawText(text: string, x: number, y: number, font: FontId): void;
  setCameraOffset(dx: number, dy: number): void;   // screen shake; (0, 0) when disabled
  present(): void;                                  // flip the off-screen canvas to the screen
}
```

Rules attached to the port:

- **Coordinates are play-field pixels** (0–239, 0–319). Scaling, centring on 16:9 displays and
  letterboxing on portrait phones (GDD §3.1) are adapter concerns invisible to gameplay.
- **`present()`** copies the 240 × 320 off-screen canvas onto the visible canvas with
  `imageSmoothingEnabled = false` and the visible canvas styled `image-rendering: pixelated`. The
  scale factor is `floor(min(viewportW / 240, viewportH / 320))`, clamped to at least 1.
- **Screen shake is a camera offset**, applied by the adapter at `present()` time; the domain sets
  it and the accessibility toggle (GDD §9.3) forces it to zero. The domain never knows whether the
  offset was honoured.
- **HUD side bands** (GDD §9.2) are drawn by the same adapter outside the play field through the
  same primitives; band placement is adapter layout. The boss HP bar is ordinary `drawRect` calls.
- **Palette swaps and hit flash** (GDD §3.2, §5.2) are resolved in the adapter from pre-baked
  sprite-sheet variants; the port gains a palette parameter only when the first caller (the enemy
  palette feature) is implemented.
- **CRT / scanline effects (1.x)** are a **CSS overlay** on top of the visible canvas, not a
  shader and not a port method. They are toggleable and switched off under `prefers-reduced-motion`.
- **No allocation in the draw path**: the adapter pre-sizes its caches (sprite-sheet lookup, glyph
  positions) so a frame's draw calls allocate nothing (ADR-0002).
- **Minimal by construction (YAGNI)**: a method is added only when a second caller needs it or the
  GDD requires it; convenience overloads are refused in review.

## Alternatives considered

- **PixiJS** — rejected because its value (a GPU WebGL/WebGPU renderer with sprite batching and
  shader filters) is unneeded at roughly 150 draw calls per frame on a 240 × 320 surface, and it
  adds a heavy dependency plus a scene-graph API to bend around (GDD: "unneeded GPU").
- **Phaser** — rejected because a full game framework confiscates the game loop, scene management
  and object model, which contradicts the deterministic fixed-timestep loop of ADR-0002 and the
  owner's goal of an architecture that is the developer's own (GDD Decision record: "confiscates
  the architecture"; GDD §11.4 lists it as explicitly out).
- **Canvas 2D without a port (direct context calls in gameplay)** — rejected because it welds the
  domain to the browser, makes headless simulation tests impossible without a DOM shim, and
  forecloses the owner's explicit requirement to swap the renderer later.
- **Hand-written WebGL** — rejected for 1.0: weeks of shader and batching work for a budget Canvas
  2D already meets; it remains the natural second adapter if the budget is exceeded.

## Consequences

Positive:

- Zero runtime dependency; the whole rendering path is readable in one file and fits the UML study.
- The port is the only rendering surface the domain sees, so the headless level-simulation tests
  (ADR-0003) run with a recording fake of `RenderPort` and no DOM.
- The CC0-to-custom asset swap (GDD §3.2) touches only sprite sheets and the adapter's lookup table.

Negative:

- **No GPU shaders**: palette swaps, flashes and the CRT look rely on pre-baked variants and CSS;
  a per-pixel effect that cannot be pre-baked waits for a WebGL adapter.
- Canvas 2D `drawImage` cost grows linearly with draw calls; the 150-call estimate must be measured
  on the 2019 mid-range phone profile of ADR-0002 during the vertical slice. If the budget is
  missed, the first lever is fewer particles, the second a WebGL adapter, never a framework.
- Bitmap-font `drawText` limits the EN/FR catalogue (GDD §9.6) to baked glyphs; the font sheet
  must carry French accented characters.

Follow-ups and review rules:

- Code review rejects any import of `canvas`, `window` or `document` outside `src/adapters/` (layout: ADR-0003; a lint
  boundary rule enforces it once tooling arrives, per "keep it simple first" in PROJECT_LOG.md),
  and rejects a new `RenderPort` method with a single caller unless the GDD requires it.
- Tests implied: an **adapter contract test suite** exercising every port method against
  `Canvas2DRenderer` on a real canvas (the single browser smoke test of ADR-0003 may host it); any
  future WebGL adapter **must pass the same contract suite** unchanged before it is wired in.
- The scale-factor formula is covered by a unit test on the adapter's layout function, no canvas.
- The port signatures above are frozen once the UML class and sequence diagrams for the render
  seam are validated (CLAUDE.md "Design before code"); until then this ADR fixes intent and rules.

## References

- GDD §1.2 (goals), §3.1 (screen and scale), §3.2 (art direction), §5.2 (hit flash), §9.2 (HUD),
  §9.3–§9.4 (accessibility and game feel), §11.2 (CRT overlay in 1.x), §11.4 (Phaser out), §13
  (technical constraints) and the Decision record row "Rendering tech".
- ADR-0002 (fixed timestep, determinism, performance budget), ADR-0003 (architecture and tests),
  ADR-0004 (delivery), ADR-0005 (licensing), ADR-0006 (player data).
- MDN, `CanvasRenderingContext2D.imageSmoothingEnabled`:
  https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled
- MDN, CSS `image-rendering` (`pixelated`):
  https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering
- MDN, `prefers-reduced-motion` media feature:
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- Glenn Fiedler, "Fix Your Timestep!": https://gafferongames.com/post/fix_your_timestep/
- PixiJS (WebGL/WebGPU 2D renderer): https://github.com/pixijs/pixijs — Phaser (HTML5 game
  framework): https://github.com/phaserjs/phaser
- Alistair Cockburn, Hexagonal architecture (ports and adapters):
  https://alistair.cockburn.us/hexagonal-architecture/
