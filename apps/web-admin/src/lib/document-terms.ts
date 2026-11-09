/**
 * Text syntax of the warranty terms (company profile and certificates): one
 * item per line, a line starting with `o ` or `- ` is a sub-item of the
 * previous one; a leading "1." is dropped (the print numbers the items).
 */
export type TTerm = { text: string; children: string[] };

/** One item per line; a line starting with `o ` or `- ` is a sub-item of the previous one. */
export function parseTerms(text: string): TTerm[] {
	const terms: TTerm[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const sub = /^(o|-)\s+(.*)$/.exec(line);
		if (sub && terms.length > 0) terms[terms.length - 1]!.children.push(sub[2]!);
		else terms.push({ text: line.replace(/^\d+[.)]\s*/, ''), children: [] });
	}
	return terms;
}
