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
