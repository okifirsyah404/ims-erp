/**
 * True when a database error (possibly wrapped by Drizzle) is a PostgreSQL
 * unique violation (SQLSTATE 23505). Services translate it to a 409 when a
 * concurrent insert wins the race after their own pre-check.
 */
export function isUniqueViolation(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; current && depth < 5; depth += 1) {
		const candidate = current as { code?: unknown; errno?: unknown };
		if (candidate.code === '23505' || candidate.errno === '23505') return true;
		current = (current as { cause?: unknown }).cause;
	}
	return false;
}
