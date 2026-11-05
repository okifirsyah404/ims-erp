import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the inventory item endpoints (`/items`).
 *
 * @remarks
 * Tenant scope is decided by the backend from the caller's membership, so
 * nothing here sends an `organizationId` for reads. `product:*` permissions
 * gate every call server-side; the UI only hides controls it knows will fail.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Item kinds, mirroring `ITEM_KINDS` in the backend schema. */
export const ITEM_KINDS = [
	'product',
	'component',
	'material',
	'tool',
	'service',
] as const;
export type TItemKind = (typeof ITEM_KINDS)[number];

/** Fixed unit list (ADR-0011); mirrors `ITEM_UNITS` in the backend schema; not to be confused with `TItemUnit`, a serialized unit. */
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

/** Unit statuses, mirroring `UNIT_STATUSES`. The stored value for "ready" is `in_stock`. */
export const UNIT_STATUSES = [
	'pre_order',
	'in_stock',
	'borrowed',
	'lost',
	'sold',
	'applied_warranty',
] as const;
export type TUnitStatus = (typeof UNIT_STATUSES)[number];

/** One item master row. `minStockQty` arrives as a decimal string. */
export type TItem = {
	id: string;
	organizationId: string | null;
	sku: string;
	name: string;
	description: string | null;
	itemKind: TItemKind;
	/** Item category (ADR-0011); resolve the name via `useItemCategoryNames`. */
	categoryId: string | null;
	brand: string | null;
	specification: string | null;
	/** Short-lived URL of the document photo (detail endpoint only). */
	imageUrl?: string | null;
	unitLabel: TItemUnitLabel;
	/** Inactive items are not offered for new documents. */
	isActive: boolean;
	isSerialized: boolean;
	isStockTracked: boolean;
	minStockQty: string;
	barcode: string | null;
	sellingPrice: number;
	purchasePrice: number;
	currencyCode: string;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
	/**
	 * Total `quantity_on_hand` for this item in the requested warehouse,
	 * summed over `stock_balances` bins. Present only when the list request
	 * carried `warehouseId` (decimal string, like the numeric column).
	 */
	quantityOnHand?: string | null;
};

/** One serialized unit. */
export type TItemUnit = {
	id: string;
	organizationId: string | null;
	itemId: string;
	serialNumber: string;
	isProvisionalSerial: boolean;
	assetTag: string | null;
	status: TUnitStatus;
	warehouseId: string | null;
	binId: string | null;
	acquiredOn: string | null;
	warrantyExpiresOn: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

/** Fields the create form submits. */
export type TItemCreateInput = {
	sku: string;
	name: string;
	itemKind: TItemKind;
	description?: string | null;
	categoryId?: string | null;
	brand?: string | null;
	specification?: string | null;
	unitLabel: TItemUnitLabel;
	isActive: boolean;
	isSerialized: boolean;
	isStockTracked: boolean;
	minStockQty: number;
	barcode?: string | null;
	sellingPrice: number;
	purchasePrice: number;
	currencyCode: string;
};

/** Fields the edit form submits. `sku`/`itemKind` are immutable. */
export type TItemUpdateInput = Partial<Omit<TItemCreateInput, 'sku' | 'itemKind'>>;

async function request<T>(
	path: string,
	init?: RequestInit,
): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers:
			init?.body != null ? { 'Content-Type': 'application/json' } : undefined,
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

/** Fetches one page of items, optionally filtered by kind. */
export async function listItems(params?: {
	page?: number;
	limit?: number;
	itemKind?: TItemKind;
	search?: string;
	categoryId?: string;
	/** Only items offered for new documents. */
	activeOnly?: boolean;
	/** Only items with at least one live unit in this warehouse. */
	warehouseId?: string;
	includeArchived?: boolean;
}) {
	const search = new URLSearchParams();
	if (params?.page) search.set('page', String(params.page));
	if (params?.limit) search.set('limit', String(params.limit));
	if (params?.itemKind) search.set('itemKind', params.itemKind);
	if (params?.search) search.set('search', params.search);
	if (params?.categoryId) search.set('categoryId', params.categoryId);
	if (params?.activeOnly) search.set('activeOnly', 'true');
	if (params?.warehouseId) search.set('warehouseId', params.warehouseId);
	if (params?.includeArchived) search.set('includeArchived', 'true');
	const query = search.toString();

	const envelope = (await request<TItem[]>(
		`/items${query ? `?${query}` : ''}`,
	)) as TApiPaginatedResponse<TItem>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one item. */
export async function getItem(itemId: string) {
	const envelope = await request<TItem>(`/items/${itemId}`);
	return envelope.data;
}

/** Creates an item. */
export async function createItem(input: TItemCreateInput) {
	const envelope = await request<TItem>('/items', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/** Updates an item's mutable fields. */
export async function updateItem(itemId: string, input: TItemUpdateInput) {
	const envelope = await request<TItem>(`/items/${itemId}`, {
		method: 'PATCH',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/** Archives an item (soft delete). */
export async function archiveItem(itemId: string) {
	await request(`/items/${itemId}`, { method: 'DELETE' });
}

/** Fetches one page of an item's units. */
export async function listItemUnits(itemId: string, params?: { limit?: number }) {
	const search = new URLSearchParams();
	search.set('limit', String(params?.limit ?? 100));
	const envelope = (await request<TItemUnit[]>(
		`/items/${itemId}/units?${search.toString()}`,
	)) as TApiPaginatedResponse<TItemUnit>;
	return envelope.data;
}

/** Registers a unit. An empty serial with `status: 'pre_order'` mints a provisional one. */
export async function registerUnit(
	itemId: string,
	input: {
		serialNumber?: string;
		status?: TUnitStatus;
		assetTag?: string | null;
		notes?: string | null;
		acquiredOn?: string | null;
		warrantyExpiresOn?: string | null;
	},
) {
	const envelope = await request<TItemUnit>(`/items/${itemId}/units`, {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/** Replaces a pre-ordered unit's provisional serial, exactly once. */
export async function replaceProvisionalSerial(
	itemId: string,
	unitId: string,
	serialNumber: string,
) {
	const envelope = await request<TItemUnit>(
		`/items/${itemId}/units/${unitId}`,
		{ method: 'PATCH', body: JSON.stringify({ serialNumber }) },
	);
	return envelope.data;
}

// Reusable query options.
export const itemsQueryOptions = (params: {
	itemKind?: TItemKind;
	search?: string;
	warehouseId?: string;
	page?: number;
	limit?: number;
}) =>
	queryOptions({
		queryKey: ['inventory', 'items', params] as const,
		queryFn: () =>
			listItems({ ...params, limit: params.limit ?? 100 }),
	});

export function itemQueryOptions(itemId: string) {
	return queryOptions({
		queryKey: ['inventory', 'items', itemId] as const,
		queryFn: () => getItem(itemId),
		retry: false,
	});
}

export function itemUnitsQueryOptions(itemId: string) {
	return queryOptions({
		queryKey: ['inventory', 'items', itemId, 'units'] as const,
		queryFn: () => listItemUnits(itemId),
	});
}
