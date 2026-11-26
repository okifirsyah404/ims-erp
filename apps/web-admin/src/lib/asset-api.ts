import type {
	TApiPaginatedResponse,
	TApiResponse,
	TPaginationMeta,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the asset register: physical tool/asset units owned by the
 * inventory module (`/inventory/items*`, `/inventory/item-categories*`,
 * `/inventory/tool-sets*`, `/inventory/disposals*`) plus the finance-owned
 * depreciation log (`/finance/depreciations`).
 *
 * @remarks
 * Tenant scope comes from the caller's active organization server-side.
 * `asset:*` permissions gate every call; the UI only hides controls it knows
 * will fail (D16). The wrappers are hand-written and untyped against the
 * backend, so every shape below mirrors `inventory.schema.ts` /
 * `finance.schema.ts` and the zod contracts under
 * `apps/backend/src/app/inventory/contracts` (ADR-0024).
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Item lifecycle statuses, mirroring `ITEM_STATUSES`. */
export const ASSET_STATUSES = [
	'ready',
	'borrowed',
	'maintenance',
	'inactive',
	'disposed',
	'lost',
] as const;
export type TAssetStatus = (typeof ASSET_STATUSES)[number];

/**
 * Item kinds, mirroring `ITEM_KINDS`. They replace the old
 * `assets.asset_types` lookup: a closed vocabulary instead of a table.
 */
export const ITEM_KINDS = [
	'equipment',
	'vehicle',
	'tool',
	'furniture',
	'it',
	'intangible',
] as const;
export type TItemKind = (typeof ITEM_KINDS)[number];

export const ASSET_CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged'] as const;
export type TAssetCondition = (typeof ASSET_CONDITIONS)[number];

export const DISPOSAL_METHODS = ['sale', 'scrap', 'donation', 'transfer', 'trade_in'] as const;
export type TDisposalMethod = (typeof DISPOSAL_METHODS)[number];

export const DISPOSAL_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'executed',
	'cancelled',
] as const;
export type TDisposalStatus = (typeof DISPOSAL_STATUSES)[number];

/** Category-level default depreciation rule (backend `DEPRECIATION_METHODS`). */
export const DEPRECIATION_METHODS = [
	'straight_line',
	'declining_balance',
	'none',
] as const;
export type TDepreciationMethod = (typeof DEPRECIATION_METHODS)[number];

