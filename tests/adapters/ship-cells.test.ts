import { describe, expect, it } from 'vitest';
import { CELL_SIZE, SPRITE_CELLS } from '../../src/adapters/sprite-atlas';
import { PLAYER_CELL, POPCORN_CELL, SHIP_CELL_SIZE } from '../support/ship-cells';

describe('the smoke test’s ship cells', () => {
  it('match the sprite atlas the game bakes with', () => {
    expect(SHIP_CELL_SIZE).toBe(CELL_SIZE.ships);
    expect(SPRITE_CELLS.player).toMatchObject({ sheet: 'ships', ...PLAYER_CELL });
    expect(SPRITE_CELLS.popcorn).toMatchObject({ sheet: 'ships', ...POPCORN_CELL });
  });
});
