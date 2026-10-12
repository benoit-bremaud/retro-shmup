/** Languages of the game (GDD §9.6): English by default; the options screen chooses later. */
export type Language = 'en' | 'fr';

/**
 * The message catalogue (CLAUDE.md: every player-facing string goes through it). Only what is drawn
 * so far; the screens brick adds the rest. Texts use the glyph set of the font that draws them.
 */
export const MESSAGES = {
  gameOver: { en: 'GAME OVER', fr: 'GAME OVER' },
} as const;

export type MessageKey = keyof typeof MESSAGES;

/** The catalogue text of `key` in `language`; every player-facing string goes through it. */
export function message(key: MessageKey, language: Language): string {
  return MESSAGES[key][language];
}
