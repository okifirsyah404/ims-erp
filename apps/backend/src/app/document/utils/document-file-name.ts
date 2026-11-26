/**
 * File names of registry documents: `<slug(title)>_<dd_mm_yyyy>_<HHmmss>.<ext>`.
 *
 * @remarks
 * The name a person sees and downloads is derived from the document, never
 * from the uploader's file name (which is arbitrary and often `scan001.pdf`).
 * The hour is always there so two files of one document never share a name;
 * a same-second collision still gets `_2`, `_3`. The object-storage key stays
 * `<prefix>/<uuid>.<ext>`, so a re-upload never overwrites an issued file.
 */
import { JAKARTA_OFFSET_MS } from '@utils/business-date.util';

/** Longest slug taken from the title; the date and extension take the rest. */
export const MAX_FILE_SLUG = 80;

/** Truncation that prefers a word boundary over a half word. */
function capAtWordBoundary(value: string, max: number): string {
	if (value.length <= max) return value;
	const cut = value.slice(0, max + 1);
	const boundary = cut.lastIndexOf('_');
	const capped = boundary > 0 ? cut.slice(0, boundary) : cut.slice(0, max);
	return capped.replace(/_+$/, '');
}

/**
 * A lower-case, underscore-separated file-safe slug.
 *
 * @param title - The document title (`Perjanjian Kerja - Pertiwi Jamalia`)
 * @param max - Longest accepted slug; longer titles are cut at a word boundary
 */
export function slugifyDocumentTitle(title: string, max = MAX_FILE_SLUG): string {
	const slug = title
		.normalize('NFD')
		// Strip the diacritics NFD just split off (é → e + ́).
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return capAtWordBoundary(slug, max);
}

/** `dd_mm_yyyy_HHmmss` in Asia/Jakarta (operational timestamps are UTC). */
export function jakartaFileStamp(at: Date | number = Date.now()): string {
	// 2026-11-25T07:32:05Z shifted by +7h reads 14:32:05 on the same ISO date.
	const shifted = new Date(new Date(at).getTime() + JAKARTA_OFFSET_MS).toISOString();
	const [year = '1970', month = '01', day = '01'] = shifted.slice(0, 10).split('-');
	const [hour = '00', minute = '00', second = '00'] = shifted.slice(11, 19).split(':');
	return `${day}_${month}_${year}_${hour}${minute}${second}`;
}

/**
 * The stored file name of one document file.
 *
 * @param title - Document title; falls back to the code when empty
 * @param code - Registry code, the fallback slug
 * @param extension - File extension without the dot (`pdf`, `png`)
 * @param at - Creation instant (its Jakarta hour goes into the name)
 * @param taken - File names already used by this document; a match gets `_2`
 */
export function documentFileName({
	title,
	code,
	extension,
	at = new Date(),
	taken,
}: {
	title: string | null | undefined;
	code: string;
	extension: string;
	at?: Date | number;
	taken?: Iterable<string>;
}): string {
	const slug = slugifyDocumentTitle(title?.trim() || code) || slugifyDocumentTitle(code) || 'dokumen';
	const base = `${slug}_${jakartaFileStamp(at)}`;
	const used = new Set(Array.from(taken ?? [], (name) => name.toLowerCase()));
	let name = `${base}.${extension}`;
	for (let suffix = 2; used.has(name.toLowerCase()); suffix += 1) {
		name = `${base}_${suffix}.${extension}`;
	}
	return name;
}
