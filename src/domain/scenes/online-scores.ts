import type { MessageKey } from '../i18n/messages';
import type { KeptRun } from '../online/kept-runs';
import type { FailureCode } from '../ports/leaderboard-port';
import { failureLine, statusLine } from '../online/online-lines';
import type { IntentFrame } from '../ports/input-port';
import { MENU_HEADER_GAP } from '../presentation/menu-layout';
import type { OnlineScoresView } from '../presentation/menu-layout';
import { Menu } from './menu';

/** A row of *Online scores*: a kept run (drawn from its text), a page switch, or *BACK*. */
export type OnlineScoresRow = 'score' | 'next' | 'prev' | 'back';

/** What `followErase` reads of the kept runs: whether one is still kept (no allocation). */
export interface KeptRunsReader {
  keeps(id: string): boolean;
}

/** Runs per page (GDD v0.39 §9.3): 10 runs, a page switch and *BACK* make 12 rows at most… */
const RUNS_PER_PAGE = 10;
/** …and 9 on a page holding both *PREV* and *NEXT* (GDD v0.40 §9.3, more than 20 runs kept). */
const RUNS_BETWEEN = 9;
/** The heading and the status line above the rows (GDD v0.39 §9.3): gap 32. */
const HEADER_GAP = 2 * MENU_HEADER_GAP.menu;
const SCORE_DIGITS = 7;

/** How many of `total` runs the page starting at run `start` shows. */
function pageCount(total: number, page: number, start: number): number {
  const left = total - start;
  if (page === 0 || left <= RUNS_PER_PAGE) return Math.min(left, RUNS_PER_PAGE);
  return RUNS_BETWEEN;
}

/** The first run shown on `page`. */
function pageStart(total: number, page: number): number {
  let start = 0;
  for (let p = 0; p < page; p += 1) start += pageCount(total, p, start);
  return start;
}

/** The page that shows run `index`. */
function pageOf(total: number, index: number): number {
  let page = 0;
  let start = 0;
  for (;;) {
    const count = pageCount(total, page, start);
    if (index < start + count || count === 0) return page;
    start += count;
    page += 1;
  }
}

/** A run row's text: the score right-aligned, then the UTC date of the send (`YYYY-MM-DD`). */
function runText(run: KeptRun): string {
  return `${String(run.score).padStart(SCORE_DIGITS)}  ${run.sentAt.slice(0, 10)}`;
}

/**
 * *Online scores* (GDD v0.39, v0.40 §9.3, UC10): the kept runs in pages of 10 (9 on a page with
 * both *PREV* and *NEXT*), *NEXT* when more runs follow, *PREV* past page 1, and *BACK*. The page
 * is rebuilt when the kept runs change (a status or a drop), never per step: the highlight stays
 * on its run, a dropped highlighted run passes it to the next one (the previous at the end), and
 * the page shown is that run's.
 */
export class OnlineScoresScreen implements OnlineScoresView {
  menu: Menu<OnlineScoresRow> = new Menu<OnlineScoresRow>(['back'], { headerGap: HEADER_GAP });
  /** Each run row's text, built on a rebuild only. */
  texts: readonly string[] = [];
  /** An error or *WAIT* at the foot, or nothing. */
  notice: MessageKey | undefined;
  private runs: readonly KeptRun[] = [];
  private page = 0;
  /** The first run of the page shown, set on a rebuild. */
  private start = 0;
  /** The run whose erase is under way, until it leaves the list or fails. */
  private erasingId: string | undefined;

  /** The status line: the highlighted run's status, *NO ONLINE SCORE* when none is kept. */
  get status(): MessageKey | undefined {
    if (this.runs.length === 0) return 'noOnlineScore';
    const run = this.highlightedRun();
    return run === undefined ? undefined : statusLine(run.status);
  }

  /** Opens on page 1, its first row highlighted. */
  open(runs: readonly KeptRun[], now: number, frame: Readonly<IntentFrame>): void {
    this.notice = undefined;
    this.erasingId = undefined;
    this.runs = runs;
    this.showPage(0);
    this.menu.reset(now, frame);
  }

