import { message } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { bind, restore } from '../input/bindings-editor';
import type { BindableDevice, Slot } from '../input/bindings-editor';
import { buttonName, keyName } from '../input/input-names';
import type { LiveOptions } from '../options';
import { Button, REMAPPABLE_INTENTS } from '../ports/input-port';
import type { IntentFrame, RemappableIntent } from '../ports/input-port';
import type { ControlsView, MenuView, SlotColumn } from '../presentation/menu-layout';
import { ControlsGrid, INTENT_ROWS } from './controls-grid';
import type { SceneHost } from './scene-host';

/** The capture in progress: which slot waits for an input. */
interface Pending {
  readonly intent: RemappableIntent;
  readonly slot: Slot;
}

/**
 * The controls screen (GDD v0.15 §4.2, SD-remap, meta/04-class-menus): the grid, the device it
 * edits, the capture and the names of the slots. The scene machine routes to it and only hears
 * `back` and `restore`. While a capture waits, and in the step that receives the answer, the frame
 * carries no menu action: only a tap counts, and it cancels.
 */
export class ControlsScreen implements ControlsView {
  readonly grid = new ControlsGrid();
  /** The device edited: the last of keyboard and gamepad, fixed during a capture. */
  device: BindableDevice = 'keyboard';
  private pending: Pending | undefined;
  private readonly options: LiveOptions;
  private readonly host: SceneHost;
  /** `host.keyLabel`, bound once so a draw builds no function. */
  private readonly printed: (code: string) => string;

  constructor(options: LiveOptions, host: SceneHost) {
    this.options = options;
    this.host = host;
    this.printed = (code) => this.host.keyLabel(code);
  }

  get capturing(): boolean {
    return this.pending !== undefined;
  }

  get menu(): MenuView {
    return this.grid.menu;
  }

  get intentRows(): number {
    return INTENT_ROWS;
  }

  get column(): SlotColumn {
    return this.grid.column;
  }

  get deviceName(): MessageKey {
    return this.device === 'keyboard' ? 'keyboard' : 'gamepad';
  }

  /** Opens the screen on the first cell; the device follows the frame that opened it. */
  open(now: number, opening: Readonly<IntentFrame>): void {
    this.grid.reset(now, opening);
    this.follow(opening);
  }

  /** One step: `back` or `restore` for the scene machine, else `undefined`. */
  step(frame: Readonly<IntentFrame>, now: number): 'back' | 'restore' | undefined {
    if (this.pending !== undefined) {
      this.stepCapture(frame, this.pending);
      return undefined;
    }
    this.follow(frame);
    const action = this.grid.step(frame, now);
    if (action === undefined) return (frame.pressed & Button.Back) !== 0 ? 'back' : undefined;
    if (action.kind !== 'capture') return action.kind;
    this.pending = action;
    this.host.startCapture(this.device);
    return undefined;
  }

  /** *Restore defaults*, confirmed: the edited device's defaults, saved. */
  restoreDefaults(): void {
    this.options.bindings = restore(this.options.bindings, this.device);
    this.host.optionsChanged(this.options);
  }

  /** The text of a slot cell: the input's name, blank when empty, *PRESS* while it waits. */
  cell(row: number, column: SlotColumn): string {
    const intent = REMAPPABLE_INTENTS[row];
    if (intent === undefined) return '';
    const slot: Slot = column === 0 ? 'primary' : 'secondary';
    const language = this.options.language;
    if (this.pending?.intent === intent && this.pending.slot === slot) {
      return message('press', language);
    }
    if (this.device === 'keyboard') {
      const code = this.options.bindings.keyboard[intent][slot];
      return code === null ? '' : keyName(code, language, this.printed);
    }
    const index = this.options.bindings.gamepad[intent][slot];
    return index === null ? '' : buttonName(index);
  }

  private follow(frame: Readonly<IntentFrame>): void {
    if (frame.device === 'keyboard' || frame.device === 'gamepad') this.device = frame.device;
  }

  /** Polls the capture; a tap cancels it; a refused exchange keeps it waiting. */
  private stepCapture(frame: Readonly<IntentFrame>, pending: Pending): void {
    if (frame.tapRegion !== 'none') this.host.cancelCapture();
    const answer = this.host.captureNext();
    if (answer.kind === 'waiting') return;
    this.pending = undefined;
    if (answer.kind === 'cancelled') return;
    const input = answer.kind === 'key' ? answer.code : answer.index;
    const next = bind(this.options.bindings, this.device, pending.intent, pending.slot, input);
    if (next === undefined) {
      this.pending = pending;
      this.host.startCapture(this.device);
      return;
    }
    this.options.bindings = next;
    this.host.optionsChanged(this.options);
  }
}
