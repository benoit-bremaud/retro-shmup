import { COUNTRY_CODES } from '../hall-of-fame/country-codes';
import type { HighScoreEntry } from '../hall-of-fame/high-scores';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { MessageKey } from '../i18n/messages';
import { LETTER_GRID } from '../presentation/menu-layout';
import type { GridCell, LetterGridView, NameEntryView } from '../presentation/menu-layout';
import { LetterGrid } from './letter-grid';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
/** The longest name (ADR-0021 decision 2) and a country code's length. */
const NAME_LENGTH = 8;
const CODE_LENGTH = 2;
const EMPTY_SLOT = '-';

/** What a grid cell does: a character, or one of the actions (GDD v0.16 §9.1). */
export type GridAction = 'char' | 'space' | 'delete' | 'ok' | 'skip' | 'none';
type EntryCell = GridCell<GridAction>;

/** The characters, eight to a row, then the actions on the places left. */
function gridCells(
  characters: string,
  actions: readonly { action: GridAction; label: MessageKey; span: number }[],
): EntryCell[] {
  const cells: EntryCell[] = [];
  const columns = LETTER_GRID.columns;
  for (let i = 0; i < characters.length; i += 1) {
    const text = characters.charAt(i);
    cells.push({
      action: 'char',
      text,
      row: Math.floor(i / columns),
      column: i % columns,
      span: 1,
    });
  }
  let place = characters.length;
  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    if (action === undefined) continue;
    // An action never straddles two rows: a wide one too long for the row starts the next.
    if ((place % columns) + action.span > columns) place += columns - (place % columns);
    cells.push({
      action: action.action,
      text: '',
      label: action.label,
      row: Math.floor(place / columns),
      column: place % columns,
      span: action.span,
    });
    place += action.span;
  }
  return cells;
}

/** The name grid (GDD v0.16 §9.1): `A`–`Z`, `0`–`9`, *SPACE*, *DEL*, *OK*, then *SKIP*. */
export const NAME_CELLS: readonly EntryCell[] = gridCells(LETTERS + DIGITS, [
  { action: 'space', label: 'keySpace', span: 2 },
  { action: 'delete', label: 'delete', span: 1 },
  { action: 'ok', label: 'ok', span: 1 },
  { action: 'skip', label: 'skip', span: LETTER_GRID.columns },
]);

/** The country grid: the letters, *DEL*, *NONE* and *OK*. */
export const COUNTRY_CELLS: readonly EntryCell[] = gridCells(LETTERS, [
  { action: 'delete', label: 'delete', span: 1 },
  { action: 'none', label: 'noCountry', span: 2 },
  { action: 'ok', label: 'ok', span: 1 },
]);

/** The country grid's *OK* cell. */
const COUNTRY_OK = COUNTRY_CELLS.findIndex((cell) => cell.action === 'ok');

/** How the name entry ends: *SKIP* or an empty name records nothing, `entered` records. */
export type NameEntryExit = 'skipped' | 'entered';

/**
 * The name entry (GDD v0.16 §9.1, meta/04-class-menus, SD-score): the name on its grid, then the
 * country on the letters-only grid, preselected from the browser language. `back` deletes the last
 * character and never leaves; *OK* on the name trims it, and an empty name records nothing, as
 * *SKIP* does; the country's *OK* shows only for a code of `COUNTRY_CODES`, *NONE* stores none.
 * It builds the entry with the date the scene machine gets from the host.
 */
export class NameEntry implements NameEntryView {
  private currentStage: 'name' | 'country' = 'name';
  /** The score being recorded, read from the finished run when the entry opens. */
  private score = 0;
  private readonly nameGrid = new LetterGrid(NAME_CELLS);
  private readonly countryGrid = new LetterGrid(
    COUNTRY_CELLS,
    (cell) => cell.action !== 'ok' || this.codeValid,
  );
  /** The name's characters, then the code's: single-character strings of the grid's cells. */
  private readonly nameChars: string[] = [];
  private readonly codeChars: string[] = [];
  /** The code is complete and known: *OK* shows. Kept up to date, so a draw joins nothing. */
  private codeValid = false;
  /** No country: *NONE* was chosen. */
  private noCountry = false;