  /** Follows the kept runs (compared by identity, so an unchanged list costs nothing). */
  sync(runs: readonly KeptRun[], frame: Readonly<IntentFrame>): void {
    if (runs === this.runs) return;
    // A status answer only: the rows (score, date) are unchanged and the status is read live, so
    // keep the menu and any press under way.
    if (this.sameRuns(runs)) {
      this.runs = runs;
      return;
    }
    const row = this.menu.rows[this.menu.highlighted];
    const was = this.highlightedRun();
    const index = was === undefined ? -1 : this.runs.indexOf(was);
    this.runs = runs;
    if (was !== undefined) {
      this.followRun(runs, was.id, index, frame);
      return;
    }
    // A highlighted page switch or *BACK* keeps its page, unless it is left without runs: it then
    // closes to the page before (GDD v0.40).
    let page = this.page;
    while (page > 0 && pageStart(runs.length, page) >= runs.length) page -= 1;
    this.rebuild(page, frame);
    if (page !== this.page || row === undefined) this.menu.highlighted = 0;
    else this.highlightRow(row === 'next' && !this.menu.rows.includes('next') ? 'back' : row);
    this.page = page;
  }

  /** The kept run on the highlighted row, if a run row is highlighted. */
  highlightedRun(): KeptRun | undefined {
    if (this.menu.rows[this.menu.highlighted] !== 'score') return undefined;
    return this.runs[this.start + this.menu.highlighted];
  }

  /** *NEXT* or *PREV*: that page, its first row highlighted, behind the opening guard. */
  turn(row: 'next' | 'prev', now: number, frame: Readonly<IntentFrame>): void {
    this.showPage(row === 'next' ? this.page + 1 : this.page - 1);
    this.menu.reset(now, frame);
  }

  /** Back from the erase confirmation: the same row, behind the opening guard (§9.1). */
  reopen(now: number, frame: Readonly<IntentFrame>): void {
    const highlighted = this.menu.highlighted;
    this.menu.reset(now, frame);
    this.menu.highlighted = highlighted;
  }

  /** *Yes* was confirmed: *WAIT* when another request is under way, else follow the erase. */
  erased(id: string, result: 'erasing' | 'busy' | 'gone'): void {
    this.notice = result === 'busy' ? 'wait' : undefined;
    if (result === 'erasing') this.erasingId = id;
  }

  /** Shows the erase's failure; stops following once it failed or the run left the list. */
  followErase(error: FailureCode | undefined, runs: KeptRunsReader): void {
    const id = this.erasingId;
    if (id === undefined) return;
    if (error !== undefined) this.notice = failureLine(error);
    if (error !== undefined || !runs.keeps(id)) this.erasingId = undefined;
  }

  private sameRuns(runs: readonly KeptRun[]): boolean {
    if (runs.length !== this.runs.length) return false;
    for (let i = 0; i < runs.length; i += 1) if (runs[i]?.id !== this.runs[i]?.id) return false;
    return true;
  }

  private followRun(
    runs: readonly KeptRun[],
    id: string,
    index: number,
    frame: Readonly<IntentFrame>,
  ): void {
    let at = -1;
    for (let i = 0; i < runs.length && at < 0; i += 1) if (runs[i]?.id === id) at = i;
    // Dropped: the next run takes its place, or the previous one at the end.
    if (at < 0) at = Math.min(index, runs.length - 1);
    if (at < 0) {
      this.rebuild(0, frame);
      this.page = 0;
      this.menu.highlighted = 0;
      return;
    }
    const page = pageOf(runs.length, at);
    this.rebuild(page, frame);
    this.page = page;
    this.menu.highlighted = at - this.start;
  }

  private highlightRow(row: OnlineScoresRow): void {
    // Always found: a kept page keeps its PREV, and a vanished NEXT was replaced by BACK.
    this.menu.highlighted = this.menu.rows.indexOf(row);
  }

  private showPage(page: number): void {
    this.page = page;
    this.menu = this.build(page);
  }

  /** A new page's menu, carrying over what is held in `frame` (no move, no press, on a rebuild). */
  private rebuild(page: number, frame: Readonly<IntentFrame>): void {
    this.menu = this.build(page);
    this.menu.ignore(frame);
  }

  private build(page: number): Menu<OnlineScoresRow> {
    const total = this.runs.length;
    this.start = pageStart(total, page);
    const shown = this.runs.slice(this.start, this.start + pageCount(total, page, this.start));
    const rows: OnlineScoresRow[] = shown.map(() => 'score');
    const texts = shown.map(runText);
    if (page > 0) rows.push('prev');
    if (this.start + shown.length < total) rows.push('next');
    rows.push('back');
    this.texts = texts;
    return new Menu<OnlineScoresRow>(rows, { headerGap: HEADER_GAP });
  }
}
