import { describe, expect, it } from 'vitest';
import { IdleInput } from '../../src/app/idle-input';
import { createIntentFrame } from '../../src/domain/ports/input-port';

describe('IdleInput', () => {
  it('leaves every frame neutral, whatever it held before', () => {
    const frame = createIntentFrame();
    frame.held = 7;
    frame.pressed = 3;
    frame.moveKind = 'target';
    frame.moveX = 12;
    frame.moveY = -4;
    frame.tapRegion = 'field';
    new IdleInput().read(frame);
    expect(frame).toMatchObject({
      held: 0,
      pressed: 0,
      moveKind: 'none',
      moveX: 0,
      moveY: 0,
      tapRegion: 'none',
    });
  });

  it('cancels any key capture and labels keys by their code', () => {
    const input = new IdleInput();
    expect(input.captureNext()).toEqual({ kind: 'cancelled' });
    expect(input.label('KeyZ')).toBe('KeyZ');
  });
});

describe('createIntentFrame', () => {
  it('starts with no movement, no button and no tap', () => {
    expect(createIntentFrame()).toMatchObject({
      moveKind: 'none',
      held: 0,
      pressed: 0,
      tapRegion: 'none',
    });
  });
});
