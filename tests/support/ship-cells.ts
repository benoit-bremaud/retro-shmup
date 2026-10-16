/**
 * Where the smoke test finds the ships in the sheet. The sprite atlas stays the source of truth:
 * `tests/adapters/ship-cells.test.ts` fails if these values drift from it.
 */
export const SHIP_CELL_SIZE = 32;

/** The player's cell in the ships sheet; the bake turns it nose up. */
export const PLAYER_CELL = { column: 0, row: 0, flipY: true };

/** The Popcorn's cell in the ships sheet. */
export const POPCORN_CELL = { column: 2, row: 2 };
