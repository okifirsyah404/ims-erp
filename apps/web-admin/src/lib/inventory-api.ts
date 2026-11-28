import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { organizationHeaders } from './organization-store';

/**
 * API client for the product master endpoints (`/products`).
 *
 * @remarks
 * A **product** is the stocked/sold SKU master (formerly "item"; ADR-0024).
 * Physical tools and assets are `items` on the backend and live in
 * `asset-api.ts`. Serialized instances of a product are `item_serials`, exposed
 * here as {@link TProductSerial}.
 *
 * Tenant scope comes from the `x-organization-id` header the backend prefers
 * over the session value, so reads always hit the organization the UI is
 * showing. `product:*` permissions gate every call server-side; the UI only
 * hides controls it knows will fail.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Product kinds, mirroring `PRODUCT_KINDS` in the backend schema. */
export const PRODUCT_KINDS = ['product', 'component', 'material'] as const;
export type TProductKind = (typeof PRODUCT_KINDS)[number];

/** Fixed unit list (ADR-0011); mirrors `ITEM_UNITS` in the backend schema. */
export const ITEM_UNIT_LABELS = [
	'pcs',
	'unit',
	'set',
	'paket',
	'titik',
	'm',
	'roll',
	'kg',
	'jam',
	'bulan',
	'tahun',
	'lic',
	'lot',
	'pulau',
] as const;
export type TItemUnitLabel = (typeof ITEM_UNIT_LABELS)[number];

/**
 * Serial statuses, mirroring `SERIAL_STATUSES`. The stored value for "ready" is
 * `in_stock`. There is no `borrowed`: lending is tracked on physical items.
 */
export const SERIAL_STATUSES = [
	'pre_order',
	'in_stock',
	'lost',
	'sold',
	'applied_warranty',
	'returned',
	'damaged',
	/** B-29: taken out by a manual stock issue (project material or own use). */
	'issued',
] as const;
export type TSerialStatus = (typeof SERIAL_STATUSES)[number];

/** One product master row. `minStockQty` arrives as a decimal string. */
export type TProduct = {
	id: string;
	organizationId: string | null;
	/** Human reference from the numbering authority (ERP-0043); read-only. */
	code: string;
	sku: string;
	/** Optional manufacturer serial of the product master itself (ERP-0043). */
	serialNumber: string | null;
	name: string;
	description: string | null;
	productKind: TProductKind;
	/** Product category (ADR-0011); resolve the name via `useItemCategoryNames`. */
	productCategoryId: string | null;
	brand: string | null;
	specification: string | null;
	/** Short-lived URL of the document photo (single/detail endpoints). */
	imageUrl?: string | null;
	/** Components and materials it is made of (single endpoint only). */
	components?: TProductComponent[];
	unitLabel: TItemUnitLabel;
	/** Inactive products are not offered for new documents. */
	isActive: boolean;
	isSerialized: boolean;
	isStockTracked: boolean;
	minStockQty: string;
	/** B-30: standard customer warranty in months (sale without a project); null = none. */
	warrantyMonths?: number | null;
	barcode: string | null;
	sellingPrice: number;
	purchasePrice: number;
	currencyCode: string;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
	/**
	 * Total `quantity_on_hand` for this product in the requested warehouse,
	 * summed over `stocks` bins. Present only when the list request carried
	 * `warehouseId` (decimal string, like the numeric column).
	 */
	quantityOnHand?: string | null;
};

/** One line of a product's composition (`GET /products/:id/components`). */
export type TProductComponent = {
	id: string;
	componentId: string;
	code: string;
	name: string;
	productKind: TProductKind;
	unitLabel: string;
	/** `numeric(18,3)` as a decimal string. */
	quantity: string;
	sortOrder: number;
	/** The component was archived after it was listed. */
	isArchived: boolean;
};

