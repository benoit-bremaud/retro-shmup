import { describe, expect, it } from 'vitest';
import { createSample } from '../../src/adapters/input/arbitration';
import type { DeviceSample } from '../../src/adapters/input/arbitration';
import { PointerModule } from '../../src/adapters/input/pointer';
import type { PointerEventLike } from '../../src/adapters/input/pointer';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { LANDSCAPE, PORTRAIT } from '../../src/domain/presentation/screen';

// A landscape canvas at (0, 0), one CSS pixel per logical pixel: the field spans x 120 to 359.
const ONE_TO_ONE = { left: 0, top: 0, width: 480, height: 320 };

const LEFT = 1;
const RIGHT = 2;

function pointer(): PointerModule {
  const module = new PointerModule();
  module.resize(LANDSCAPE, ONE_TO_ONE);
  return module;
}

function event(
  pointerType: string,
  clientX: number,
  clientY: number,
  buttons = 0,
  pointerId = 1,
): PointerEventLike {
  return { pointerId, pointerType, clientX, clientY, buttons };
}

function touchSample(module: PointerModule): DeviceSample {
  const sample = createSample();
  module.sampleTouch(sample);
  return sample;
}

function mouseSample(module: PointerModule): DeviceSample {
  const sample = createSample();
  module.sampleMouse(sample);
  return sample;
}

function tapOf(module: PointerModule): Pick<IntentFrame, 'tapRegion' | 'tapX' | 'tapY'> {
  const frame = createIntentFrame();
  module.takePointerEvents(frame);
  return { tapRegion: frame.tapRegion, tapX: frame.tapX, tapY: frame.tapY };
}

describe('PointerModule — touch (GDD §4.2, ADR-0015 decision 8, ADR-0018 decision 8)', () => {
  it('steers with the first finger on the field, 32 px above it, in play-field pixels', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 7);
    expect(touchSample(module)).toMatchObject({
      moving: true,
      moveKind: 'target',
      moveX: 80,
      moveY: 218,
      startSeq: 7,
      inputSeq: 7,
    });
    expect(tapOf(module)).toEqual({ tapRegion: 'field', tapX: 80, tapY: 250 });
  });

  it('maps the steering finger wherever it moves, outside the field and the canvas included', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 1);
    module.move(event('touch', 100, 400), 2);
    expect(touchSample(module)).toMatchObject({
      moving: true,
      moveX: -20,
      moveY: 368,
      inputSeq: 2,
    });
  });

  it('stops steering when the finger lifts, so the ship stays', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 1);
    module.up(event('touch', 200, 250), 2);
    expect(touchSample(module).moving).toBe(false);
  });

  it('bombs with a second finger on the field, which never steers', () => {
    const module = pointer();
    module.down(event('touch', 200, 250, 0, 1), 1);
    module.down(event('touch', 300, 100, 0, 2), 2);
    module.move(event('touch', 310, 110, 0, 2), 3);
    const sample = touchSample(module);
    expect(sample.pressed).toBe(Button.Bomb);
    expect(sample).toMatchObject({ moveX: 80, moveY: 218, startSeq: 1 });
    expect(touchSample(module).pressed).toBe(0);
  });

  it('lets a new first finger take over once the steering one lifted, not a finger still down', () => {
    const module = pointer();
    module.down(event('touch', 200, 250, 0, 1), 1);
    module.down(event('touch', 300, 100, 0, 2), 2);
    module.up(event('touch', 200, 250, 0, 1), 3);
    module.move(event('touch', 310, 110, 0, 2), 4);
    expect(touchSample(module).moving).toBe(false);
    module.down(event('touch', 150, 200, 0, 3), 5);
    expect(touchSample(module)).toMatchObject({ moving: true, moveX: 30, moveY: 168, startSeq: 5 });
  });

  it('makes a touch outside the field a HUD tap only: never a move, never a bomb', () => {
    const module = pointer();
    module.down(event('touch', 200, 250, 0, 1), 1);
    tapOf(module);
    module.down(event('touch', 450, 20, 0, 2), 2);
    const sample = touchSample(module);
    expect(sample.pressed).toBe(0);
    expect(sample).toMatchObject({ moveX: 80, moveY: 218, startSeq: 1, inputSeq: 2 });
    expect(tapOf(module)).toEqual({ tapRegion: 'hud', tapX: 450, tapY: 20 });
  });

  it('ignores a finger landing outside the canvas', () => {
    const module = pointer();
    module.down(event('touch', 500, 100), 1);
    expect(touchSample(module)).toMatchObject({ moving: false, startSeq: 0, inputSeq: 0 });
    expect(tapOf(module).tapRegion).toBe('none');
  });

  it('counts a pen as touch', () => {
    const module = pointer();
    module.down(event('pen', 200, 250), 1);
    expect(touchSample(module)).toMatchObject({ moving: true, moveX: 80, moveY: 218 });
  });

  it('releases the steering finger on pointercancel, with no tap', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 1);
    tapOf(module);
    module.cancel(event('touch', 200, 250));
    expect(touchSample(module).moving).toBe(false);
    expect(tapOf(module).tapRegion).toBe('none');
  });

  it('fires while a finger steers and stops when it lifts (ADR-0020)', () => {
    const module = pointer();
    expect(touchSample(module)).toMatchObject({ held: 0, autofire: false });
    module.down(event('touch', 200, 250), 1);
    expect(touchSample(module).held).toBe(Button.Fire);
    module.down(event('touch', 300, 100, 0, 2), 2);
    expect(touchSample(module).held).toBe(Button.Fire); // a second finger bombs, fire goes on
    module.up(event('touch', 200, 250), 3);
    expect(touchSample(module).held).toBe(0);
  });
});

