# ADR-0021: Hall of fame entry — an 8-character name and an optional country

**Status:** Accepted — 2026-10-12. Decision 4 amended by ADR-0027 (the country chosen once and saved in the options). **Partially supersedes ADR-0006**: decision 3 (the
`HighScoreEntry.initials` field of exactly 3 characters becomes `name` and an optional
`country`), decision 7 ("No personal data beyond three initials" becomes "no personal data beyond
this name and this optional country") and the matching code-review follow-up (`initials` validated
against the name-entry alphabet and length 3). Every other part of ADR-0006 stands: `localStorage`
only, one key and one versioned document, `StoragePort`, allowlist validation, parsing that never
throws, one migration per version bump, graceful degradation, writes at discrete moments only, no
backend. Values are GDD v0.9 values (§8, §9.1, §9.8).

## Context

- ADR-0006 stores three-letter initials and fixes "no personal data beyond three initials". The
  owner's brainstorm after the brick-E playtest (2026-10-12) replaced them, from scored options,
  with a name of up to 8 characters entered with an arcade letter picker, and an optional country
  preselected from the browser language's region (GDD v0.9 §9.1, Decision record "Top-10 name" and
  "Top-10 country").
- The save document is untrusted input (CLAUDE.md, ADR-0006): anything read back must pass an
  allowlist, and parsing must never throw.
- No save document exists yet: `SaveDocument`, `parseSaveDocument` and the `localStorage` adapter
  arrive with the screens brick (G). No player holds a stored `retro-shmup.v1` document.
- The v2 online board (GDD §11.3) may show the country; 1.0 sends nothing anywhere.

## Decision

1. **The entry shape.** `HighScoreEntry` becomes:

   ```ts
   export interface HighScoreEntry {
     readonly name: string;     // 1–8 characters from A–Z, 0–9 and space, or exactly "???"
     readonly country?: string; // ISO 3166-1 alpha-2, in COUNTRY_CODES; absent when not chosen
     readonly score: number;
     readonly level: 1 | 2 | 3;
     readonly date: string;     // unchanged (ADR-0006)
   }
   ```

2. **Name.** Characters from A–Z, 0–9 and space only; trimmed at both ends when entered; length 1
   to 8 after trimming (so never all spaces). A skipped entry stores exactly `???`, the only value
   allowed outside that alphabet.
3. **Country.** Optional. When present it is two uppercase letters that appear in
   `COUNTRY_CODES`, an allowlist kept in the code of the officially assigned ISO 3166-1 alpha-2
   codes (user-assigned codes such as XK excluded), refreshed with releases (domain data, no
   network lookup). Absent when the player chose none or cleared it.
4. **Preselection is a UI default only.** The name-entry screen preselects the country from the
   region subtag of the first language of the ADR-0009 environment snapshot only (decision 4, for example
   `fr-FR` → `FR`; none when the language has no region or the region is not in the allowlist).
   It is stored only when the player confirms the entry; nothing else is read or inferred — no
   network call, no IP lookup, no Geolocation API.
5. **Personal data.** The only personal data stored are this name and this optional country,
   local to the browser, never sent anywhere in 1.0 (ADR-0006 decision 1). The ePrivacy
   "strictly necessary" reading of ADR-0006 decision 7 is unchanged: the player explicitly asks to
   keep the entry.
6. **Validation fails closed.** `parseSaveDocument` checks each entry against decisions 2 and 3
   (and ADR-0006's other fields); an entry that fails any check is dropped, the rest of the table
   is kept; parsing never throws (ADR-0006).
7. **Versioning.** Because no document has been stored yet, the screens brick writes the first
   schema, `version: 1`, with `name` and `country` directly; no `initials` field ever ships and no
   migration is needed. Had a version with `initials` shipped, the rule of ADR-0006 decision 4
   would apply: a version bump and a migration mapping `initials` to `name` with no `country`.
8. **Fonts.** The bitmap fonts drawing the entry, the table and the name entry (the `title` font
   today has A–Z and space only) gain 0–9 and `?` in the screens brick (G); the country code uses
   A–Z. Pixel flags replace the code with the assets brick.

## Alternatives considered

- **Keep three initials** — rejected by the owner: less personal (GDD v0.9 Decision record).
- **Free text with the system keyboard** — rejected: an HTML field in a pixel game, poor on
  gamepad, and free input to validate.
- **Infer the country from the IP or the Geolocation API** — rejected: a network call (forbidden in
  1.0) or a permission prompt, disproportionate for a score label.
- **Store the preselected country without confirmation** — rejected: it would store something the
  player never chose.
- **Validate the country by format only (two letters)** — rejected: an allowlist is the project
  rule for untrusted input, and an unknown code could not be drawn as a flag later.
- **Reject the whole document on one bad entry** — rejected: dropping only that entry keeps the
  player's other scores; the document stays fail-closed per entry.

## Consequences

- The table and the v2 online board get a readable name and a country; the stored personal data
  grows from 3 characters to at most 8 plus a 2-letter code.
- The screens brick adds `COUNTRY_CODES`, the name and country checks in `parseSaveDocument`, the
  letter picker on every device and the font glyphs.
- Code review checks: the name alphabet, length 1–8, trimmed, not all spaces, or `???`; the country
  absent or in `COUNTRY_CODES`; the preselection never stored without confirmation; no new field
  carries personal data; no network call.
- Tests (ADR-0003 pyramid): `parseSaveDocument` fixtures keeping a valid entry with and without a
  country and dropping a name of 9 characters, with a lowercase or `.` character, all spaces,
  untrimmed, a country `fr`, `ZZ`, `FRA` or a number; `???` accepted; the preselection from
  `fr-FR` gives `FR`, from `fr` none.
- The v2 online board still needs its own ADR and a privacy notice before any entry leaves the
  device (ADR-0006).

## References

- GDD v0.9 §8, §9.1, §9.8, §13, Decision record ("Top-10 name", "Top-10 country"); ADR-0006,
  ADR-0009; `docs/architecture/diagrams/meta/05-state-scenes.md` (design revision v0.9);
  ISO 3166-1 alpha-2; BCP 47 (region subtag); Regulation (EU) 2016/679, Art. 5(1)(c).

## Amendment (2026-10-14, GDD v0.16)

Decision 7's `version: 1` is overtaken: the save document reached version 2 with the bindings
(GDD v0.15, G1b) before any entry was stored. The entries first ship under version 2, in the
shape of decision 1; the empty `highScores` written by versions 1 and 2 is parsed by the same
allowlist, so no version bump and no migration are needed. The decisions are otherwise unchanged
and the status stays *Accepted*.

## Amendment (2026-10-14, owner decision)

Decision 2's skipped entry is withdrawn: skipping the name entry, or confirming an empty name,
records nothing (the player is never made to appear in the table). `???` is no longer produced;
the save document's parser still accepts it, so an entry stored by an earlier build is kept. The
other decisions and the status are unchanged.