/** One item row as `GET /inventory/items/:id/history` returns it. Money is integer minor units. */
export type TAssetCore = {
	id: string;
	organizationId: string;
	code: string;
	name: string;
	description: string | null;
	itemKind: TItemKind;
	itemCategoryId: string | null;
	serialNumber: string | null;
	barcode: string | null;
	acquisitionDate: string | null;
	acquisitionCost: number;
	salvageValue: number;
	accumulatedDepreciation: number;
	bookValue: number;
	currencyCode: string;
	usefulLifeMonths: number | null;
	depreciationMethod: string;
	depreciationStartedOn: string | null;
	condition: TAssetCondition;
	status: TAssetStatus;
	/** Optional display image URL for the asset card. */
	imageUrl: string | null;
	deactivationReason: string | null;
	locationDescription: string | null;
	warehouseId: string | null;
	storageId: string | null;
	custodianEmployeeId: string | null;
	borrowedSince: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

/** One item row of the list endpoint, decorated with its warehouse name. */
export type TAsset = TAssetCore & {
	/** Resolved storage warehouse name; `null` when unallocated or unknown. */
	warehouseName: string | null;
};

export type TAssetCategory = {
	id: string;
	organizationId: string;
	code: string;
	name: string;
	parentCategoryId: string | null;
	itemKind: TItemKind;
	defaultUsefulLifeMonths: number | null;
	defaultDepreciationMethod: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

/** One row of the item movement trail (`inventory.movements`, item rows only). */
export type TAssetMovement = {
	id: string;
	itemId: string;
	movementType:
		| 'receipt'
		| 'transfer_in'
		| 'transfer_out'
		| 'borrow_out'
		| 'borrow_return'
		| 'project_site'
		| 'disposal'
		| 'lost';
	fromLocation: string | null;
	toLocation: string | null;
	warehouseId: string | null;
	binId: string | null;
	targetWarehouseId: string | null;
	targetBinId: string | null;
	occurredAt: string;
	notes: string | null;
};

export type TAssetConditionCheck = {
	id: string;
	itemId: string;
	checkDate: string;
	condition: TAssetCondition;
	findings: string | null;
	nextCheckDate: string | null;
	status: 'recorded' | 'followed_up' | 'closed';
};

export type TAssetMaintenance = {
	id: string;
	organizationId: string;
	code: string;
	itemId: string;
	maintenanceType: 'preventive' | 'corrective' | 'calibration' | 'inspection';
	scheduledDate: string | null;
	performedDate: string | null;
	vendorName: string | null;
	cost: number;
	currencyCode: string;
	description: string | null;
	status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
	nextServiceDate: string | null;
};

/** One `finance.asset_depreciations` row. */
export type TAssetDepreciation = {
	id: string;
	itemId: string | null;
	periodYear: number;
	periodMonth: number;
	depreciationMethod: string;
	depreciationAmount: number;
	openingBookValue: number;
	closingBookValue: number;
	currencyCode: string;
	calculatedAt: string | null;
};

export type TAssetDisposal = {
	id: string;
	organizationId: string;
	code: string;
	itemId: string;
	disposalDate: string | null;
	disposalMethod: TDisposalMethod;
	proceedsAmount: number;
	bookValueAtDisposal: number;
	gainLoss: number;
	currencyCode: string;
	buyerName: string | null;
	status: TDisposalStatus;
	requestedBy: string | null;
	approvedBy: string | null;
	approvedAt: string | null;
	executedAt: string | null;
};

/** A stored item document; `url` is a short-lived signed download link. */
export type TAssetDocument = {
	id: string;
	itemId: string | null;
	documentType: 'photo' | 'manual' | 'datasheet' | 'certificate' | 'invoice' | 'contract';
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	url: string;
	createdAt: string;
};

export type TToolSet = {
	id: string;
	organizationId: string;
	code: string;
	name: string;
	description: string | null;
	custodianEmployeeId: string | null;
	status: 'available' | 'lent' | 'maintenance' | 'retired';
};

export type TToolSetItem = {
	id: string;
	toolSetId: string;
	itemId: string;
	quantity: string;
};

/** `GET /inventory/items/:id/history`; `null` when the unit is unknown to the tenant. */
export type TAssetDetail = {
	item: TAssetCore;
	history: {
		movements: TAssetMovement[];
		conditionChecks: TAssetConditionCheck[];
		maintenances: TAssetMaintenance[];
		documents: TAssetDocument[];
	};
} | null;

type ListMeta = TPaginationMeta;
type TPaginated<T> = { rows: T[]; pagination: TPaginationMeta };

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

async function getData<T>(path: string): Promise<T> {
	const envelope = await request<T>(path);
	return envelope.data as T;
}

async function sendData<T>(
	path: string,
	method: 'POST' | 'PATCH' | 'DELETE',
	body?: unknown,
): Promise<T> {
	const envelope = await request<T>(path, {
		method,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	return envelope.data as T;
}

async function getDataPaginated<T>(path: string): Promise<TPaginated<T>> {
	const envelope = (await request<T[]>(path)) as TApiPaginatedResponse<T>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/* ------------------------------- items --------------------------------- */

export type TAssetListParams = {
	page: number;
	limit: number;
	search?: string;
	status?: TAssetStatus;
	itemKind?: string;
	itemCategoryId?: string;
	includeArchived?: boolean;
};

/** Fields accepted when registering an item (`createItemSchema`). */
export type TAssetCreateInput = {
	name: string;
	description?: string | null;
	itemCategoryId?: string | null;
	itemKind?: TItemKind;
	serialNumber?: string | null;
	barcode?: string | null;
	acquisitionDate?: string | null;
	acquisitionCost?: number;
	locationDescription?: string | null;
};

/** Fields accepted when editing an item (`updateItemSchema`): the kind is immutable. */
export type TAssetUpdateInput = Partial<Omit<TAssetCreateInput, 'itemKind'>>;

export function assetsQueryOptions(params: TAssetListParams) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.search) search.set('search', params.search);
	if (params.status) search.set('status', params.status);
	if (params.itemKind) search.set('itemKind', params.itemKind);
	if (params.itemCategoryId) search.set('itemCategoryId', params.itemCategoryId);
	if (params.includeArchived) search.set('includeArchived', 'true');
	return queryOptions({
		queryKey: ['assets', params],
		queryFn: () =>
			getDataPaginated<TAsset>(`/inventory/items?${search.toString()}`),
	});
}

export function assetDetailQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['assets', 'detail', id],
		queryFn: () => getData<TAssetDetail>(`/inventory/items/${id}/history`),
	});
}

