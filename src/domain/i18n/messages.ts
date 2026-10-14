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
  /**
   * The pause menu and its quit confirmation (GDD v0.13 §9.1), in the menu font: capitals, French
   * without accents (arcade style). The header is drawn in the title font.
   */
  pause: { en: 'PAUSE', fr: 'PAUSE' },
  resume: { en: 'RESUME', fr: 'REPRENDRE' },
  quit: { en: 'QUIT', fr: 'QUITTER' },
  quitQuestion: { en: 'QUIT THE RUN', fr: 'QUITTER LA PARTIE' },
  no: { en: 'NO', fr: 'NON' },
  yes: { en: 'YES', fr: 'OUI' },
  /** The title menu and the options screens (GDD v0.14 §9.3). */
  play: { en: 'PLAY', fr: 'JOUER' },
  options: { en: 'OPTIONS', fr: 'OPTIONS' },
  visualEffects: { en: 'VISUAL EFFECTS', fr: 'EFFETS VISUELS' },
  autofire: { en: 'AUTOFIRE', fr: 'TIR AUTO' },
  language: { en: 'LANGUAGE', fr: 'LANGUE' },
  fullscreen: { en: 'FULLSCREEN', fr: 'PLEIN ECRAN' },
  back: { en: 'BACK', fr: 'RETOUR' },
  allOn: { en: 'ALL ON', fr: 'TOUT ACTIVER' },
  allOff: { en: 'ALL OFF', fr: 'TOUT COUPER' },
  blink: { en: 'BLINK', fr: 'CLIGNOTEMENT' },
  hitFlash: { en: 'HIT FLASH', fr: 'FLASH IMPACT' },
  explosions: { en: 'EXPLOSIONS', fr: 'EXPLOSIONS' },
  shake: { en: 'SHAKE', fr: 'SECOUSSE' },
  bombFlash: { en: 'BOMB FLASH', fr: 'FLASH BOMBE' },
  slowMotion: { en: 'SLOW MOTION', fr: 'RALENTI' },
  on: { en: 'ON', fr: 'OUI' },
  off: { en: 'OFF', fr: 'NON' },
  /** The controls screen (GDD v0.15 §4.2): header, devices, intents, the capture, restore. */
  controls: { en: 'CONTROLS', fr: 'COMMANDES' },
  keyboard: { en: 'KEYBOARD', fr: 'CLAVIER' },
  gamepad: { en: 'GAMEPAD', fr: 'MANETTE' },
  up: { en: 'UP', fr: 'HAUT' },
  down: { en: 'DOWN', fr: 'BAS' },
  left: { en: 'LEFT', fr: 'GAUCHE' },
  right: { en: 'RIGHT', fr: 'DROITE' },
  fire: { en: 'FIRE', fr: 'TIR' },
  bomb: { en: 'BOMB', fr: 'BOMBE' },
  press: { en: 'PRESS', fr: 'APPUIE' },
  restoreDefaults: { en: 'RESTORE DEFAULTS', fr: 'PAR DEFAUT' },
  /** The keys named by language; letters, digits, arrows and the numpad are not (GDD v0.15). */
  keySpace: { en: 'SPACE', fr: 'ESPACE' },
  keyShiftLeft: { en: 'SHIFT L', fr: 'MAJ G' },
  keyShiftRight: { en: 'SHIFT R', fr: 'MAJ D' },
  keyControlLeft: { en: 'CTRL L', fr: 'CTRL G' },
  keyControlRight: { en: 'CTRL R', fr: 'CTRL D' },
  keyAltLeft: { en: 'ALT L', fr: 'ALT G' },
  keyAltRight: { en: 'ALT R', fr: 'ALT D' },
  keyBackspace: { en: 'BACKSPACE', fr: 'EFFACER' },
  /** A language is always named in itself (GDD v0.14 §9.1). */
  english: { en: 'ENGLISH', fr: 'ENGLISH' },
  francais: { en: 'FRANCAIS', fr: 'FRANCAIS' },
} as const;

export type MessageKey = keyof typeof MESSAGES;

/** The catalogue text of `key` in `language`; every player-facing string goes through it. */
export function message(key: MessageKey, language: Language): string {
  return MESSAGES[key][language];
}