/** One serialized unit of a product (`inventory.item_serials`). */
export type TProductSerial = {
	id: string;
	organizationId: string | null;
	productId: string;
	serialNumber: string;
	isProvisionalSerial: boolean;
	assetTag: string | null;
	status: TSerialStatus;
	warehouseId: string | null;
	binId: string | null;
	acquiredOn: string | null;
	warrantyExpiresOn: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

/** Fields the create form submits. `code` is server-allocated (ERP-0043). */
export type TProductCreateInput = {
	sku: string;
	serialNumber?: string | null;
	name: string;
	productKind: TProductKind;
	description?: string | null;
	productCategoryId?: string | null;
	brand?: string | null;
	specification?: string | null;
	unitLabel: TItemUnitLabel;
	isActive: boolean;
	isSerialized: boolean;
	isStockTracked: boolean;
	minStockQty: number;
	warrantyMonths?: number | null;
	barcode?: string | null;
	sellingPrice: number;
	purchasePrice: number;
	currencyCode: string;
};

/** Fields the edit form submits. `sku`/`productKind` are immutable. */
export type TProductUpdateInput = Partial<
	Omit<TProductCreateInput, 'sku' | 'productKind'>
>;

async function request<T>(
	path: string,
	init?: RequestInit,
): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			...organizationHeaders(),
			...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(
			envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed',
		);
	}
	return envelope;
}

