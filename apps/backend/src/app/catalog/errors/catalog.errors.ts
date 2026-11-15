import { AppError } from '@http/errors';

/** The listing or the published product does not exist. */
export class CatalogNotFoundError extends AppError {
	constructor(kind: 'listing' | 'product') {
		const messages = { listing: 'Listing not found', product: 'Product not found' };
		super(404, `catalog.notFound.${kind}` as const, messages[kind]);
	}
}

/** The slug or the item already has a listing; or the item cannot be listed. */
export class ListingConflictError extends AppError {
	constructor(kind: 'slug' | 'item' | 'itemUnavailable' | 'noPrice') {
		const messages = {
			slug: 'Another listing already uses this slug',
			item: 'This item already has a listing',
			itemUnavailable: 'The item is archived or inactive',
			noPrice: 'The item has no selling price; use quotation pricing',
		};
		super(kind === 'itemUnavailable' || kind === 'noPrice' ? 422 : 409, `catalog.listing.${kind}` as const, messages[kind]);
	}
}
