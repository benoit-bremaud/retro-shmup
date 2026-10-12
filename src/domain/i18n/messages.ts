/** Languages of the game (GDD §9.6): English by default; the options screen chooses later. */
export type Language = 'en' | 'fr';

/**
 * The message catalogue (CLAUDE.md: every player-facing string goes through it). Only what is drawn
 * so far; the screens brick adds the rest. Texts use the glyph set of the font that draws them.
 */
export const MESSAGES = {
  gameOver: { en: 'GAME OVER', fr: 'GAME OVER' },
  /** The header of the Results screen (GDD v0.10 §8, owner decision 2026-10-12). */
  levelClear: { en: 'LEVEL CLEAR', fr: 'FIN DU NIVEAU' },
  /** The tally line labels of the Results screen (GDD v0.10 §8), drawn in the title font. */
  tallyFormations: { en: 'FORMATIONS', fr: 'FORMATIONS' },
  tallyNoBomb: { en: 'NO BOMB', fr: 'SANS BOMBE' },
  tallyNoMiss: { en: 'NO MISS', fr: 'SANS PERTE' },
  tallyBombs: { en: 'BOMBS', fr: 'BOMBES' },
  tallyTotal: { en: 'TOTAL', fr: 'TOTAL' },
  /** The boss announcement (GDD v0.10 §6), drawn in the title font. */
  warning: { en: 'WARNING', fr: 'ATTENTION' },
} as const;

export type MessageKey = keyof typeof MESSAGES;

/** The catalogue text of `key` in `language`; every player-facing string goes through it. */
export function message(key: MessageKey, language: Language): string {
  return MESSAGES[key][language];
}
