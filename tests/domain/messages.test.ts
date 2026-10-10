import { describe, expect, it } from 'vitest';
import { message } from '../../src/domain/i18n/messages';

describe('message catalogue (GDD §9.6)', () => {
  it.each(['en', 'fr'] as const)('gives GAME OVER in %s, in the title glyph set', (language) => {
    const text = message('gameOver', language);
    expect(text).toBe('GAME OVER');
    expect(text).toMatch(/^[A-Z ]+$/);
  });
});
