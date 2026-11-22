import type { TProductComponent, TProductKind } from './inventory-api';

/**
 * Pure helpers of the product composition editor (components and materials a
 * product is made of); the UI lives in `components/inventory/product-composition`.
 */

/** Server cap on the lines of one composition. */
export const MAX_COMPOSITION_LINES = 50;

/** A line being edited in a form; `quantity` stays text until it is saved. */
export type TCompositionDraft = {
	componentId: string;
	code: string;
	name: string;
	productKind: TProductKind;
	unitLabel: string;
	quantity: string;
};

/** Starts an editor from the lines the server returned (archived ones are kept so the user can see and drop them). */
export function toCompositionDrafts(components: readonly TProductComponent[] | undefined): TCompositionDraft[] {
	return (components ?? []).map((line) => ({
		componentId: line.componentId,
		code: line.code,
		name: line.name,
		productKind: line.productKind,
		unitLabel: line.unitLabel,
		quantity: String(Number(line.quantity)),
	}));
}

/** Parses a typed quantity: positive, at most three decimals; otherwise `null`. */
export function parseQuantity(text: string): number | null {
	const value = Number(text.replace(',', '.'));
	if (!Number.isFinite(value) || value <= 0) return null;
	return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6 ? value : null;
}

/** The request lines, or `null` when any quantity is invalid. */
export function toCompositionLines(drafts: readonly TCompositionDraft[]) {
	const lines = drafts.map((draft) => ({ componentId: draft.componentId, quantity: parseQuantity(draft.quantity) }));
	return lines.every((line) => line.quantity !== null)
		? (lines as { componentId: string; quantity: number }[])
		: null;
}
