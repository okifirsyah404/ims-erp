import type { ProductKind } from '@drizzle/schemas/product.schema';

/** One line of a product's composition, joined with the component it points at. */
export type TProductComponentRow = {
	id: string;
	componentId: string;
	/** Code of the component (`CMP-…` / `MAT-…`). */
	code: string;
	name: string;
	productKind: ProductKind;
	unitLabel: string;
	/** `numeric(18,3)` as a decimal string. */
	quantity: string;
	sortOrder: number;
	/** The component was archived after it was listed. */
	isArchived: boolean;
};

/** A line the client sends; the position in the list is the sort order. */
export type TProductComponentLine = { componentId: string; quantity: number };

/** The few columns of a candidate component the service validates. */
export type TComponentCandidate = {
	id: string;
	organizationId: string | null;
	productKind: ProductKind;
};

/**
 * Persistence contract of `product.product_components`.
 *
 * @remarks
 * Own-module queries only: both sides of the link live in the `product`
 * schema. Rows are soft-deleted; the live set of a product is replaced as a
 * whole inside one transaction.
 */
export interface IProductComponentRepository {
	/** Live lines of a product, in list order (archived components included). */
	list(productId: string): Promise<TProductComponentRow[]>;

	/** Live (not archived) products among `ids`, for kind and tenant checks. */
	findLiveByIds(ids: string[]): Promise<TComponentCandidate[]>;

	/** Soft-deletes the live lines and inserts `lines` in one transaction. */
	replace(productId: string, lines: TProductComponentLine[]): Promise<void>;
}
