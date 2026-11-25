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

/** `DateTimePicker` value (local time) ↔ unix ms. */
export function toDateTimeInput(value: string | number | null): string {
	if (value === null) return '';
	const date = new Date(value);
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

export function fromDateTimeInput(value: string): number | null {
	return value ? new Date(value).getTime() : null;
}

/**
 * Formats integer IDR minor units for display: 123456789 → "Rp 1.234.567,89".
 *
 * @remarks
 * Pinned to `id-ID` on purpose: the ERP operates in rupiah regardless of UI
 * language, so switching the interface to English must not re-format money.
 */
export function formatIdr(minor: number): string {
	return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(minor / 100);
}

/** A business date (`YYYY-MM-DD`, Asia/Jakarta) as a long date in the given language. */
export function formatBusinessDate(value: string | null | undefined, language?: string): string {
	if (!value) return '—';
	return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'id-ID', {
		dateStyle: 'long',
		timeZone: 'UTC',
	}).format(new Date(`${value}T00:00:00Z`));
}

/** Today's business date in Asia/Jakarta, `YYYY-MM-DD` (for `DatePicker`). */
export function todayBusinessDate(): string {
	return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** Whole rupiah typed by a person ↔ integer minor units (ADR-0002). */
export function rupiahToMinor(value: string): number {
	return Math.round(Number(value || '0') * 100);
}

export function minorToRupiah(minor: number): string {
	return String(minor / 100);
}
