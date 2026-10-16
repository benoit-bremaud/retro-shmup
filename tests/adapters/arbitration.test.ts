import { describe, expect, it } from 'vitest';
import { arbitrate, createArbitration, createSample } from '../../src/adapters/input/arbitration';
import type { DeviceSamples, DeviceSample } from '../../src/adapters/input/arbitration';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';

function samples(): DeviceSamples {
  return {
    keyboard: createSample(),
    touch: createSample(),
    mouse: createSample(),
    gamepad: createSample(),
  };
}

function moving(sample: DeviceSample, startSeq: number, x = 1, y = 0): void {
  sample.moving = true;
  sample.moveKind = 'direction';
  sample.moveX = x;
  sample.moveY = y;
  sample.startSeq = startSeq;
  sample.inputSeq = Math.max(sample.inputSeq, startSeq);
}

describe('arbitrate — several devices at once (ADR-0015 decision 5, ADR-0018 decision 9)', () => {
  it('gives the movement to the only device moving, and names it', () => {
    const s = samples();
    moving(s.keyboard, 1, -1, 0);
    const frame = createIntentFrame();
    arbitrate(createArbitration(), s, frame);
    expect(frame).toMatchObject({ device: 'keyboard', moveKind: 'direction', moveX: -1, moveY: 0 });
  });

  it('gives the movement to the device that started last', () => {
    const s = samples();
    moving(s.keyboard, 1, -1, 0);
    moving(s.gamepad, 2, 0.5, 0.5);
    const frame = createIntentFrame();
    arbitrate(createArbitration(), s, frame);
    expect(frame).toMatchObject({ device: 'gamepad', moveX: 0.5, moveY: 0.5 });
  });

  it('leaves the ship still when the owner stops: no other device takes over by itself', () => {
    const s = samples();
    moving(s.keyboard, 1);
    moving(s.gamepad, 2);
    s.gamepad.moving = false;
    const frame = createIntentFrame();
    arbitrate(createArbitration(), s, frame);
    expect(frame.moveKind).toBe('none');
  });

  it('combines the buttons of every device', () => {
    const s = samples();
    s.keyboard.held = Button.Fire;
    s.gamepad.held = Button.Bomb;
    s.keyboard.pressed = Button.Pause;
    s.gamepad.pressed = Button.Confirm;
    const frame = createIntentFrame();
    arbitrate(createArbitration(), s, frame);
    expect(frame.held).toBe(Button.Fire | Button.Bomb);
    expect(frame.pressed).toBe(Button.Pause | Button.Confirm);
  });

  it.each(['touch', 'mouse'] as const)(
    'applies the %s autofire only while touch or mouse owns the movement, lifted included',
    (pointer) => {
      const s = samples();
      s[pointer].held = Button.Fire;
      s[pointer].autofire = true;
      moving(s[pointer], 1);
      moving(s.keyboard, 2);
      const frame = createIntentFrame();
      arbitrate(createArbitration(), s, frame);
      expect(frame.held & Button.Fire).toBe(0);
      moving(s[pointer], 3);
      arbitrate(createArbitration(), s, frame);
      expect(frame.held & Button.Fire).toBe(Button.Fire);
      s[pointer].moving = false; // finger lifted, or mouse at rest: still the owner
      arbitrate(createArbitration(), s, frame);
      expect(frame.held & Button.Fire).toBe(Button.Fire);
    },
  );

  it('names the last device with any input, moving or not', () => {
    const s = samples();
    moving(s.keyboard, 1);
    s.gamepad.inputSeq = 2;
    const frame = createIntentFrame();
    arbitrate(createArbitration(), s, frame);
    expect(frame.device).toBe('gamepad');
    expect(frame.moveKind).toBe('direction');
  });

  it('keeps the previous device when no device has any input yet', () => {
    const frame = createIntentFrame();
    frame.device = 'mouse';
    arbitrate(createArbitration(), samples(), frame);
    expect(frame.device).toBe('mouse');
  });

  it('forgets the owner after a lost focus until a device starts again', () => {
    const s = samples();
    moving(s.keyboard, 1);
    const state = createArbitration();
    state.clearedAt = 1; // the façade records the sequence number at the blur
    const frame = createIntentFrame();
    arbitrate(state, s, frame);
    expect(frame.moveKind).toBe('none');
    moving(s.keyboard, 2);
    arbitrate(state, s, frame);
    expect(frame.moveKind).toBe('direction');
  });
});

describe('arbitrate — no device has given input', () => {
  it('keeps the previous device name when every sequence is still 0', () => {
    const frame = createIntentFrame();
    frame.device = 'gamepad';
    arbitrate(createArbitration(), samples(), frame);
    expect(frame.device).toBe('gamepad');
  });
});
