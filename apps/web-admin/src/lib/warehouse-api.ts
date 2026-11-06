import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the warehouse endpoints (`/warehouses`).
 *
 * @remarks
 * Every warehouse call is **application-admin-only**: the backend gates them
 * with `sessionGuard` + `requireGlobalAdmin`, and no organization role holds
 * any `warehouse:*` permission (ADR-0008). A non-admin gets 403 on reads too,
 * not an empty list.
 *
 * Nothing here sends an organization id on reads; write scope is decided by
 * `organizationId` on the create body, where **omitted means global**.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** One warehouse. `organizationId === null` means global/company-wide. */
export type TWarehouse = {
	id: string;
	organizationId: string | null;
	code: string;
	name: string;
	responsibleEmployeeId: string | null;
	isDefault: boolean;
	isActive: boolean;
	/** Optional display image URL for the warehouse card. */
	imageUrl: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

/** The warehouse's 1:1 address. Only `villageId` links to location data. */
export type TWarehouseAddress = {
	id: string;
	warehouseId: string;
	label: string | null;
	street: string;
	rt: string | null;
	rw: string | null;
	postalCode: string | null;
	villageId: string | null;
	latitude: string | null;
	longitude: string | null;
};

/** One storage (bin) inside a warehouse. No zone level. */
export type TWarehouseStorage = {
	id: string;
	warehouseId: string;
	code: string;
	name: string | null;
	binType: string | null;
	capacity: string | null;
	isActive: boolean;
	deletedAt: string | null;
};

/** A list-page warehouse row decorated with backend kind counts. */
export type TWarehouseWithCounts = TWarehouse & {
	productsCount: number;
	materialsCount: number;
	equipmentsCount: number;
	storagesCount: number;
};

/** A warehouse with its address and bins, as returned by `GET /warehouses/:id`. */
export type TWarehouseDetail = TWarehouse &
	TWarehouseWithCounts & {
		address: TWarehouseAddress | null;
		storages: TWarehouseStorage[];
	};

/** Address fields the form submits. */
export type TWarehouseAddressInput = {
	label?: string | null;
	street: string;
	rt?: string | null;
	rw?: string | null;
	postalCode?: string | null;
	villageId?: string | null;
	latitude?: number | null;
	longitude?: number | null;
};

/** Fields the create form submits. */
export type TWarehouseCreateInput = {
	/** Omit (or `null`) for a global warehouse. */
	organizationId?: string | null;
	code: string;
	name: string;
	responsibleEmployeeId?: string | null;
	isDefault: boolean;
	isActive: boolean;
	/** Optional display image URL for the warehouse card. */
	imageUrl?: string | null;
	address?: TWarehouseAddressInput;
};

/** Fields the edit form submits. `code` and `organizationId` are immutable. */
export type TWarehouseUpdateInput = {
	name?: string;
	responsibleEmployeeId?: string | null;
	isDefault?: boolean;
	isActive?: boolean;
	/** Optional display image URL for the warehouse card. */
	imageUrl?: string | null;
};

/**
 * One warehouse↔organization link, as returned by the admin endpoints
 * (ERP-0031).
 */
export type TWarehouseOrganizationLink = {
	organizationId: string;
	createdAt: string;
};

/**
 * Lists the organizations linked to a warehouse.
 *
 * Application-admin-only (`requireGlobalAdmin`), like every other warehouse
 * write/read in this module.
 */
export async function listWarehouseOrganizations(warehouseId: string) {
	const envelope = await request<TWarehouseOrganizationLink[]>(
		`/warehouses/${warehouseId}/organizations`,
	);
	return envelope.data ?? [];
}

/**
 * Grants an organization access to a warehouse (idempotent).
 *
 * @returns `created: true` when a new link was made, `false` on a retry.
 */
export async function linkWarehouseOrganization(
	warehouseId: string,
	organizationId: string,
) {
	const envelope = await request<{ created: boolean }>(
		`/warehouses/${warehouseId}/organizations`,
		{ method: 'POST', body: JSON.stringify({ organizationId }) },
	);
	if (!envelope.data) throw new Error('Empty response');
	return envelope.data;
}

/**
 * Revokes an organization's access to a warehouse.
 *
 * @throws Error carrying the backend message — a 409 (open borrowings) is
 *   surfaced to the caller so the UI can show the conflict.
 */
export async function unlinkWarehouseOrganization(
	warehouseId: string,
	organizationId: string,
) {
	const envelope = await request<{ removed: boolean }>(
		`/warehouses/${warehouseId}/organizations/${organizationId}`,
		{ method: 'DELETE' },
	);
	if (!envelope.data) throw new Error('Empty response');
	return envelope.data;
}

/** A warehouse linked to the caller's organization, with its bins (ERP-0031). */
export type TWarehouseLinked = TWarehouse & {
	storages: TWarehouseStorage[];
};

/**
 * Lists warehouses linked to the caller's active organization.
 *
 * Organization-scoped (not admin-only): mounted on the `erp` guard and
 * returns only the caller's own links. This is the picker source for
 * member-facing flows (asset place/transfer, stock operations) — the admin
 * warehouse list is not readable by organization roles.
 */
export async function listLinkedWarehouses() {
	const envelope = await request<TWarehouseLinked[]>('/warehouses/linked');
	return envelope.data ?? [];
}

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
	let envelope: TApiResponse<T>;
	try {
		envelope = (await response.json()) as TApiResponse<T>;
	} catch {
		// Empty or non-JSON body (e.g. a bare 404/500 from the server) — surface
		// the status instead of a cryptic JSON.parse error.
		throw new Error(`HTTP ${response.status}`);
	}
	if (!response.ok) {
		throw new Error(
			envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed',
		);
	}
	return envelope;
}

