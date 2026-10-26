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

/**
 * The country preselected at the first Play (ADR-0021 decision 4 and its 2026-10-26 amendment,
 * GDD v0.30): the browser time zone's country first (`Europe/Paris` → `FR`), else the browser
 * language's region when it is a known code, else `undefined`. `UTC`, `Etc/*` and an unknown zone
 * are absent from the table and fall through. Read once at startup, never in the game loop.
 */
export function preselectedCountry(
  timeZone: string | undefined,
  languageRegion: string | undefined,
): string | undefined {
  const fromZone = timeZone === undefined ? undefined : TIME_ZONE_COUNTRIES.get(timeZone);
  if (fromZone !== undefined) return fromZone;
  return languageRegion !== undefined && COUNTRY_CODES.has(languageRegion)
    ? languageRegion
    : undefined;
}