describe('PointerModule — taps (ADR-0018 decisions 2 and 5)', () => {
  it('lets a HUD tap replace a pending field tap within one read', () => {
    const module = pointer();
    module.down(event('touch', 200, 250, 0, 1), 1);
    module.down(event('touch', 20, 20, 0, 2), 2);
    expect(tapOf(module)).toEqual({ tapRegion: 'hud', tapX: 20, tapY: 20 });
  });

  it('keeps the first tap of a region, and a HUD tap over a later field tap', () => {
    const module = pointer();
    module.down(event('touch', 20, 20, 0, 1), 1);
    module.down(event('touch', 30, 30, 0, 2), 2);
    module.down(event('touch', 200, 250, 0, 3), 3);
    expect(tapOf(module)).toEqual({ tapRegion: 'hud', tapX: 20, tapY: 20 });
  });

  it('takes back a pending tap whose finger is cancelled before the read', () => {
    const module = pointer();
    module.down(event('touch', 450, 20, 0, 4), 1);
    module.cancel(event('touch', 450, 20, 0, 4));
    expect(tapOf(module).tapRegion).toBe('none');
  });

  it('keeps a pending tap when another finger is cancelled', () => {
    const module = pointer();
    module.down(event('touch', 450, 20, 0, 4), 1);
    module.down(event('touch', 200, 250, 0, 5), 2);
    module.cancel(event('touch', 200, 250, 0, 5));
    expect(tapOf(module)).toEqual({ tapRegion: 'hud', tapX: 450, tapY: 20 });
  });

  it('consumes the tap on read', () => {
    const module = pointer();
    module.down(event('touch', 20, 20), 1);
    tapOf(module);
    expect(tapOf(module).tapRegion).toBe('none');
  });

  it('floors to whole logical pixels through the canvas scale', () => {
    const module = new PointerModule();
    module.resize(PORTRAIT, { left: 10, top: 20, width: 480, height: 704 });
    module.down(event('touch', 10 + 401.9, 20 + 3.9), 1);
    expect(tapOf(module)).toEqual({ tapRegion: 'hud', tapX: 200, tapY: 1 });
  });

  it('maps nothing before the first resize', () => {
    const module = new PointerModule();
    module.down(event('touch', 200, 250), 1);
    module.down(event('mouse', 200, 250, LEFT), 2);
    expect(tapOf(module).tapRegion).toBe('none');
    expect(touchSample(module).moving).toBe(false);
    expect(mouseSample(module).moving).toBe(false);
  });
});

function releaseOf(
  module: PointerModule,
): Pick<IntentFrame, 'releaseRegion' | 'releaseX' | 'releaseY' | 'hovered' | 'hoverX' | 'hoverY'> {
  const frame = createIntentFrame();
  module.takePointerEvents(frame);
  const { releaseRegion, releaseX, releaseY, hovered, hoverX, hoverY } = frame;
  return { releaseRegion, releaseX, releaseY, hovered, hoverX, hoverY };
}