export function createAsset(input: TAssetCreateInput) {
	return sendData<TAssetCore>('/inventory/items', 'POST', input);
}

export function updateAsset(id: string, input: TAssetUpdateInput) {
	return sendData<TAssetCore>(`/inventory/items/${id}`, 'PATCH', input);
}

export function deactivateAsset(id: string, reason: string) {
	return sendData<TAssetCore>(`/inventory/items/${id}/deactivate`, 'POST', {
		reason,
	});
}

export function reactivateAsset(id: string) {
	return sendData<TAssetCore>(`/inventory/items/${id}/reactivate`, 'POST');
}

export function archiveAsset(id: string) {
	return sendData<void>(`/inventory/items/${id}`, 'DELETE');
}

/* ----------------------------- categories ------------------------------ */

export function assetCategoriesQueryOptions(params: {
	page: number;
	limit: number;
	search?: string;
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.search) search.set('search', params.search);
	return queryOptions({
		queryKey: ['asset-categories', params],
		queryFn: () =>
			getDataPaginated<TAssetCategory>(
				`/inventory/item-categories?${search.toString()}`,
			),
	});
}

export function createAssetCategory(input: {
	code: string;
	name: string;
	itemKind?: TItemKind;
	parentCategoryId?: string | null;
	defaultUsefulLifeMonths?: number | null;
	defaultDepreciationMethod?: TDepreciationMethod;
}) {
	return sendData<TAssetCategory>('/inventory/item-categories', 'POST', input);
}

export function updateAssetCategory(
	id: string,
	input: Partial<{
		name: string;
		parentCategoryId: string | null;
		itemKind: TItemKind;
		defaultUsefulLifeMonths: number | null;
		defaultDepreciationMethod: TDepreciationMethod;
		isActive: boolean;
	}>,
) {
	return sendData<TAssetCategory>(`/inventory/item-categories/${id}`, 'PATCH', input);
}

export function archiveAssetCategory(id: string) {
	return sendData<void>(`/inventory/item-categories/${id}`, 'DELETE');
}

/* ------------------------------ location ------------------------------- */

/** Places a ready item into a warehouse storage (receipt movement). */
export function placeAsset(
	itemId: string,
	input: {
		warehouseId: string;
		storageId?: string | null;
		locationDescription?: string | null;
	},
) {
	return sendData<TAssetMovement>(`/inventory/items/${itemId}/place`, 'POST', input);
}

/** Moves a ready item to another storage, clearing the source. */
export function transferAsset(
	itemId: string,
	input: {
		toWarehouseId: string;
		toStorageId?: string | null;
		notes?: string | null;
	},
) {
	return sendData<TAssetMovement>(
		`/inventory/items/${itemId}/transfer`,
		'POST',
		input,
	);
}

/* ------------------------------ movements ------------------------------ */

/** Records an off-site move; the backend only accepts `project_site`. */
export function moveAsset(
	itemId: string,
	input: {
		movementType: 'project_site';
		fromLocation?: string | null;
		toLocation?: string | null;
		notes?: string | null;
	},
) {
	return sendData<TAssetMovement>(`/inventory/items/${itemId}/movements`, 'POST', input);
}

/* --------------------------- condition checks --------------------------- */