/** Fetches one page of warehouses. */
export async function listWarehouses(params?: {
	page?: number;
	limit?: number;
	search?: string;
	/** `'global'` selects `organization_id IS NULL`; omit for every scope. */
	scope?: string;
	includeArchived?: boolean;
	isActive?: boolean;
}) {
	const search = new URLSearchParams();
	if (params?.page) search.set('page', String(params.page));
	if (params?.limit) search.set('limit', String(params.limit));
	if (params?.search) search.set('search', params.search);
	if (params?.scope) search.set('scope', params.scope);
	if (params?.includeArchived) search.set('includeArchived', 'true');
	if (params?.isActive !== undefined) {
		search.set('isActive', String(params.isActive));
	}
	const query = search.toString();

	const envelope = (await request<TWarehouseWithCounts[]>(
		`/warehouses${query ? `?${query}` : ''}`,
	)) as TApiPaginatedResponse<TWarehouseWithCounts>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one warehouse with its address and storages. */
export async function getWarehouse(warehouseId: string) {
	const envelope = await request<TWarehouseDetail>(`/warehouses/${warehouseId}`);
	return envelope.data;
}

/** Creates a warehouse, optionally with its address in the same transaction. */
export async function createWarehouse(input: TWarehouseCreateInput) {
	const envelope = await request<TWarehouseDetail>('/warehouses', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/** Updates a warehouse's mutable fields. */
export async function updateWarehouse(
	warehouseId: string,
	input: TWarehouseUpdateInput,
) {
	const envelope = await request<TWarehouseDetail>(`/warehouses/${warehouseId}`, {
		method: 'PATCH',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/**
 * Archives a warehouse (soft delete).
 *
 * @returns The archived row.
 */
export async function archiveWarehouse(warehouseId: string) {
	const envelope = await request<TWarehouse>(`/warehouses/${warehouseId}`, {
		method: 'DELETE',
	});
	return envelope.data;
}

/** Creates or replaces the warehouse's address (strict 1:1, so `PUT`). */
export async function upsertWarehouseAddress(
	warehouseId: string,
	input: TWarehouseAddressInput,
) {
	const envelope = await request<TWarehouseAddress>(
		`/warehouses/${warehouseId}/address`,
		{ method: 'PUT', body: JSON.stringify(input) },
	);
	return envelope.data;
}

/** Adds a storage (bin) to a warehouse. */
export async function createStorage(
	warehouseId: string,
	input: {
		code: string;
		name?: string | null;
		binType?: string | null;
		/** Decimal string, matching the `numeric(18,3)` column. */
		capacity?: string | null;
		isActive?: boolean;
	},
) {
	const envelope = await request<TWarehouseStorage>(
		`/warehouses/${warehouseId}/storages`,
		{ method: 'POST', body: JSON.stringify(input) },
	);
	return envelope.data;
}

/**
 * Archives a storage.
 *
 * @returns The archived row.
 */
export async function archiveStorage(warehouseId: string, storageId: string) {
	const envelope = await request<TWarehouseStorage>(
		`/warehouses/${warehouseId}/storages/${storageId}`,
		{ method: 'DELETE' },
	);
	return envelope.data;
}

/** Fields the storage edit form submits. `code` is immutable. */
export type TWarehouseStorageUpdateInput = {
	name?: string | null;
	binType?: string | null;
	capacity?: string | null;
	isActive?: boolean;
};

/**
 * Updates a storage's mutable fields.
 *
 * @returns The updated row.
 */
export async function updateStorage(
	warehouseId: string,
	storageId: string,
	input: TWarehouseStorageUpdateInput,
) {
	const envelope = await request<TWarehouseStorage>(
		`/warehouses/${warehouseId}/storages/${storageId}`,
		{ method: 'PATCH', body: JSON.stringify(input) },
	);
	return envelope.data;
}

/** Query options for the warehouse list. */
export const warehousesQueryOptions = (
	params: Parameters<typeof listWarehouses>[0] = {},
) =>
	queryOptions({
		queryKey: ['warehouses', params],
		queryFn: () => listWarehouses(params),
	});

/** Query options for one warehouse. */
export const warehouseQueryOptions = (warehouseId: string) =>
	queryOptions({
		queryKey: ['warehouses', warehouseId],
		queryFn: () => getWarehouse(warehouseId),
	});

/** Query options for a warehouse's organization links (admin). */
export const warehouseOrganizationsQueryOptions = (warehouseId: string) =>
	queryOptions({
		queryKey: ['warehouses', warehouseId, 'organizations'],
		queryFn: () => listWarehouseOrganizations(warehouseId),
	});

/** Query options for the caller's linked warehouses (org-scoped). */
export const linkedWarehousesQueryOptions = () =>
	queryOptions({
		queryKey: ['warehouses', 'linked'],
		queryFn: () => listLinkedWarehouses(),
	});