  /** Opens on the name at step `now` for `score`; `country` is the host's guess, kept if known. */
  open(
    now: number,
    opening: Readonly<IntentFrame>,
    score: number,
    country: string | undefined,
  ): void {
    this.currentStage = 'name';
    this.score = score;
    this.nameChars.length = 0;
    this.codeChars.length = 0;
    this.noCountry = false;
    if (country !== undefined && COUNTRY_CODES.has(country)) {
      this.codeChars.push(country.charAt(0), country.charAt(1));
    }
    this.checkCode();
    this.nameGrid.reset(now, opening);
  }

  get stage(): 'name' | 'country' {
    return this.currentStage;
  }

  get heading(): MessageKey {
    return this.stage === 'name' ? 'yourName' : 'country';
  }

  get grid(): LetterGridView {
    return this.activeGrid();
  }

  get slotCount(): number {
    return this.stage === 'name' ? NAME_LENGTH : CODE_LENGTH;
  }

  get nextSlot(): number {
    const filled = this.chars().length;
    return filled < this.slotCount ? filled : -1;
  }

  slot(index: number): string {
    return this.chars()[index] ?? EMPTY_SLOT;
  }

  /** The name typed, trimmed at both ends. */
  get name(): string {
    return this.nameChars.join('').trim();
  }

  /**
   * The entry to record once `entered`: the name, the country unless *NONE*, the score and the
   * host's `date`. The slice plays level 1 only, so the last level played is 1 (ADR-0022 decision 9).
   */
  entry(date: string): HighScoreEntry {
    const entry = { name: this.name, score: this.score, level: 1, date } as const;
    return this.noCountry ? entry : { ...entry, country: this.codeChars.join('') };
  }

  /** One scene step; returns how the entry ends, or `undefined` while it goes on. */
  step(frame: Readonly<IntentFrame>, now: number): NameEntryExit | undefined {
    if ((frame.pressed & Button.Back) !== 0) this.deleteLast();
    const cell = this.activeGrid().step(frame, now);
    if (cell === undefined) return undefined;
    return this.stage === 'name' ? this.pickName(cell, frame, now) : this.pickCountry(cell);
  }

  private pickName(
    cell: EntryCell,
    frame: Readonly<IntentFrame>,
    now: number,
  ): NameEntryExit | undefined {
    if (cell.action === 'skip') return 'skipped';
    if (cell.action === 'ok') {
      if (this.name === '') return 'skipped';
      this.currentStage = 'country';
      // A preselected known code opens on OK: one press keeps it (owner, 2026-10-15).
      this.countryGrid.reset(now, frame, this.codeValid ? COUNTRY_OK : 0);
      return undefined;
    }
    if (cell.action === 'delete') this.deleteLast();
    else if (this.nameChars.length < NAME_LENGTH) {
      this.nameChars.push(cell.action === 'space' ? ' ' : cell.text);
    }
    return undefined;
  }

  private pickCountry(cell: EntryCell): NameEntryExit | undefined {
    if (cell.action === 'none') this.noCountry = true;
    if (cell.action === 'none' || cell.action === 'ok') return 'entered';
    if (cell.action === 'delete') {
      this.deleteLast();
    } else if (this.codeChars.length < CODE_LENGTH) {
      this.codeChars.push(cell.text);
      this.checkCode();
    }
    return undefined;
  }

  private activeGrid(): LetterGrid<GridAction> {
    return this.stage === 'name' ? this.nameGrid : this.countryGrid;
  }

  private chars(): string[] {
    return this.stage === 'name' ? this.nameChars : this.codeChars;
  }

  private deleteLast(): void {
    this.chars().pop();
    this.checkCode();
    this.activeGrid().settle();
  }

  /** Compares character by character: no string is built on input. */
  private checkCode(): void {
    const [first, second] = this.codeChars;
    this.codeValid =
      first !== undefined && second !== undefined && COUNTRY_CODES.has(first + second);
  }
}
