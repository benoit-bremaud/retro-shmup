import { InputTuning } from '../../domain/input/input-tuning';
import { Button } from '../../domain/ports/input-port';
import type { IntentFrame, TapRegion } from '../../domain/ports/input-port';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../domain/presentation/screen';
import type { ScreenLayout } from '../../domain/presentation/screen';
import type { DeviceSample } from './arbitration';

/** The part of a `PointerEvent` the adapter reads. */
export interface PointerEventLike {
  readonly pointerId: number;
  /** `mouse`, `touch` or `pen`; a pen counts as touch (ADR-0018 decision 8). */
  readonly pointerType: string;
  readonly clientX: number;
  readonly clientY: number;
  /** Bitmask of the mouse buttons down: 1 left, 2 right. */
  readonly buttons: number;
}

/** The canvas client rectangle, in CSS pixels, read once per resize (ADR-0018 decision 6). */
export interface CanvasRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The field origin before the first resize: nothing maps then, so it is never used to aim. */
const NO_FIELD: FieldOrigin = { fieldX: 0, fieldY: 0 };

type FieldOrigin = Pick<ScreenLayout, 'fieldX' | 'fieldY'>;

const LEFT_BUTTON = 1;
const RIGHT_BUTTON = 2;

/**
 * The pointer module of `DeviceInput`: touch, pen and mouse through Pointer Events (ADR-0015
 * decision 8, ADR-0018 decisions 2, 4, 5, 7 and 8). Positions map to whole logical-screen pixels
 * with the cached canvas rectangle and layout; no event reads the DOM. It fills one sample for
 * touch and one for the mouse, and keeps at most one tap per read: a `hud` tap replaces a pending
 * `field` tap, otherwise the first tap wins. Allocates nothing per event.
 */
export class PointerModule {
  private layout: ScreenLayout | undefined;
  private rect: CanvasRect = { left: 0, top: 0, width: 0, height: 0 };
  /** The last mapped point, in whole logical-screen pixels. */
  private x = 0;
  private y = 0;

  private tapRegion: TapRegion = 'none';
  private tapX = 0;
  private tapY = 0;
  /** The pointer that made the pending tap, so a cancel before the read can take it back. */
  private tapPointer = 0;

  /** The first finger or left-button release of the read, in tap coordinates. */
  private releaseRegion: TapRegion = 'none';
  private releaseX = 0;
  private releaseY = 0;
  /** The mouse reached a new field point since the last read. */
  private hovered = false;
  private hoverX = 0;
  private hoverY = 0;

  /** The finger that drives the ship, or `undefined` when none does. */
  private steering: number | undefined;
  private touchX = 0;
  private touchY = 0;
  private touchPressed = 0;
  private touchStart = 0;
  private touchInput = 0;

  /** False until the first mouse event: its first move always counts as a new point. */
  private mouseSeen = false;
  private mouseX = 0;
  private mouseY = 0;
  private mouseButtons = 0;
  /** The left button went down on the field and is still held: the mouse fires (ADR-0020). */
  private mouseFiring = false;
  /**
   * After a lost focus or a rotation the button state is unknown: the next mouse event only
   * records it, so a button still held is never read as a new press.
   */
  private mouseResync = false;
  private mousePressed = 0;
  private mouseStart = 0;
  private mouseInput = 0;

  /**
   * Takes the new screen and canvas rectangle. Returns true when the layout kind changed after the
   * first call: the pending tap and the steering finger are dropped, and the façade pauses
   * (ADR-0018 decision 7). The same kind keeps the finger, mapped with the new rectangle.
   */
  resize(layout: ScreenLayout, rect: CanvasRect): boolean {
    const changed = this.layout !== undefined && this.layout.kind !== layout.kind;
    this.layout = layout;
    this.rect = rect;
    if (changed) this.release();
    return changed;
  }

  /**
   * Lost focus or rotation: no finger steers any more, the pending tap is dropped, and the mouse
   * is unseen until its next event, so a cursor point from the old screen never becomes a target.
   */
  release(): void {
    this.steering = undefined;
    this.tapRegion = 'none';
    this.releaseRegion = 'none';
    this.hovered = false;
    this.mouseSeen = false;
    this.mouseButtons = 0;
    this.mouseFiring = false;
    this.mouseResync = true;
  }

