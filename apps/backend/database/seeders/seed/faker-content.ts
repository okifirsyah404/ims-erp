/**
 * Encoding-safe text helpers for faker-generated seed content.
 *
 * @remarks
 * The dev PostgreSQL database is created with the WIN1252 encoding (typical
 * of a locally-installed PostgreSQL on Windows). WIN1252 cannot represent
 * 4-byte UTF-8 characters (emoji, some symbols), and faker text fields
 * (`person.bio()`, `person.fullName()`, …) do emit them occasionally. Such an
 * insert fails with:
 * `character with byte sequence 0x… in encoding "UTF8" has no equivalent in
 * encoding "WIN1252"`.
 *
 * All faker-generated free-text passed to the database MUST go through
 * {@link seedSafeText}. Deterministic anchors (emails, usernames, SKUs,
 * serials, phones) are ASCII by construction and need no sanitizing.
 */

/**
 * Strips characters a WIN1252 database cannot store (anything above Latin-1,
 * which includes all emoji and 3-4 byte UTF-8 sequences) and collapses the
 * leftover whitespace.
 *
 * @param value - Raw faker-generated text
 * @returns Latin-1-safe, whitespace-collapsed, trimmed text
 */
export function seedSafeText(value: string): string {
	// Char-code filter rather than a negated-character-class regex: oxlint
	// flags control characters inside regexes (no-control-regex), and the
	// strip range begins at \u0000.
	const stripped = Array.from(value)
		.filter((ch) => {
			const code = ch.codePointAt(0) ?? 0;
			// Keep printable ASCII, Latin-1 letters/punctuation, and whitespace.
			return (
				(code >= 0x0020 && code <= 0x007e) ||
				(code >= 0x00a0 && code <= 0x00ff) ||
				code === 0x0009 ||
				code === 0x000a ||
				code === 0x000d
			);
		})
		.join('');
	return stripped.replace(/\s+/g, ' ').trim();
}
