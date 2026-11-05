/**
 * `%term%` for ILIKE with `%`, `_` and `\` in the term matched literally
 * (PostgreSQL's default LIKE escape character is the backslash).
 */
export function likePattern(term: string): string {
	return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
