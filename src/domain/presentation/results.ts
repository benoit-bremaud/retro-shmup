// The Results screen (GDD v0.10 §8, ADR-0022 decision 9, meta/05-state-scenes): pure draw
// functions, so the scene machine only keeps the cached values and the steps since entry.
import type { TallyView } from '../game/level-tally';
import { ResultsTuning, TallyTuning, toSteps } from '../game/tuning';
import { message } from '../i18n/messages';
import type { Language, MessageKey } from '../i18n/messages';
import { HUD_FONT_CELL } from '../ports/render-port';
import type { RenderPort } from '../ports/render-port';
import { drawBanner, drawVeil } from './overlays';
import { FIELD_WIDTH } from './screen';

const LABELS: readonly MessageKey[] = [
  'tallyFormations',
  'tallyNoBomb',
  'tallyNoMiss',
  'tallyBombs',
  'tallyTotal',
];

/** The tally lines of the Results screen: formations, no bomb, no miss, bombs, total. */
export const RESULTS_LINES = LABELS.length;

const LINE_STEPS = toSteps(ResultsTuning.lineSeconds);
/** The left margin of the labels and the right margin of the values, in field pixels. */
const MARGIN = 8;
const HEADER_Y = 16;
const FIRST_LINE_Y = 52;
/** A label row (20 px) plus its value row (10 px) and the gaps: five lines end at y 254. */
const LINE_PITCH = 48;
const VALUE_OFFSET = 24;

/** `value` with its thousands grouped by a space (`1 500`, `10 000`), the hud font's space. */
export function groupThousands(value: number): string {
  const digits = String(Math.trunc(value));
  let text = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) text += ' ';
    text += digits.charAt(i);
  }
  return text;
}

function product(count: number, unit: number): string {
  return `${String(count)} × ${groupThousands(unit)}  ${groupThousands(count * unit)}`;
}

/**
 * The five values of the Results lines, in line order. Called once when the scene starts, so no
 * string is built per frame; a missed bonus is written 0, never left out.
 */
export function formatTallyValues(tally: TallyView): readonly string[] {
  return [
    product(tally.formationsCleared, TallyTuning.perFormation),
    groupThousands(tally.bombUsed ? 0 : TallyTuning.noBomb),
    groupThousands(tally.lifeLost ? 0 : TallyTuning.noMiss),
    product(tally.bombsLeft, TallyTuning.perBombLeft),
    groupThousands(tally.total()),
  ];
}

/**
 * The Results overlay over the frozen run: the veil, the LEVEL CLEAR header, then one line more
 * every 30 steps from the entering step (step 0): its label in the `title` font at the left
 * margin, its value right-aligned on the row below in the `hud` font, inside the 240 px field.
 */
export function drawResults(
  render: RenderPort,
  values: readonly string[],
  stepsSinceEntry: number,
  language: Language,
): void {
  drawVeil(render);
  const header = message('levelClear', language);
  drawBanner(render, header, HEADER_Y);
  const shown = Math.min(RESULTS_LINES, Math.floor(stepsSinceEntry / LINE_STEPS) + 1);
  for (let i = 0; i < shown; i += 1) {
    const key = LABELS[i];
    const value = values[i];
    if (key === undefined || value === undefined) continue;
    const y = FIRST_LINE_Y + i * LINE_PITCH;
    render.drawText(message(key, language), MARGIN, y, 'title');
    const width = (value.length - 1) * HUD_FONT_CELL.width + HUD_FONT_CELL.glyphWidth;
    render.drawText(value, FIELD_WIDTH - MARGIN - width, y + VALUE_OFFSET, 'hud');
  }
}