/** Fetches one page of products, optionally filtered by kind. */
export async function listProducts(params?: {
	page?: number;
	limit?: number;
	productKind?: TProductKind;
	search?: string;
	productCategoryId?: string;
	/** Only products offered for new documents. */
	activeOnly?: boolean;
	/** Only products with a live serial or stock balance in this warehouse. */
	warehouseId?: string;
	includeArchived?: boolean;
	/** Lifecycle on `is_active`; wins over `activeOnly`. */
	status?: 'all' | 'active' | 'inactive';
	/** Selling price range in IDR **minor units**, inclusive. */
	minPrice?: number;
	maxPrice?: number;
	/** On-hand quantity range (summed over every bin), inclusive. */
	minStock?: number;
	maxStock?: number;
	sortBy?: 'name' | 'code' | 'price';
	sortDir?: 'asc' | 'desc';
}) {
	const search = new URLSearchParams();
	if (params?.page) search.set('page', String(params.page));
	if (params?.limit) search.set('limit', String(params.limit));
	if (params?.productKind) search.set('productKind', params.productKind);
	if (params?.search) search.set('search', params.search);
	if (params?.productCategoryId) {
		search.set('productCategoryId', params.productCategoryId);
	}
	if (params?.activeOnly) search.set('activeOnly', 'true');
	if (params?.warehouseId) search.set('warehouseId', params.warehouseId);
	if (params?.includeArchived) search.set('includeArchived', 'true');
	if (params?.status) search.set('status', params.status);
	if (params?.minPrice !== undefined) search.set('minPrice', String(params.minPrice));
	if (params?.maxPrice !== undefined) search.set('maxPrice', String(params.maxPrice));
	if (params?.minStock !== undefined) search.set('minStock', String(params.minStock));
	if (params?.maxStock !== undefined) search.set('maxStock', String(params.maxStock));
	if (params?.sortBy) search.set('sortBy', params.sortBy);
	if (params?.sortDir) search.set('sortDir', params.sortDir);
	const query = search.toString();

	const envelope = (await request<TProduct[]>(
		`/products${query ? `?${query}` : ''}`,
	)) as TApiPaginatedResponse<TProduct>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one product. */
export async function getProduct(productId: string) {
	const envelope = await request<TProduct>(`/products/${productId}`);
	return envelope.data;
}

/** Creates a product. */
export async function createProduct(input: TProductCreateInput) {
	const envelope = await request<TProduct>('/products', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/** Updates a product's mutable fields. */
export async function updateProduct(
	productId: string,
	input: TProductUpdateInput,
) {
	const envelope = await request<TProduct>(
		`/products/${productId}`,
		{
			method: 'PATCH',
			body: JSON.stringify(input),
		},
	);
	return envelope.data;
}

/** Replaces the whole composition of a product (components and materials). */
export async function saveProductComponents(
	productId: string,
	lines: { componentId: string; quantity: number }[],
) {
	const envelope = await request<TProductComponent[]>(`/products/${productId}/components`, {
		method: 'PUT',
		body: JSON.stringify({ lines }),
	});
	return envelope.data;
}

/** Archives a product (soft delete). */
export async function archiveProduct(productId: string) {
	await request(`/products/${productId}`, { method: 'DELETE' });
}

/** Fetches one page of a product's serialized units. */
export async function listProductSerials(
	productId: string,
	params?: { limit?: number },
) {
	const search = new URLSearchParams();
	search.set('limit', String(params?.limit ?? 100));
	const envelope = (await request<TProductSerial[]>(
		`/products/${productId}/units?${search.toString()}`,
	)) as TApiPaginatedResponse<TProductSerial>;
	return envelope.data;
}

/**
 * Registers a serialized unit.
 *
 * @remarks
 * The endpoint requires a non-empty `serialNumber` (the backend zod contract
 * rejects an empty one even for `pre_order`), so the caller must supply it.
 */
export async function registerSerial(
	productId: string,
	input: {
		serialNumber: string;
		status?: TSerialStatus;
		assetTag?: string | null;
		notes?: string | null;
		acquiredOn?: string | null;
		warrantyExpiresOn?: string | null;
	},
) {
	const envelope = await request<TProductSerial>(
		`/products/${productId}/units`,
		{
			method: 'POST',
			body: JSON.stringify(input),
		},
	);
	return envelope.data;
}

/** Replaces a pre-ordered unit's provisional serial, exactly once. */
export async function replaceProvisionalSerial(
	productId: string,
	serialId: string,
	serialNumber: string,
) {
	const envelope = await request<TProductSerial>(
		`/products/${productId}/units/${serialId}`,
		{ method: 'PATCH', body: JSON.stringify({ serialNumber }) },
	);
	return envelope.data;
}

// Reusable query options.
export const productsQueryOptions = (params: {
	productKind?: TProductKind;
	search?: string;
	warehouseId?: string;
	productCategoryId?: string;
	/** Only products offered for new documents. */
	activeOnly?: boolean;
	status?: 'all' | 'active' | 'inactive';
	minPrice?: number;
	maxPrice?: number;
	minStock?: number;
	maxStock?: number;
	sortBy?: 'name' | 'code' | 'price';
	sortDir?: 'asc' | 'desc';
	page?: number;
	limit?: number;
}) =>
	queryOptions({
		queryKey: ['inventory', 'products', params] as const,
		// 24 is the list page size: a 3-column card grid with 8 rows.
		queryFn: () => listProducts({ ...params, limit: params.limit ?? 24 }),
	});

export function productQueryOptions(productId: string) {
	return queryOptions({
		queryKey: ['inventory', 'products', productId] as const,
		queryFn: () => getProduct(productId),
		retry: false,
	});
}

export function productSerialsQueryOptions(productId: string) {
	return queryOptions({
		queryKey: ['inventory', 'products', productId, 'serials'] as const,
		queryFn: () => listProductSerials(productId),
	});
}

/** Slider bounds of the list filters: highest selling price (minor units) and highest summed stock. */
export type TProductRanges = { maxSellingPrice: number; maxStock: number };

/** Fetches the filter slider bounds for one kind (or every kind). */
export const productRangesQueryOptions = (productKind?: TProductKind) =>
	queryOptions({
		queryKey: ['inventory', 'products', 'ranges', productKind ?? 'all'] as const,
		queryFn: async () => {
			const search = productKind ? `?productKind=${productKind}` : '';
			return (await request<TProductRanges>(`/products/ranges${search}`)).data;
		},
	});