  down(event: PointerEventLike, seq: number): void {
    if (event.pointerType === 'mouse') {
      this.mouse(event, seq, false);
      return;
    }
    if (!this.map(event)) return; // a down outside the canvas is nothing
    this.touchInput = seq;
    if (!this.inField()) {
      // A touch that starts outside the field is a tap only: never a move, never a bomb.
      this.tap('hud', event.pointerId);
      return;
    }
    this.tap('field', event.pointerId);
    if (this.steering === undefined) {
      this.steering = event.pointerId;
      this.touchStart = seq;
      this.aimTouch();
    } else {
      this.touchPressed |= Button.Bomb;
    }
  }

  move(event: PointerEventLike, seq: number): void {
    if (event.pointerType === 'mouse') {
      this.mouse(event, seq, true);
      return;
    }
    if (event.pointerId !== this.steering) return;
    // The steering finger maps wherever it falls; the domain clamp holds the ship.
    this.map(event);
    this.aimTouch();
    this.touchInput = seq;
  }

  up(event: PointerEventLike, seq: number): void {
    if (event.pointerType === 'mouse') {
      this.mouse(event, seq, false);
      return;
    }
    if (this.map(event)) this.released();
    this.lift(event);
  }

  /**
   * A cancelled finger is released with no tap (ADR-0018 decision 8): a tap it made that is still
   * pending is taken back, so a palm or a system gesture never starts, resumes or pauses.
   */
  cancel(event: PointerEventLike): void {
    if (event.pointerType === 'mouse') {
      this.mouseButtons = event.buttons;
      if ((event.buttons & LEFT_BUTTON) === 0) this.mouseFiring = false;
      return;
    }
    if (this.tapRegion !== 'none' && this.tapPointer === event.pointerId) this.tapRegion = 'none';
    this.lift(event);
  }

  /**
   * Fills the touch sample: a target while a finger steers, and `Fire` held while it steers —
   * lifting it stops firing (ADR-0020). The autofire option arrives with the options screen.
   */
  sampleTouch(into: DeviceSample): void {
    into.moving = this.steering !== undefined;
    into.moveKind = 'target';
    into.moveX = this.touchX;
    into.moveY = this.touchY;
    into.held = this.steering === undefined ? 0 : Button.Fire;
    into.autofire = false;
    into.pressed = this.touchPressed;
    into.startSeq = this.touchStart;
    into.inputSeq = this.touchInput;
    this.touchPressed = 0;
  }

  /**
   * Fills the mouse sample: the cursor as target once seen, and `Fire` held while the left button
   * pressed on the field stays down, wherever the cursor goes (ADR-0020).
   */
  sampleMouse(into: DeviceSample): void {
    const field = this.fieldOrigin();
    into.moving = this.mouseSeen;
    into.moveKind = 'target';
    into.moveX = this.mouseX - field.fieldX;
    into.moveY = this.mouseY - field.fieldY;
    into.held = this.mouseFiring ? Button.Fire : 0;
    into.autofire = false;
    into.pressed = this.mousePressed;
    into.startSeq = this.mouseStart;
    into.inputSeq = this.mouseInput;
    this.mousePressed = 0;
  }

  /** Writes the pending tap, release and hover into the frame and consumes them. */
  takePointerEvents(into: IntentFrame): void {
    into.tapRegion = this.tapRegion;
    into.tapX = this.tapX;
    into.tapY = this.tapY;
    this.tapRegion = 'none';
    into.releaseRegion = this.releaseRegion;
    into.releaseX = this.releaseX;
    into.releaseY = this.releaseY;
    this.releaseRegion = 'none';
    into.hovered = this.hovered;
    into.hoverX = this.hoverX;
    into.hoverY = this.hoverY;
    this.hovered = false;
  }

