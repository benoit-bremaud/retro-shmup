import { COUNTRY_CODES } from '../hall-of-fame/country-codes';
import type { HighScoreEntry } from '../hall-of-fame/high-scores';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { MessageKey } from '../i18n/messages';
import { LETTER_GRID } from '../presentation/menu-layout';
import type { LetterGridView, NameEntryView } from '../presentation/menu-layout';
import { gridCells, LETTERS, LetterGrid } from './letter-grid';
import type { EntryCell } from './letter-grid';

const DIGITS = '0123456789';
/** The longest name (ADR-0021 decision 2). */
const NAME_LENGTH = 8;
const EMPTY_SLOT = '-';

/** The name grid (GDD v0.16 §9.1): `A`–`Z`, `0`–`9`, *SPACE*, *DEL*, *OK*, then *SKIP*. */
export const NAME_CELLS: readonly EntryCell[] = gridCells(LETTERS + DIGITS, [
  { action: 'space', label: 'keySpace', span: 2 },
  { action: 'delete', label: 'delete', span: 1 },
  { action: 'ok', label: 'ok', span: 1 },
  { action: 'skip', label: 'skip', span: LETTER_GRID.columns },
]);

/** How the name entry ends: *SKIP* or an empty name records nothing, `entered` records. */
export type NameEntryExit = 'skipped' | 'entered';

/**
 * The name entry (GDD v0.16 §9.1, v0.26 without its country step; meta/04-class-menus, SD-score):
 * the name on its grid. `back` deletes the last character and never leaves; *OK* trims the name,
 * and an empty name records nothing, as *SKIP* does. The entry takes the country saved before the
 * first run (v0.26), and the date the scene machine gets from the host.
 */
export class NameEntry implements NameEntryView {
  readonly heading: MessageKey = 'yourName';
  readonly slotCount = NAME_LENGTH;
  /** A name has no flag. */
  readonly knownCode = '';
  /** The score being recorded, read from the finished run when the entry opens. */
  private score = 0;
  /** The saved country code, or `undefined` for none. */
  private country: string | undefined;
  private readonly nameGrid = new LetterGrid(NAME_CELLS);
  /** The name's characters: single-character strings of the grid's cells. */
  private readonly nameChars: string[] = [];

  /** Opens at step `now` for `score`; `country` is the saved choice, kept only if a known code. */
  open(
    now: number,
    opening: Readonly<IntentFrame>,
    score: number,
    country: string | undefined,
  ): void {
    this.score = score;
    this.nameChars.length = 0;
    // A known code only: `NO_COUNTRY` and anything else store no country.
    this.country = country !== undefined && COUNTRY_CODES.has(country) ? country : undefined;
    this.nameGrid.reset(now, opening);
  }

  get grid(): LetterGridView {
    return this.nameGrid;
  }

  get nextSlot(): number {
    return this.nameChars.length < NAME_LENGTH ? this.nameChars.length : -1;
  }

  slot(index: number): string {
    return this.nameChars[index] ?? EMPTY_SLOT;
  }

  /** The name typed, trimmed at both ends. */
  get name(): string {
    return this.nameChars.join('').trim();
  }

  /**
   * The entry to record once `entered`: the name, the saved country if any, the score and the
   * host's `date`. The slice plays level 1 only, so the last level played is 1 (ADR-0022 decision 9).
   */
  entry(date: string): HighScoreEntry {
    const entry = { name: this.name, score: this.score, level: 1, date } as const;
    return this.country === undefined ? entry : { ...entry, country: this.country };
  }

  /** One scene step; returns how the entry ends, or `undefined` while it goes on. */
  step(frame: Readonly<IntentFrame>, now: number): NameEntryExit | undefined {
    if ((frame.pressed & Button.Back) !== 0) this.deleteLast();
    const cell = this.nameGrid.step(frame, now);
    if (cell === undefined) return undefined;
    if (cell.action === 'skip') return 'skipped';
    if (cell.action === 'ok') return this.name === '' ? 'skipped' : 'entered';
    if (cell.action === 'delete') this.deleteLast();
    else if (this.nameChars.length < NAME_LENGTH) {
      this.nameChars.push(cell.action === 'space' ? ' ' : cell.text);
    }
    return undefined;
  }

  private deleteLast(): void {
    this.nameChars.pop();
    this.nameGrid.settle();
  }
}
