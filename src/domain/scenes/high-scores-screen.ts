import type { HighScoreTable } from '../hall-of-fame/high-scores';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';

/** One row of the high scores, as drawn: every field a string built when the screen opens. */
export interface HighScoreRow {
  readonly rank: string;
  readonly name: string;
  readonly country: string;
  readonly score: string;
  readonly level: string;
}

const RANKS = 10;
const EMPTY_NAME = '--------';
const EMPTY_SCORE = '-------';

/**
 * The High scores screen (GDD v0.16 §9.1, UC4): ten rows, best first, formatted once when it
 * opens so a draw builds no string; the new entry highlighted after a name entry. `back`,
 * `confirm` or a tap started on the screen leaves it; `Pause` is ignored.
 */
export class HighScoresScreen {
  rows: readonly HighScoreRow[] = [];
  /** The rank (from 0) of the new entry, or −1. */
  highlighted = -1;
  /** A press started on this screen: only its release leaves (the opening tap never does). */
  private pressed = false;

  open(table: HighScoreTable, highlighted: number): void {
    const rows: HighScoreRow[] = [];
    for (let i = 0; i < RANKS; i += 1) {
      const entry = table.entries[i];
      rows.push(
        entry === undefined
          ? { rank: String(i + 1), name: EMPTY_NAME, country: '', score: EMPTY_SCORE, level: '' }
          : {
              rank: String(i + 1),
              name: entry.name,
              country: entry.country ?? '',
              score: String(entry.score),
              level: String(entry.level),
            },
      );
    }
    this.rows = rows;
    this.highlighted = highlighted;
    this.pressed = false;
  }

  /** One step; true when the player leaves the screen. */
  step(frame: Readonly<IntentFrame>): boolean {
    if ((frame.pressed & (Button.Confirm | Button.Back)) !== 0) return true;
    if (frame.tapRegion !== 'none') this.pressed = true;
    return this.pressed && frame.releaseRegion !== 'none';
  }
}