describe('PointerModule — releases and hover for the menus (GDD v0.13 §9.1)', () => {
  it('reports where a finger is lifted, in the region coordinates of a tap', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 1);
    module.up(event('touch', 210, 240), 2);
    expect(releaseOf(module)).toMatchObject({
      releaseRegion: 'field',
      releaseX: 90,
      releaseY: 240,
    });
  });

  it('reports a lift outside the field as a hud release', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 1);
    module.up(event('touch', 20, 30), 2);
    expect(releaseOf(module)).toMatchObject({ releaseRegion: 'hud', releaseX: 20, releaseY: 30 });
  });

  it('reports no release for a cancelled finger', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 1);
    module.cancel(event('touch', 200, 250));
    expect(releaseOf(module).releaseRegion).toBe('none');
  });

  it('reports the left button going up as a release, and consumes it on read', () => {
    const module = pointer();
    module.down(event('mouse', 200, 250, LEFT), 1);
    module.up(event('mouse', 205, 252, 0), 2);
    expect(releaseOf(module)).toMatchObject({
      releaseRegion: 'field',
      releaseX: 85,
      releaseY: 252,
    });
    expect(releaseOf(module).releaseRegion).toBe('none');
  });

  it('reports no release when the right button goes up', () => {
    const module = pointer();
    module.down(event('mouse', 200, 250, RIGHT), 1);
    module.up(event('mouse', 200, 250, 0), 2);
    expect(releaseOf(module).releaseRegion).toBe('none');
  });

  it('keeps the first release of a read', () => {
    const module = pointer();
    module.down(event('touch', 200, 250, 0, 1), 1);
    module.down(event('touch', 300, 100, 0, 2), 2);
    module.up(event('touch', 200, 250, 0, 1), 3);
    module.up(event('touch', 300, 100, 0, 2), 4);
    expect(releaseOf(module)).toMatchObject({ releaseX: 80, releaseY: 250 });
  });

  it('reports the mouse hovering a new field point, once, in field pixels', () => {
    const module = pointer();
    module.move(event('mouse', 200, 100), 1);
    expect(releaseOf(module)).toMatchObject({ hovered: true, hoverX: 80, hoverY: 100 });
    expect(releaseOf(module).hovered).toBe(false);
    module.move(event('mouse', 200, 100), 2);
    expect(releaseOf(module).hovered).toBe(false);
  });

  it('reports no hover outside the field nor for a finger', () => {
    const module = pointer();
    module.move(event('mouse', 20, 100), 1);
    module.down(event('touch', 200, 250), 2);
    module.move(event('touch', 210, 250), 3);
    expect(releaseOf(module).hovered).toBe(false);
  });

  it('drops a pending release on a lost focus', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 1);
    module.up(event('touch', 200, 250), 2);
    module.release();
    expect(releaseOf(module).releaseRegion).toBe('none');
  });
});

describe('PointerModule — resize (ADR-0018 decisions 6 and 7)', () => {
  it('reports no change on the first call', () => {
    expect(new PointerModule().resize(PORTRAIT, ONE_TO_ONE)).toBe(false);
  });

  it('keeps the steering finger and the tap when the layout kind stays, mapping anew', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 1);
    expect(module.resize(LANDSCAPE, { left: 0, top: 0, width: 960, height: 640 })).toBe(false);
    module.move(event('touch', 400, 500), 2);
    expect(touchSample(module)).toMatchObject({ moving: true, moveX: 80, moveY: 218 });
    expect(tapOf(module).tapRegion).toBe('field');
  });

  it('forgets the mouse point when the layout kind changes, until the mouse moves again', () => {
    const module = pointer();
    module.move(event('mouse', 300, 100), 1);
    module.resize(PORTRAIT, { left: 0, top: 0, width: 240, height: 352 });
    expect(mouseSample(module).moving).toBe(false);
    module.move(event('mouse', 100, 100), 2);
    expect(mouseSample(module)).toMatchObject({ moving: true, moveX: 100, moveY: 68, startSeq: 2 });
  });

  it('drops the tap and the steering finger when the layout kind changes', () => {
    const module = pointer();
    module.down(event('touch', 200, 250), 1);
    expect(module.resize(PORTRAIT, { left: 0, top: 0, width: 240, height: 352 })).toBe(true);
    expect(touchSample(module).moving).toBe(false);
    expect(tapOf(module).tapRegion).toBe('none');
  });
});

