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
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../domain/presentation/screen';
import { Starfield } from '../domain/presentation/starfield';
import { SceneMachine } from '../domain/scenes/scene-machine';
import { FrameLoop } from './frame-loop';
import type { FrameTarget } from './frame-loop';

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D is not available in this browser');
  return context;
}

const visible = document.querySelector<HTMLCanvasElement>('#screen');
if (visible === null) throw new Error('Canvas #screen is missing from index.html');

const offscreen = document.createElement('canvas');
offscreen.width = SCREEN_WIDTH;
offscreen.height = SCREEN_HEIGHT;
const renderer = new Canvas2DRenderer(context2d(offscreen), offscreen, context2d(visible));

function fitToWindow(canvas: HTMLCanvasElement): void {
  const viewport = computeViewport(
    globalThis.innerWidth,
    globalThis.innerHeight,
    globalThis.devicePixelRatio,
  );
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
const scenes: FrameTarget = new SceneMachine(renderer, new Starfield(Math.random), { blink: true });
const loop = new FrameLoop(new PerformanceClock(), input, scenes, (callback) => {
  requestAnimationFrame(callback);
});
loop.start();
