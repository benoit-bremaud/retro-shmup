import { describe, expect, it } from 'vitest';
import { MESSAGES, message } from '../../src/domain/i18n/messages';

describe('message catalogue (GDD §9.6)', () => {
  it.each(['en', 'fr'] as const)('gives GAME OVER in %s, in the title glyph set', (language) => {
    const text = message('gameOver', language);
    // The arcade title is the same word in both languages, so EN = FR is intended here.
    expect(text).toBe('GAME OVER');
    expect(text).toMatch(/^[A-Z ]+$/);
  });

  it.each([
    ['en', 'LEVEL CLEAR'],
    ['fr', 'FIN DU NIVEAU'],
  ] as const)('gives the level-clear banner in %s, in the title glyph set', (language, text) => {
    expect(message('levelClear', language)).toBe(text);
    expect(text).toMatch(/^[A-Z ]+$/);
  });

  it('has a non-empty text in every language for every key', () => {
    for (const [key, texts] of Object.entries(MESSAGES)) {
      expect(Object.keys(texts).sort(), key).toEqual(['en', 'fr']);
      for (const text of Object.values(texts)) expect(text.length, key).toBeGreaterThan(0);
    }
  });
});
