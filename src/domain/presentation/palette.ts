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
  playerShot: '#ffd166',
  // Placeholder enemies until the sprites land: each role its own colour, none the hull's.
  popcorn: '#f56565',
  diver: '#ed8936',
  gunner: '#9f7aea',
  enemyShot: '#ff6bcb',
  lifeIcon: '#38b2ac',
  chainTrack: '#2d3561',
  chainBar: '#f6ad55',
  // Game-feel effects (GDD §9.4).
  hitFlash: '#fafafa',
  explosionHot: '#fbd38d',
  explosionCool: '#c05621',
  // HUD digits (hud font) and the overlays of the frozen scenes.
  hudText: '#fdf6e3',
  titleText: '#fc8181',
  veil: '#05060fb3',
  pauseIcon: '#ffffff',
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
  laserShot: '#63b3ed',
} as const;

export type PaletteColour = (typeof Palette)[keyof typeof Palette];
