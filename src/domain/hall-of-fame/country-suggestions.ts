import { COUNTRY_CODES } from './country-codes';
import { TIME_ZONE_COUNTRY_PAIRS } from './time-zone-countries';

const TIME_ZONE_COUNTRIES: ReadonlyMap<string, string> = (() => {
  const words = TIME_ZONE_COUNTRY_PAIRS.split(' ');
  const table = new Map<string, string>();
  for (let i = 0; i + 1 < words.length; i += 2) {
    const zone = words[i];
    const code = words[i + 1];
    if (zone !== undefined && code !== undefined) table.set(zone, code);
  }
  return table;
})();

/** The flags offered when the browser and the save say nothing more (GDD v0.34 §9.1). */
const COMMON_COUNTRIES: readonly string[] = ['FR', 'BE', 'CH', 'CA', 'US', 'GB'];

/** How many flags the country choice suggests: six cells of its 2 × 4 grid (ADR-0030). */
export const SUGGESTION_COUNT = 6;

/**
 * What the browser hints about the player's country (ADR-0021 decision 4 and its 2026-10-26
 * amendment): the time zone's country first (`Europe/Paris` → `FR`), then the language's region
 * when it is a known code, each once. `UTC`, `Etc/*` and an unknown zone are absent from the
 * table and give nothing. Read once at startup, never in the game loop.
 */
export function countryHints(
  timeZone: string | undefined,
  languageRegion: string | undefined,
): string[] {
  const hints: string[] = [];
  const fromZone = timeZone === undefined ? undefined : TIME_ZONE_COUNTRIES.get(timeZone);
  if (fromZone !== undefined) hints.push(fromZone);
  if (
    languageRegion !== undefined &&
    COUNTRY_CODES.has(languageRegion) &&
    languageRegion !== fromZone
  )
    hints.push(languageRegion);
  return hints;
}

/**
 * The six countries the choice suggests by flag (GDD v0.34 §9.1, ADR-0030): the browser's hints,
 * then the saved country, then the common ones, each known code once. Runs when the choice opens,
 * never per frame.
 */
export function suggestedCountries(hints: readonly string[], saved: string | undefined): string[] {
  const suggested: string[] = [];
  const add = (code: string | undefined): void => {
    if (
      code !== undefined &&
      suggested.length < SUGGESTION_COUNT &&
      COUNTRY_CODES.has(code) &&
      !suggested.includes(code)
    )
      suggested.push(code);
  };
  for (let i = 0; i < hints.length; i += 1) add(hints[i]);
  add(saved);
  for (let i = 0; i < COMMON_COUNTRIES.length; i += 1) add(COMMON_COUNTRIES[i]);
  return suggested;
}
