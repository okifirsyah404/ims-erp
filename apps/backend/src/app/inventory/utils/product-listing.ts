import type { OutOfStockMode } from '@drizzle/schemas/inventory.schema';
import type { TProductQuery, TStockStatus } from '../contracts/product-listing.contract';

/**
 * Pure website-catalog rules (M04 stage 1).
 */

/** The website's product card (`CatalogProduct`). Money is whole rupiah. */
export type TWebProduct = {
	slug: string;
	name: string;
	categorySlug: string;
	category: string;
	shortCategory: string;
	specs: string;
	stock: TStockStatus;
	priceCaption: string;
	price: number | null;
	rating: number;
	applications: string[];
	popularity: number;
	listedAt: string;
	image?: string;
};

/**
 * Stock shown to the public: services and untracked items are on request;
 * stock on hand is ready; otherwise the listing's out-of-stock mode.
 */
export function stockStatus(isStockTracked: boolean, available: number, mode: OutOfStockMode): TStockStatus {
	if (!isStockTracked) return 'request';
	return available > 0 ? 'ready' : mode;
}

/** IDR minor units → whole rupiah (rounded half up). */
export function toRupiah(minor: number): number {
	return Math.round(minor / 100);
}

/** Filters, sorts and pages the published products the way the website asks. */
export function queryProducts(products: TWebProduct[], query: TProductQuery) {
	const q = query.q?.toLowerCase();
	const filtered = products.filter(
		(product) =>
			(!q || `${product.name} ${product.category} ${product.specs}`.toLowerCase().includes(q)) &&
			(query.category.length === 0 || query.category.includes(product.categorySlug)) &&
			(query.availability.length === 0 || query.availability.includes(product.stock)) &&
			(query.application.length === 0 || query.application.some((tag) => product.applications.includes(tag))) &&
			(query.min === undefined || (product.price !== null && product.price >= query.min)) &&
			(query.max === undefined || (product.price !== null && product.price <= query.max)),
	);
	// Products without a price (quotation) go last in price sorts.
	const price = (product: TWebProduct, fallback: number) => product.price ?? fallback;
	const sorters: Record<TProductQuery['sort'], (a: TWebProduct, b: TWebProduct) => number> = {
		popular: (a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name),
		newest: (a, b) => b.listedAt.localeCompare(a.listedAt) || a.name.localeCompare(b.name),
		'price-asc': (a, b) => price(a, Number.MAX_SAFE_INTEGER) - price(b, Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name),
		'price-desc': (a, b) => price(b, -1) - price(a, -1) || a.name.localeCompare(b.name),
	};
	const sorted = [...filtered].sort(sorters[query.sort]);
	const pageCount = Math.max(1, Math.ceil(sorted.length / query.pageSize));
	const page = Math.min(query.page, pageCount);
	return {
		items: sorted.slice((page - 1) * query.pageSize, page * query.pageSize),
		total: sorted.length,
		page,
		pageCount,
	};
}
