import { REMAPPABLE_INTENTS } from '../ports/input-port';
import type { BindingSlots, Bindings, RemappableIntent } from '../ports/input-port';
import { isCapturableButton, isCapturableKey } from './capturable';
import { DEFAULT_BINDINGS } from './default-bindings';

/** A device with remappable bindings: touch and the mouse have none (GDD §4.2). */
export type BindableDevice = keyof Bindings;
/** One of an intent's two slots. */
export type Slot = keyof BindingSlots<unknown>;

type DeviceBindings<T> = Readonly<Record<RemappableIntent, BindingSlots<T>>>;

/**
 * Puts `input` in one slot (GDD v0.15 §4.2). An input already bound elsewhere on the device moves
 * here and that slot takes the slot's previous input: the two exchange. When the exchange would
 * empty an intent's primary slot, its secondary input moves up; when it has none, the input is
 * refused and `undefined` comes back, so no intent is ever left unbound. Pure: new objects, the
 * other device untouched. A key code belongs to the keyboard, a button index to the gamepad, both
 * from the capturable set (GDD v0.15 §4.2); anything else is refused.
 */
export function bind(
  bindings: Bindings,
  device: BindableDevice,
  intent: RemappableIntent,
  slot: Slot,
  input: string | number,
): Bindings | undefined {
  if (device === 'keyboard') {
    if (typeof input !== 'string' || !isCapturableKey(input)) return undefined;
    const keyboard = rebind(bindings.keyboard, intent, slot, input);
    if (keyboard === undefined) return undefined;
    return keyboard === bindings.keyboard ? bindings : { ...bindings, keyboard };
  }
  if (typeof input !== 'number' || !isCapturableButton(input)) return undefined;
  const gamepad = rebind(bindings.gamepad, intent, slot, input);
  if (gamepad === undefined) return undefined;
  return gamepad === bindings.gamepad ? bindings : { ...bindings, gamepad };
}

/** The defaults of one device, the other kept (GDD v0.15 §4.2, *Restore defaults*). */
export function restore(bindings: Bindings, device: BindableDevice): Bindings {
  return { ...bindings, [device]: DEFAULT_BINDINGS[device] };
}

function rebind<T>(
  slots: DeviceBindings<T>,
  intent: RemappableIntent,
  slot: Slot,
  input: T,
): DeviceBindings<T> | undefined {
  const previous = slots[intent][slot];
  if (previous === input) return slots;
  const next: Record<RemappableIntent, BindingSlots<T>> = { ...slots };
  const holder = findHolder(slots, input);
  next[intent] = { ...next[intent], [slot]: input };
  if (holder !== undefined) {
    next[holder.intent] = { ...next[holder.intent], [holder.slot]: previous };
  }
  for (let i = 0; i < REMAPPABLE_INTENTS.length; i += 1) {
    const each = REMAPPABLE_INTENTS[i];
    if (each === undefined) continue;
    const kept = withPrimary(next[each]);
    if (kept === undefined) return undefined;
    next[each] = kept;
  }
  return next;
}

/** The slot holding `input` on the device, if any. */
function findHolder<T>(
  slots: DeviceBindings<T>,
  input: T,
): { readonly intent: RemappableIntent; readonly slot: Slot } | undefined {
  for (let i = 0; i < REMAPPABLE_INTENTS.length; i += 1) {
    const intent = REMAPPABLE_INTENTS[i];
    if (intent === undefined) continue;
    if (slots[intent].primary === input) return { intent, slot: 'primary' };
    if (slots[intent].secondary === input) return { intent, slot: 'secondary' };
  }
  return undefined;
}

/** The slots with a primary input: the secondary moves up into an empty primary, else none. */
function withPrimary<T>(slots: BindingSlots<T>): BindingSlots<T> | undefined {
  if (slots.primary !== null) return slots;
  if (slots.secondary === null) return undefined;
  return { primary: slots.secondary, secondary: null };
}