describe('PointerModule — mouse (GDD v0.7 §4.2, ADR-0018 decisions 2, 4 and 8)', () => {
  it('starts the movement on its first move over the field, the cursor as target', () => {
    const module = pointer();
    module.move(event('mouse', 200, 250), 4);
    expect(mouseSample(module)).toMatchObject({
      moving: true,
      moveKind: 'target',
      moveX: 80,
      moveY: 250,
      startSeq: 4,
      inputSeq: 4,
    });
  });

  it('starts nothing on a move within the same pixel or over the HUD, but keeps aiming', () => {
    const module = pointer();
    module.move(event('mouse', 200, 250), 1);
    module.move(event('mouse', 200.6, 250.4), 2);
    module.move(event('mouse', 30, 40), 3);
    expect(mouseSample(module)).toMatchObject({ moveX: -90, moveY: 40, startSeq: 1, inputSeq: 1 });
  });

  it('taps and starts the movement on a left press on the field', () => {
    const module = pointer();
    module.move(event('mouse', 30, 40), 1);
    module.down(event('mouse', 30, 40, LEFT), 2);
    module.up(event('mouse', 30, 40), 3);
    module.down(event('mouse', 200, 250, LEFT), 4);
    expect(mouseSample(module)).toMatchObject({ startSeq: 4, inputSeq: 4 });
  });

  it('only taps on a left press elsewhere on the canvas, the pause button included', () => {
    const module = pointer();
    module.down(event('mouse', 450, 20, LEFT), 3);
    expect(tapOf(module)).toEqual({ tapRegion: 'hud', tapX: 450, tapY: 20 });
    expect(mouseSample(module)).toMatchObject({ startSeq: 0, inputSeq: 3 });
  });

  it('ignores a press outside the canvas', () => {
    const module = pointer();
    module.down(event('mouse', 600, 20, LEFT | RIGHT), 1);
    expect(tapOf(module).tapRegion).toBe('none');
    expect(mouseSample(module)).toMatchObject({ pressed: 0, startSeq: 0, inputSeq: 0 });
  });

  it('bombs on a right press on the field only, with no tap', () => {
    const module = pointer();
    module.down(event('mouse', 20, 20, RIGHT), 1);
    expect(mouseSample(module).pressed).toBe(0);
    module.up(event('mouse', 20, 20), 2);
    module.down(event('mouse', 200, 250, RIGHT), 3);
    expect(mouseSample(module).pressed).toBe(Button.Bomb);
    expect(mouseSample(module).pressed).toBe(0);
    expect(tapOf(module).tapRegion).toBe('none');
  });

  it('reads a second button pressed while one is held from a move', () => {
    const module = pointer();
    module.down(event('mouse', 200, 250, LEFT), 1);
    tapOf(module);
    module.move(event('mouse', 200, 250, LEFT | RIGHT), 2);
    expect(mouseSample(module).pressed).toBe(Button.Bomb);
    expect(tapOf(module).tapRegion).toBe('none');
  });

  it('fires while the left button pressed on the field is held, anywhere it goes (ADR-0020)', () => {
    const module = pointer();
    module.move(event('mouse', 200, 250), 1);
    expect(mouseSample(module)).toMatchObject({ held: 0, autofire: false });
    module.down(event('mouse', 200, 250, LEFT), 2);
    expect(mouseSample(module).held).toBe(Button.Fire);
    module.move(event('mouse', 30, 40, LEFT), 3); // dragged over the HUD: still firing
    expect(mouseSample(module).held).toBe(Button.Fire);
    module.up(event('mouse', 30, 40), 4);
    expect(mouseSample(module).held).toBe(0);
  });

  it('never fires from a left press outside the field, even held', () => {
    const module = pointer();
    module.down(event('mouse', 450, 20, LEFT), 1);
    module.move(event('mouse', 200, 250, LEFT), 2);
    expect(mouseSample(module).held).toBe(0);
  });

  it('starts firing on a left press reported as a move while the right button is held', () => {
    const module = pointer();
    module.down(event('mouse', 200, 250, RIGHT), 1);
    module.move(event('mouse', 200, 250, RIGHT | LEFT), 2);
    expect(mouseSample(module).held).toBe(Button.Fire);
  });

  it('reads a button still held after a lost focus as no press, then a new press as one', () => {
    const module = pointer();
    module.down(event('mouse', 200, 250, LEFT), 1);
    module.release();
    module.move(event('mouse', 201, 250, LEFT), 2);
    expect(mouseSample(module).held).toBe(0);
    module.up(event('mouse', 201, 250, 0), 3);
    module.down(event('mouse', 201, 250, LEFT), 4);
    expect(mouseSample(module).held).toBe(Button.Fire);
  });

  it('stops firing when the browser cancels the mouse pointer', () => {
    const module = pointer();
    module.down(event('mouse', 200, 250, LEFT), 1);
    module.cancel(event('mouse', 200, 250, 0));
    expect(mouseSample(module).held).toBe(0);
  });

  it('stops firing on a lost focus or a rotation', () => {
    const module = pointer();
    module.down(event('mouse', 200, 250, LEFT), 1);
    module.release();
    expect(mouseSample(module).held).toBe(0);
  });
});