  /**
   * Mouse buttons are read from changes of `buttons` on down, move and up: a second button
   * pressed while one is held arrives as a move (ADR-0018 decision 8). The mouse takes the ship by
   * a move to another field pixel or a left press on the field; a left press elsewhere on the
   * canvas is a tap only; the right button bombs on the field only (decisions 2 and 4).
   */
  private mouse(event: PointerEventLike, seq: number, isMove: boolean): void {
    if (this.layout === undefined) return;
    const inside = this.map(event);
    const newPoint = !this.mouseSeen || this.x !== this.mouseX || this.y !== this.mouseY;
    this.mouseSeen = true;
    this.mouseX = this.x;
    this.mouseY = this.y;
    const pressedNow = this.mouseResync ? 0 : event.buttons & ~this.mouseButtons;
    const releasedNow = this.mouseResync ? 0 : this.mouseButtons & ~event.buttons;
    this.mouseResync = false;
    this.mouseButtons = event.buttons;
    // Releasing the left button anywhere stops the fire; only a press on the field starts it.
    if ((event.buttons & LEFT_BUTTON) === 0) this.mouseFiring = false;
    const field = this.inField();
    if (isMove && newPoint && field) {
      this.mouseStart = seq;
      this.mouseInput = seq;
      const origin = this.fieldOrigin();
      this.hovered = true;
      this.hoverX = this.x - origin.fieldX;
      this.hoverY = this.y - origin.fieldY;
    }
    this.mouseReleased(releasedNow, inside);
    // A press arrives as a down, or as a move while another button is held (ADR-0018 decision 8).
    if ((pressedNow & LEFT_BUTTON) !== 0 && inside) {
      this.tap(field ? 'field' : 'hud', event.pointerId);
      this.mouseInput = seq;
      if (field) {
        this.mouseStart = seq;
        this.mouseFiring = true;
      }
    }
    if ((pressedNow & RIGHT_BUTTON) !== 0 && field) {
      this.mousePressed |= Button.Bomb;
      this.mouseInput = seq;
    }
  }

  private lift(event: PointerEventLike): void {
    if (event.pointerId === this.steering) this.steering = undefined;
  }

  /**
   * Maps the event to whole logical-screen pixels (ADR-0018 decision 5) into `x` and `y`; returns
   * whether it lies on the canvas. Before the first resize nothing maps.
   */
  private map(event: PointerEventLike): boolean {
    const layout = this.layout;
    const rect = this.rect;
    if (layout === undefined || rect.width <= 0 || rect.height <= 0) return false;
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    this.x = Math.floor((cssX * layout.width) / rect.width);
    this.y = Math.floor((cssY * layout.height) / rect.height);
    return cssX >= 0 && cssX < rect.width && cssY >= 0 && cssY < rect.height;
  }

  private inField(): boolean {
    const field = this.fieldOrigin();
    return (
      this.x >= field.fieldX &&
      this.x < field.fieldX + FIELD_WIDTH &&
      this.y >= field.fieldY &&
      this.y < field.fieldY + FIELD_HEIGHT
    );
  }

  private fieldOrigin(): FieldOrigin {
    return this.layout ?? NO_FIELD;
  }

  /** The steering finger's point, raised by the touch offset, in play-field pixels. */
  private aimTouch(): void {
    const field = this.fieldOrigin();
    this.touchX = this.x - field.fieldX;
    this.touchY = this.y - field.fieldY - InputTuning.touchOffsetY;
  }

  /** The left button going up on the canvas is a release, like a lifted finger. */
  private mouseReleased(releasedButtons: number, inside: boolean): void {
    if ((releasedButtons & LEFT_BUTTON) !== 0 && inside) this.released();
  }

  /** A finger lifted or the left button released at the mapped point; the first of a read wins. */
  private released(): void {
    if (this.releaseRegion !== 'none') return;
    const field = this.fieldOrigin();
    const inField = this.inField();
    this.releaseRegion = inField ? 'field' : 'hud';
    this.releaseX = inField ? this.x - field.fieldX : this.x;
    this.releaseY = inField ? this.y - field.fieldY : this.y;
  }

  /** Within one read, a `hud` tap replaces a pending `field` tap; otherwise the first wins. */
  private tap(region: Exclude<TapRegion, 'none'>, pointerId: number): void {
    if (this.tapRegion === 'hud') return;
    if (this.tapRegion === 'field' && region === 'field') return;
    const field = this.fieldOrigin();
    this.tapRegion = region;
    this.tapPointer = pointerId;
    this.tapX = region === 'field' ? this.x - field.fieldX : this.x;
    this.tapY = region === 'field' ? this.y - field.fieldY : this.y;
  }
}
