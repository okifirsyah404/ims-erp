/**
 * Pure helpers behind the item filter popover (`item-filters-popover.tsx`):
 * drafts are strings while a person types, numbers in the URL.
 */

/** A URL number as the draft string of an input (`undefined` -> empty). */
export function toDraft(value: number | undefined): string {
	return value === undefined ? '' : String(value);
}

/** A draft string as a number, or `undefined` when empty or not a number. */
export function toNumber(draft: string): number | undefined {
	if (draft.trim() === '' || draft === '.') return undefined;
	const parsed = Number(draft);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Keeps digits and one decimal separator (comma or dot, stored as a dot) with
 * at most three decimals, the precision of the quantity columns.
 */
export function sanitizeQuantity(raw: string): string {
	const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
	const dot = cleaned.indexOf('.');
	if (dot === -1) return cleaned.replace(/^0+(?=\d)/, '');
	const integer = cleaned.slice(0, dot).replace(/^0+(?=\d)/, '') || '0';
	return `${integer}.${cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 3)}`;
}

/** Slider step that gives roughly a hundred stops, never below 1. */
export function sliderStep(bound: number): number {
	if (bound <= 100) return 1;
	return 10 ** (Math.floor(Math.log10(bound)) - 1);
}

/**
 * The `[low, high]` thumb positions for two drafts: an empty side sits on its
 * bound, and both are clamped into `0..bound`.
 */
export function sliderValue(minDraft: string, maxDraft: string, bound: number): [number, number] {
	const top = Math.max(bound, 1);
	const low = Math.min(Math.max(toNumber(minDraft) ?? 0, 0), top);
	const high = Math.min(Math.max(toNumber(maxDraft) ?? top, 0), top);
	return low <= high ? [low, high] : [high, low];
}
