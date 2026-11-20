import { AppError } from '@http/errors';

/** The product has no listing, or the published product does not exist. */
export class CatalogNotFoundError extends AppError {
	constructor(kind: 'listing' | 'product') {
		const messages = { listing: 'Listing not found', product: 'Product not found' };
		super(404, `catalog.notFound.${kind}` as const, messages[kind]);
	}
}

/**
 * The slug is taken, or the product cannot be listed.
 *
 * @remarks
 * A product has at most one listing (its own columns), so "this item already has
 * a listing" no longer exists as a conflict: saving a listing replaces it.
 */
export class ListingConflictError extends AppError {
	constructor(kind: 'slug' | 'itemUnavailable' | 'noPrice') {
		const messages = {
			slug: 'Another listing already uses this slug',
			itemUnavailable: 'The product is archived or inactive',
			noPrice: 'The product has no selling price; use quotation pricing',
		};
		super(kind === 'slug' ? 409 : 422, `catalog.listing.${kind}` as const, messages[kind]);
	}
}
