// Composition root (ADR-0003): creates the adapters, wires them through the ports and starts the
// frame loop. The only module allowed to touch window, document, requestAnimationFrame and
// Math.random (ADR-0014). To be covered by the browser smoke test (ADR-0003 §7), not yet written.
import { Canvas2DRenderer } from '../adapters/canvas2d-renderer';
import { PerformanceClock } from '../adapters/performance-clock';
import { computeViewport } from '../adapters/viewport';
import { Starfield } from '../domain/presentation/starfield';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../domain/presentation/screen';
import { EnginePreview } from './engine-preview';
import { FrameLoop } from './frame-loop';
import { IdleInput } from './idle-input';

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
  const viewport = computeViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio);
  canvas.width = viewport.deviceWidth;
  canvas.height = viewport.deviceHeight;
  canvas.style.width = `${String(viewport.cssWidth)}px`;
  canvas.style.height = `${String(viewport.cssHeight)}px`;
  renderer.resize(viewport);
}

fitToWindow(visible);
window.addEventListener('resize', () => {
  fitToWindow(visible);
});

// Presentation randomness is unseeded on purpose: it never touches the outcome (ADR-0010).
const starfield = new Starfield(Math.random);
const loop = new FrameLoop(
  new PerformanceClock(),
  new IdleInput(),
  new EnginePreview(renderer, starfield),
  (callback) => {
    requestAnimationFrame(callback);
  },
);
loop.start();
