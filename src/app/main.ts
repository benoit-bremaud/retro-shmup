// Composition root (ADR-0003): creates the adapters, wires them through the ports and starts the
// frame loop. The only module allowed to touch window, document, navigator, matchMedia,
// requestAnimationFrame and Math.random (ADR-0014). Covered by the browser smoke test
// (ADR-0003 §7), not by unit tests.
import './style.css';
import { Canvas2DRenderer } from '../adapters/canvas2d-renderer';
import { DeviceInput } from '../adapters/input/device-input';
import type { InputEnvironment } from '../adapters/input/device-input';
import { PerformanceClock } from '../adapters/performance-clock';
import { LocalStorageStore } from '../adapters/local-storage-store';
import { computeViewport } from '../adapters/viewport';
import { Run } from '../domain/game/run';
import { Starfield } from '../domain/presentation/starfield';
import { SaveStore } from '../domain/save/save-store';
import { SceneMachine } from '../domain/scenes/scene-machine';
import type { SceneHost } from '../domain/scenes/scene-machine';
import { FrameLoop } from './frame-loop';
import type { FrameTarget } from './frame-loop';

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D is not available in this browser');
  return context;
}

/** The Keyboard API's `getLayoutMap`, checked before use: it is not in every browser. */
function hasLayoutMap(
  keyboard: unknown,
): keyboard is { getLayoutMap(): Promise<ReadonlyMap<string, string>> } {
  return (
    typeof keyboard === 'object' &&
    keyboard !== null &&
    typeof Reflect.get(keyboard, 'getLayoutMap') === 'function'
  );
}

const found = document.querySelector<HTMLCanvasElement>('#screen');
if (found === null) throw new Error('Canvas #screen is missing from index.html');
const visible: HTMLCanvasElement = found;

const offscreen = document.createElement('canvas');
const renderer = new Canvas2DRenderer(context2d(offscreen), offscreen, context2d(visible));

// The input adapter never touches a browser global: it gets these narrow hooks (ADR-0015).
const environment: InputEnvironment = {
  onKeyDown: (listener) => {
    globalThis.addEventListener('keydown', listener);
  },
  onKeyUp: (listener) => {
    globalThis.addEventListener('keyup', listener);
  },
  onFocusLost: (listener) => {
    globalThis.addEventListener('blur', listener);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) listener();
    });
  },
  onPointerDown: (listener) => {
    globalThis.addEventListener('pointerdown', listener);
  },
  onPointerMove: (listener) => {
    globalThis.addEventListener('pointermove', listener);
  },
  onPointerUp: (listener) => {
    globalThis.addEventListener('pointerup', listener);
  },
  onPointerCancel: (listener) => {
    globalThis.addEventListener('pointercancel', listener);
  },
  gamepads: () => navigator.getGamepads(),
  layoutMap: () => {
    // `navigator.keyboard` exists in Chromium only (GDD v0.15 §4.2): elsewhere, no map.
    const keyboard: unknown = Reflect.get(navigator, 'keyboard');
    return hasLayoutMap(keyboard) ? keyboard.getLayoutMap() : undefined;
  },
  fullscreen: {
    active: () => document.fullscreenElement !== null,
    // A refusal (no permission, an iframe) leaves the page windowed: nothing to report.
    request: () => {
      document.documentElement.requestFullscreen().catch(() => undefined);
    },
    exit: () => {
      document.exitFullscreen().catch(() => undefined);
    },
  },
};
const input = new DeviceInput(environment);

// The right button bombs, so the page never opens its context menu (ADR-0018 decision 10).
globalThis.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

/**
 * Chooses the logical screen for the window (ADR-0015 decision 1, ADR-0018 decision 6), sizes the
 * off-screen canvas to it and the visible canvas to its integer scale, then hands the viewport to
 * the renderer and, with the canvas client rectangle read once here, to the input adapter
 * (ADR-0018 decision 6). Resizing a canvas resets its context, so the renderer resets its own
 * state too.
 */
function fitToWindow(): void {
  const viewport = computeViewport(
    globalThis.innerWidth,
    globalThis.innerHeight,
    globalThis.devicePixelRatio,
  );
  offscreen.width = viewport.layout.width;
  offscreen.height = viewport.layout.height;
  visible.width = viewport.deviceWidth;
  visible.height = viewport.deviceHeight;
  visible.style.width = `${String(viewport.cssWidth)}px`;
  visible.style.height = `${String(viewport.cssHeight)}px`;
  renderer.resize(viewport);
  input.resize(viewport.layout, visible.getBoundingClientRect());
}

fitToWindow();
globalThis.addEventListener('resize', () => {
  fitToWindow();
});

// A window moved to a screen of another pixel ratio fires no `resize`: watch the ratio itself,
// re-registering the query for the new ratio after each change (ADR-0018 decision 6).
function watchPixelRatio(): void {
  const query = globalThis.matchMedia(`(resolution: ${String(globalThis.devicePixelRatio)}dppx)`);
  query.addEventListener(
    'change',
    () => {
      fitToWindow();
      watchPixelRatio();
    },
    { once: true },
  );
}
watchPixelRatio();

// GDD §9.3: reduced motion presets the shake, the flashes and the slow motion off on a first
// launch; afterwards the saved options win (ADR-0006, read once here, outside the loop).
const calm = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
const save = new SaveStore(new LocalStorageStore(() => globalThis.localStorage), calm);
const options = save.load();
input.setBindings(options.bindings); // the saved ones, else the defaults (GDD v0.15 §4.2)
input.setAutofire(options.autofire);
// A saved fullscreen wish applies at the first click, tap or key press (ADR-0009).
if (options.fullscreen) input.setFullscreenWanted(true);

let fullscreenWanted = options.fullscreen;
let bindings = options.bindings;
/** The scene machine's outside world (meta/04-class-menus): save, then forward to the input. */
const host: SceneHost = {
  optionsChanged: (changed) => {
    save.saveOptions(changed); // false: the session goes on unsaved (ADR-0006 decision 5)
    // A rebinding replaces the bindings object: only a new one is pushed to the input.
    if (changed.bindings !== bindings) input.setBindings(changed.bindings);
    bindings = changed.bindings;
    input.setAutofire(changed.autofire);
    // Only a change of this option asks again: flipping another never re-enters fullscreen.
    if (changed.fullscreen !== fullscreenWanted) input.setFullscreenWanted(changed.fullscreen);
    fullscreenWanted = changed.fullscreen;
  },
  releaseMovement: () => {
    input.releaseMovement();
  },
};

// Presentation randomness is unseeded on purpose: it never touches the outcome (ADR-0010).
// Each run draws its seed here, the only module allowed Math.random (ADR-0014, ADR-0019): the
// domain replays a run from (seed, script, inputs).
const scenes: FrameTarget = new SceneMachine(
  renderer,
  new Starfield(Math.random),
  options,
  () => new Run({ seed: Math.floor(Math.random() * 2 ** 32) }),
  host,
);
const loop = new FrameLoop(new PerformanceClock(), input, scenes, (callback) => {
  requestAnimationFrame(callback);
});
loop.start();
