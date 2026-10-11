// Composition root (ADR-0003): creates the adapters, wires them through the ports and starts the
// frame loop. The only module allowed to touch window, document, requestAnimationFrame and
// Math.random (ADR-0014). Covered by the browser smoke test (ADR-0003 §7), not by unit tests.
import './style.css';
import { Canvas2DRenderer } from '../adapters/canvas2d-renderer';
import { DeviceInput } from '../adapters/input/device-input';
import type { InputEnvironment } from '../adapters/input/device-input';
import { PerformanceClock } from '../adapters/performance-clock';
import { computeViewport } from '../adapters/viewport';
import { DEFAULT_BINDINGS } from '../domain/input/default-bindings';
import { Starfield } from '../domain/presentation/starfield';
import { SceneMachine } from '../domain/scenes/scene-machine';
import { FrameLoop } from './frame-loop';
import type { FrameTarget } from './frame-loop';

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D is not available in this browser');
  return context;
}

const found = document.querySelector<HTMLCanvasElement>('#screen');
if (found === null) throw new Error('Canvas #screen is missing from index.html');
const visible: HTMLCanvasElement = found;

const offscreen = document.createElement('canvas');
const renderer = new Canvas2DRenderer(context2d(offscreen), offscreen, context2d(visible));

/**
 * Chooses the logical screen for the window (ADR-0015 decision 1, ADR-0018 decision 6), sizes the
 * off-screen canvas to it and the visible canvas to its integer scale, then hands the viewport to
 * the renderer. Resizing a canvas resets its context, so the renderer resets its own state too.
 */
function fitToWindow(canvas: HTMLCanvasElement): void {
  const viewport = computeViewport(
    globalThis.innerWidth,
    globalThis.innerHeight,
    globalThis.devicePixelRatio,
  );
  offscreen.width = viewport.layout.width;
  offscreen.height = viewport.layout.height;
  canvas.width = viewport.deviceWidth;
  canvas.height = viewport.deviceHeight;
  canvas.style.width = `${String(viewport.cssWidth)}px`;
  canvas.style.height = `${String(viewport.cssHeight)}px`;
  renderer.resize(viewport);
}

fitToWindow(visible);
globalThis.addEventListener('resize', () => {
  fitToWindow(visible);
});

// A window moved to a screen of another pixel ratio fires no `resize`: watch the ratio itself,
// re-registering the query for the new ratio after each change (ADR-0018 decision 6).
function watchPixelRatio(): void {
  const query = globalThis.matchMedia(`(resolution: ${String(globalThis.devicePixelRatio)}dppx)`);
  query.addEventListener(
    'change',
    () => {
      fitToWindow(visible);
      watchPixelRatio();
    },
    { once: true },
  );
}
watchPixelRatio();

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
};
const input = new DeviceInput(environment);
input.setBindings(DEFAULT_BINDINGS);

// Presentation randomness is unseeded on purpose: it never touches the outcome (ADR-0010).
const scenes: FrameTarget = new SceneMachine(renderer, new Starfield(Math.random), {
  blink: true,
  hitFlash: true,
  explosions: true,
});
const loop = new FrameLoop(new PerformanceClock(), input, scenes, (callback) => {
  requestAnimationFrame(callback);
});
loop.start();
