import { describe, expect, it } from 'vitest';
import { createSample } from '../../src/adapters/input/arbitration';
import { isBackKey, isConfirmKey, KeyboardModule } from '../../src/adapters/input/keyboard';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';

function keyboard(): KeyboardModule {
  const module = new KeyboardModule();
  module.setBindings(DEFAULT_BINDINGS);
  return module;
}

function seqs(module: KeyboardModule): { start: number; input: number } {
  const sample = createSample();
  module.sample(sample);
  return { start: sample.startSeq, input: sample.inputSeq };
}

describe('KeyboardModule — sequence numbers for the arbitration (ADR-0018 decision 9)', () => {
  it('records a move key as both an input and a movement start', () => {
    const module = keyboard();
    module.keyDown('ArrowLeft', false, 5);
    expect(seqs(module)).toEqual({ start: 5, input: 5 });
  });

  it.each(['Space', 'Enter'])('records %s as an input only, never a movement start', (code) => {
    const module = keyboard();
    module.keyDown('ArrowLeft', false, 1);
    module.keyDown(code, false, 2);
    expect(seqs(module)).toEqual({ start: 1, input: 2 });
  });

  it('records neither for an unbound key', () => {
    const module = keyboard();
    module.keyDown('KeyQ', false, 3);
    expect(seqs(module)).toEqual({ start: 0, input: 0 });
  });

  it('records neither for an auto-repeat or a key already down', () => {
    const module = keyboard();
    module.keyDown('ArrowLeft', false, 1);
    module.keyDown('ArrowLeft', true, 2);
    module.keyDown('ArrowLeft', false, 3);
    expect(seqs(module)).toEqual({ start: 1, input: 1 });
  });
});

describe('the fixed keys that open or refuse an armed link (ADR-0027 decision 5)', () => {
  it.each(['Enter', 'NumpadEnter'])('treats %s as a confirm key, not a back key', (code) => {
    expect(isConfirmKey(code)).toBe(true);
    expect(isBackKey(code)).toBe(false);
  });

  it('treats Escape as a back key, not a confirm key', () => {
    expect(isBackKey('Escape')).toBe(true);
    expect(isConfirmKey('Escape')).toBe(false);
  });

  it.each(['Space', 'KeyQ', 'ArrowUp', ''])('treats %j as neither', (code) => {
    expect(isConfirmKey(code)).toBe(false);
    expect(isBackKey(code)).toBe(false);
  });
});
