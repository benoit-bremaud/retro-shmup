import { COUNTRY_CODES } from '../hall-of-fame/country-codes';
import { NO_COUNTRY } from '../options';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { MessageKey } from '../i18n/messages';
import type { LetterGridView, NameEntryView } from '../presentation/menu-layout';
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

/** The country grid's *OK* cell. */
const COUNTRY_OK = COUNTRY_CELLS.findIndex((cell) => cell.action === 'ok');

/** How the country choice ends: a code or *NONE* chosen, or `back` on an empty code. */
export type CountryChoiceExit = 'chosen' | 'cancelled';

/**
 * The country choice (GDD v0.26 §9.1, meta/02-sequence-country-feedback): the letters-only grid
 * under the two-letter code, opened before the first run and from the options. *OK* shows only
 * for a code of `COUNTRY_CODES`, *NONE* chooses no country, `back` deletes the last letter and,
 * on an empty code, cancels. It opens on *OK* when the preselected code is known, else on `A`.
 */
export class CountryChoice implements NameEntryView {
  readonly heading: MessageKey = 'country';
  readonly slotCount = CODE_LENGTH;
  private readonly letters: string[] = [];
  /** The code is complete and known: *OK* shows. Kept up to date, so a draw joins nothing. */
  private codeValid = false;
  private known = '';
  private chosenNone = false;
  private readonly countryGrid = new LetterGrid<GridAction>(
    COUNTRY_CELLS,
    (cell) => cell.action !== 'ok' || this.codeValid,
  );

  /** Opens at step `now` on `preselected`, kept only if it is a known code. */
  open(now: number, opening: Readonly<IntentFrame>, preselected: string | undefined): void {
    this.letters.length = 0;
    this.chosenNone = false;
    if (preselected !== undefined && COUNTRY_CODES.has(preselected)) {
      this.letters.push(preselected.charAt(0), preselected.charAt(1));
    }
    this.checkCode();
    this.countryGrid.reset(now, opening, this.codeValid ? COUNTRY_OK : 0);
  }

  get grid(): LetterGridView {
    return this.countryGrid;
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
    if ((frame.pressed & Button.Back) !== 0) {
      if (this.letters.length === 0) return 'cancelled';
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
    this.codeValid = COUNTRY_CODES.has(code);
    this.known = this.codeValid ? code : '';
  }
}
