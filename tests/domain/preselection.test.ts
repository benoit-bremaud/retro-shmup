import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES } from '../../src/domain/hall-of-fame/country-codes';
import { preselectedCountry } from '../../src/domain/hall-of-fame/preselection';
import { TIME_ZONE_COUNTRY_PAIRS } from '../../src/domain/hall-of-fame/time-zone-countries';

describe('preselectedCountry (ADR-0021 amendment of 2026-10-26)', () => {
  it('takes the time zone first: an English speaker in France gets FR', () => {
    expect(preselectedCountry('Europe/Paris', 'US')).toBe('FR');
  });

  it('keeps the time zone when the language region is unknown or lowercase', () => {
    expect(preselectedCountry('Europe/Paris', 'XK')).toBe('FR');
    expect(preselectedCountry('Europe/Paris', 'fr')).toBe('FR');
  });

  it.each([
    ['America/Argentina/Cordoba', 'AR'], // one of a country's several zones
    ['Asia/Calcutta', 'IN'], // old names browsers still report, from the links
    ['Europe/Kiev', 'UA'],
    ['Africa/Asmera', 'ER'],
    ['America/Godthab', 'GL'],
  ])('maps %s to %s', (zone, code) => {
    expect(preselectedCountry(zone, undefined)).toBe(code);
  });

  it.each(['UTC', 'CET', 'Mars/Olympus', ''])(
    'falls back to the language region for the zone %j',
    (zone) => {
      expect(preselectedCountry(zone, 'BE')).toBe('BE');
    },
  );

  it.each([
    [undefined, 'CA', 'CA'],
    [undefined, undefined, undefined],
    ['UTC', 'XK', undefined], // user-assigned, not in the allowlist
    ['UTC', '419', undefined], // a UN M.49 region, not a country
  ])('with the zone %j and the region %j gives %j', (zone, region, expected) => {
    expect(preselectedCountry(zone, region)).toBe(expected);
  });

  it('holds only zone names and known codes in the generated table', () => {
    const words = TIME_ZONE_COUNTRY_PAIRS.split(' ');
    const bad: string[] = [];
    for (let i = 0; i < words.length; i += 2) {
      const zone = words[i] ?? '';
      const code = words[i + 1] ?? '';
      if (!zone.includes('/') || !COUNTRY_CODES.has(code)) bad.push(`${zone} ${code}`);
    }
    expect(words.length % 2).toBe(0);
    expect(bad).toEqual([]);
  });
});