export function recordConditionCheck(
	itemId: string,
	input: {
		checkDate: string;
		condition: TAssetCondition;
		findings?: string | null;
		nextCheckDate?: string | null;
	},
) {
	return sendData<TAssetConditionCheck>(
		`/inventory/items/${itemId}/condition-checks`,
		'POST',
		input,
	);
}

/* ----------------------------- maintenances ---------------------------- */

export function logMaintenance(
	itemId: string,
	input: {
		maintenanceType?: TAssetMaintenance['maintenanceType'];
		scheduledDate?: string | null;
		performedDate?: string | null;
		vendorName?: string | null;
		cost?: number;
		description?: string | null;
		status?: TAssetMaintenance['status'];
		nextServiceDate?: string | null;
	},
) {
	return sendData<TAssetMaintenance>(
		`/inventory/items/${itemId}/maintenances`,
		'POST',
		input,
	);
}

/* ----------------------------- depreciations --------------------------- */

/** Depreciation entries of one item (finance-owned, newest period first). */
export function assetDepreciationsQueryOptions(itemId: string) {
	const search = new URLSearchParams({ itemId, page: '1', limit: '20' });
	return queryOptions({
		queryKey: ['asset-depreciations', itemId],
		queryFn: () =>
			getDataPaginated<TAssetDepreciation>(
				`/finance/depreciations?${search.toString()}`,
			),
	});
}

/** Records one period's entry; idempotent per item and period (D14). */
export function recordDepreciation(
	itemId: string,
	input: { periodYear: number; periodMonth: number; depreciationAmount: number },
) {
	return sendData<TAssetDepreciation>('/finance/depreciations', 'POST', {
		itemId,
		...input,
	});
}

/* ------------------------------- disposals ----------------------------- */

export function requestDisposal(
	itemId: string,
	input: {
		disposalDate?: string | null;
		disposalMethod?: TDisposalMethod;
		proceedsAmount?: number;
		buyerName?: string | null;
	},
) {
	return sendData<TAssetDisposal>(`/inventory/items/${itemId}/disposals`, 'POST', input);
}

export function disposalsQueryOptions(params: { page: number; limit: number }) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	return queryOptions({
		queryKey: ['asset-disposals', params],
		queryFn: () =>
			getDataPaginated<TAssetDisposal>(`/inventory/disposals?${search.toString()}`),
	});
}

export function approveDisposal(disposalId: string) {
	return sendData<TAssetDisposal>(`/inventory/disposals/${disposalId}/approve`, 'POST');
}

export function executeDisposal(disposalId: string) {
	return sendData<TAssetDisposal>(`/inventory/disposals/${disposalId}/execute`, 'POST');
}

export function cancelDisposal(disposalId: string) {
	return sendData<TAssetDisposal>(`/inventory/disposals/${disposalId}/cancel`, 'POST');
}

/* ------------------------------- tool sets ----------------------------- */

export function toolSetsQueryOptions(params: { page: number; limit: number }) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	return queryOptions({
		queryKey: ['asset-tool-sets', params],
		queryFn: () =>
			getDataPaginated<TToolSet>(`/inventory/tool-sets?${search.toString()}`),
	});
}

export function toolSetDetailQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['asset-tool-sets', 'detail', id],
		queryFn: () =>
			getData<TToolSet & { items: TToolSetItem[] }>(`/inventory/tool-sets/${id}`),
	});
}

export function createToolSet(input: { name: string; description?: string | null }) {
	return sendData<TToolSet>('/inventory/tool-sets', 'POST', input);
}

export function addToolSetItem(toolSetId: string, itemId: string) {
	return sendData<TToolSetItem>(`/inventory/tool-sets/${toolSetId}/items`, 'POST', {
		itemId,
	});
}

/** Removes one tool-set row (`rowId` is the `tool_set_items.id`, not the item id). */
export function removeToolSetItem(toolSetId: string, rowId: string) {
	return sendData<void>(`/inventory/tool-sets/${toolSetId}/items/${rowId}`, 'DELETE');
}

/** Formats an integer minor-unit amount for display. */
export function formatMoney(amount: number, currencyCode = 'IDR'): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: currencyCode,
		maximumFractionDigits: 0,
	}).format(amount);
}

export type { ListMeta };
