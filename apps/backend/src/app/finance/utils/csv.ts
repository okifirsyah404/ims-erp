/**
 * Splits one CSV line on `,` (or `;` when the line has no unquoted comma).
 * Double quotes group a cell, so `"1.500.000,50"` stays one Indonesian amount.
 */
export function csvCells(line: string): string[] {
	const split = (separator: string) => {
		const out: string[] = [];
		let current = '';
		let quoted = false;
		for (const char of line) {
			if (char === '"') quoted = !quoted;
			else if (char === separator && !quoted) {
				out.push(current.trim());
				current = '';
			} else current += char;
		}
		out.push(current.trim());
		return out;
	};
	const byComma = split(',');
	return byComma.length === 1 ? split(';') : byComma;
}
