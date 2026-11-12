import { COUNTRY_CODES } from '../hall-of-fame/country-codes';
import { suggestedCountries, SUGGESTION_COUNT } from '../hall-of-fame/country-suggestions';
import { NO_COUNTRY } from '../options';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { MessageKey } from '../i18n/messages';
import type { GridCell, LetterGridView, NameEntryView } from '../presentation/menu-layout';
import { gridCells, LETTERS, LetterGrid } from './letter-grid';
import type { EntryCell, GridAction } from './letter-grid';

const CODE_LENGTH = 2;
const EMPTY_SLOT = '-';

/** The country grid: the letters, *DEL*, *NONE* and *OK*. */
export const COUNTRY_CELLS: readonly EntryCell[] = gridCells(LETTERS, [
  { action: 'delete', label: 'delete', span: 1 },
  { action: 'none', label: 'noCountry', span: 2 },
  { action: 'ok', label: 'ok', span: 1 },
]);

/** What a cell of the suggestions page does: choose its flag's country, none, or open the letters. */
export type FlagAction = 'flag' | 'none' | 'other';

/** A suggestions cell: its code changes each time the choice opens, the cell itself never. */
interface FlagCell extends GridCell<FlagAction> {
  text: string;
}

/** Four cells to a row, each two letter columns wide: 60 × 32 px (ADR-0030). */
const FLAG_SPAN = 2;
const FLAGS_PER_ROW = 4;

/** The suggestions page: six flags, then *NONE* and *OTHER* closing the second row. */
function flagCells(): FlagCell[] {
  const cells: FlagCell[] = [];
  for (let i = 0; i < SUGGESTION_COUNT + 2; i += 1) {
    const cell: FlagCell = {
      action: 'flag',
      text: '',
      row: Math.floor(i / FLAGS_PER_ROW),
      column: (i % FLAGS_PER_ROW) * FLAG_SPAN,
      span: FLAG_SPAN,
    };
    if (i === SUGGESTION_COUNT) cells.push({ ...cell, action: 'none', label: 'noCountry' });
    else if (i > SUGGESTION_COUNT) cells.push({ ...cell, action: 'other', label: 'otherCountry' });
    else cells.push(cell);
  }
  return cells;
}

/** The suggestions page's *OTHER* cell, the last one. */
const OTHER_CELL = SUGGESTION_COUNT + 1;

/** How the country choice ends: a country or *NONE* chosen, or `back` on the suggestions. */
export type CountryChoiceExit = 'chosen' | 'cancelled';

/**
 * The country choice (GDD v0.34 §9.1, ADR-0030, meta/02-sequence-country-feedback), opened before
 * the first run and from the options, in two pages. The suggestions page shows six flags, *NONE*
 * and *OTHER*: a flag chooses its country at once, `back` cancels. *OTHER* opens the letters-only
 * grid under the two-letter code: *OK* shows only for a code of `COUNTRY_CODES`, `back` deletes
 * the last letter and, on an empty code, returns to the suggestions.
 */
export class CountryChoice implements NameEntryView {
  readonly heading: MessageKey = 'country';
  readonly slotCount = CODE_LENGTH;
  private readonly letters: string[] = [];
  /** The complete known code, else `''`: *OK* shows when set. Kept up to date on input, so a draw joins nothing. */
  private known = '';
  private chosenNone = false;
  private onLetters = false;
  private readonly flagCells = flagCells();
  private readonly flagGrid = new LetterGrid<FlagAction>(this.flagCells);
  private readonly countryGrid = new LetterGrid<GridAction>(
    COUNTRY_CELLS,
    (cell) => cell.action !== 'ok' || this.known !== '',
  );

  /**
   * Opens at step `now` on the suggestions made from the browser's `hints` and the `saved`
   * country, the cursor on the saved one, else on the first flag.
   */
  open(
    now: number,
    opening: Readonly<IntentFrame>,
    hints: readonly string[],
    saved: string | undefined,
  ): void {
    const suggested = suggestedCountries(hints, saved);
    let start = 0;
    for (let i = 0; i < SUGGESTION_COUNT; i += 1) {
      const cell = this.flagCells[i];
      const code = suggested[i];
      if (cell === undefined || code === undefined) continue; // Never: six cells, six codes.
      cell.text = code;
      if (code === saved) start = i;
    }
    this.letters.length = 0;
    this.chosenNone = false;
    this.onLetters = false;
    this.checkCode();
    this.flagGrid.reset(now, opening, start);
  }

  /** True on the letters page, false on the suggestions. */
  get byLetters(): boolean {
    return this.onLetters;
  }

  /** The grid of the page shown. */
  get grid(): LetterGridView {
    return this.onLetters ? this.countryGrid : this.flagGrid;
  }

  get nextSlot(): number {
    return this.letters.length < CODE_LENGTH ? this.letters.length : -1;
  }

  slot(index: number): string {
    return this.letters[index] ?? EMPTY_SLOT;
  }

  /** The code once complete and known, else `''`: cached on input, for the flag (GDD v0.27). */
  get knownCode(): string {
    return this.known;
  }

  /** The choice once `chosen`: the code, or `NO_COUNTRY` for *NONE*. */
  get choice(): string {
    return this.chosenNone ? NO_COUNTRY : this.letters.join('');
  }

  /** One scene step; returns how the choice ends, or `undefined` while it goes on. */
  step(frame: Readonly<IntentFrame>, now: number): CountryChoiceExit | undefined {
    return this.onLetters ? this.stepLetters(frame, now) : this.stepFlags(frame, now);
  }

  private stepFlags(frame: Readonly<IntentFrame>, now: number): CountryChoiceExit | undefined {
    if ((frame.pressed & Button.Back) !== 0) return 'cancelled';
    const cell = this.flagGrid.step(frame, now);
    if (cell === undefined) return undefined;
    if (cell.action === 'other') {
      this.onLetters = true;
      this.countryGrid.reset(now, frame);
      return undefined;
    }
    if (cell.action === 'none') this.chosenNone = true;
    else this.letters.push(cell.text.charAt(0), cell.text.charAt(1));
    return 'chosen';
  }

  private stepLetters(frame: Readonly<IntentFrame>, now: number): CountryChoiceExit | undefined {
    if ((frame.pressed & Button.Back) !== 0) {
      if (this.letters.length === 0) {
        this.onLetters = false;
        this.flagGrid.reset(now, frame, OTHER_CELL);
        return undefined;
      }
      this.deleteLast();
    }
    const cell = this.countryGrid.step(frame, now);
    if (cell === undefined) return undefined;
    if (cell.action === 'none') this.chosenNone = true;
    if (cell.action === 'none' || cell.action === 'ok') return 'chosen';
    if (cell.action === 'delete') this.deleteLast();
    else if (this.letters.length < CODE_LENGTH) {
      this.letters.push(cell.text);
      this.checkCode();
    }
    return undefined;
  }

  private deleteLast(): void {
    this.letters.pop();
    this.checkCode();
    this.countryGrid.settle();
  }

  /** Runs on input only, never per frame. */
  private checkCode(): void {
    const code = this.letters.length === CODE_LENGTH ? this.letters.join('') : '';
    this.known = COUNTRY_CODES.has(code) ? code : '';
  }
}
