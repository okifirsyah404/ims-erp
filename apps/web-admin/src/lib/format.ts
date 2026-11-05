/**
 * Humanizes a machine-formatted identifier for display:
 * `customer_service` → "Customer Service", `member` → "Member",
 * `org-admin` → "Org Admin". Handles snake_case and kebab-case;
 * already-spaced input passes through unchanged. Empty input falls
 * back to the table's dash placeholder.
 */
export function humanizeIdentifier(
	value: string | null | undefined,
): string {
	if (!value) return '—';
	return value
		.replace(/[_-]+/g, ' ')
		.trim()
		.split(/\s+/)
		.map((word) =>
			word.length > 0 ? word[0]!.toUpperCase() + word.slice(1) : word,
		)
		.join(' ');
}

/**
 * Date and time in Asia/Jakarta (business time), in the UI language.
 * Empty input falls back to the table's dash placeholder.
 */
export function formatDateTime(value: string | number | Date | null | undefined, language?: string): string {
	if (value === null || value === undefined || value === '') return '—';
	return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'id-ID', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Asia/Jakarta',
	}).format(new Date(value));
}

/** `<input type="datetime-local">` value (local time) ↔ unix ms. */
export function toDateTimeInput(value: string | number | null): string {
	if (value === null) return '';
	const date = new Date(value);
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

export function fromDateTimeInput(value: string): number | null {
	return value ? new Date(value).getTime() : null;
}
