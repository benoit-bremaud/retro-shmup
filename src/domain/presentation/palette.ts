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
} as const;

export type PaletteColour = (typeof Palette)[keyof typeof Palette];
