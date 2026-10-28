/** Colour tokens: every colour drawn by the game comes from here, never from a literal. */
export const Palette = {
  background: '#05060f',
  hudBand: '#0b0d1c',
  hudEdge: '#1c2340',
  starFar: '#3a4466',
  starMid: '#7f8fb8',
  starNear: '#e8ecff',
  // Placeholder ship until the sprites land; the hull colour is the smoke test's oracle, so it
  // must stay distinct from every star colour.
  shipHull: '#4fd1c5',
  shipWing: '#2c7a7b',
  shipCockpit: '#f6e05e',
  // Player shots translucent and enemy bullets with a white core, so danger reads first
  // (GDD v0.9 §3.2).
  playerShot: '#ffd16699',
  // Placeholder enemies until the sprites land: each role its own colour, none the hull's.
  popcorn: '#f56565',
  diver: '#ed8936',
  gunner: '#9f7aea',
  enemyShot: '#ff6bcb',
  enemyShotCore: '#fffffe',
  lifeIcon: '#38b2ac',
  chainTrack: '#2d3561',
  chainBar: '#f6ad55',
  // Game-feel effects (GDD §9.4).
  hitFlash: '#fafafa',
  explosionHot: '#fbd38d',
  explosionCool: '#c05621',
  /** The graze spark (GDD v0.31 §9.4): pale yellow, never white. */
  grazeSpark: '#fefcbf',
  grazeSparkDim: '#b7791f',
  // HUD digits (hud font) and the overlays of the frozen scenes.
  hudText: '#fdf6e3',
  titleText: '#fc8181',
  veil: '#05060fb3',
  // The bar behind the highlighted menu row (GDD v0.13 §9.1); the smoke test's pause oracle, so it
  // must stay distinct from every other colour drawn on the field.
  menuHighlight: '#3b4a8a',
  // The touch pause button over the HUD band (GDD v0.7 §4.2).
  pauseButton: '#a3b1d6',
  // Player kit (GDD v0.8 §4.6, §9.2): P capsules, their marks, the HUD weapon badge and pips.
  pickupRed: '#e53e3e',
  pickupBlue: '#4299e1',
  pickupMark: '#fffaf0',
  spreadBadge: '#fc8a8a',
  laserBadge: '#90cdf4',
  pipOn: '#f6e05f',
  pipOff: '#718096',
  laserShot: '#63b3ed99',
  // The Carrier and the other pickups (GDD v0.8 §4.6, §5.2.1), and their HUD icons.
  carrier: '#48bb78',
  // The Heavy, both its ring and its fan form (GDD v0.10 §5.2.1).
  heavy: '#c6a15b',
  shieldPickup: '#b794f4',
  bombPickup: '#ecc94b',
  oneUpPickup: '#68d391',
  bombIcon: '#faf089',
  shieldIcon: '#d6bcfa',
  // The Cruiser, level 1's boss, and its forward turret (GDD v0.10 §6.1): plain grey boxes until
  // the sprites land.
  boss: '#8a919e',
  bossTurret: '#5b616d',
  // The boss's HP bar (GDD v0.10 §9.2): a cream frame, a grey fill close to the boss's, an amber tick; the seconds and the
  // tick double the colour, so nothing rests on it alone.
  bossBarFrame: '#e8e1cc',
  bossBarTrack: '#10142a',
  bossBarFill: '#9aa3b5',
  bossBarTick: '#f9c74f',
  // The shield ring around the ship and the bomb's tint of the field (GDD v0.8 §4.4, §9.4).
  shieldRing: '#9f7aea9a',
  bombFlash: '#fffbea59',
} as const;

/** One of the palette's colours, as a CSS hex string. */
export type PaletteColour = (typeof Palette)[keyof typeof Palette];
