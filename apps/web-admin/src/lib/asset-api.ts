import type {
	TApiPaginatedResponse,
	TApiResponse,
	TPaginationMeta,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the asset module endpoints (`/assets*`).
 *
 * @remarks
 * Tenant scope comes from the caller's active organization server-side.
 * `asset:*` permissions gate every call; the UI only hides controls it knows
 * will fail (D16).
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Asset lifecycle statuses, mirroring `ASSET_STATUSES` (D7). */
export const ASSET_STATUSES = [
	'ready',
	'borrowed',
	'maintenance',
	'inactive',
	'disposed',
	'lost',
] as const;
export type TAssetStatus = (typeof ASSET_STATUSES)[number];

/** Type codes come from the `assets.asset_types` lookup (D10). */
export type TAssetType = string;

/** One row of the asset-type lookup; `name` is the display label. */
export type TAssetTypeRow = {
	id: string;
	code: string;
	name: string;
	defaultUsefulLifeMonths: number | null;
	defaultDepreciationMethod: string;
	isActive: boolean;
};

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

/** One asset master row. Money arrives as integer minor units. */
export type TAsset = {
	id: string;
	organizationId: string;
	code: string;
	name: string;
	description: string | null;
	categoryId: string | null;
	assetType: TAssetType;
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
	/** Resolved storage warehouse name; `null` when unallocated or unknown. */
	warehouseName: string | null;
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

export type TAssetCategory = {
	id: string;
	organizationId: string;
	code: string;
	name: string;
	parentCategoryId: string | null;
	assetType: TAssetType;
	defaultUsefulLifeMonths: number | null;
	defaultDepreciationMethod: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

export type TAssetMovement = {
	id: string;
	assetId: string;
	movementType:
		| 'receipt'
		| 'transfer'
		| 'borrow_out'
		| 'borrow_return'
		| 'project_site'
		| 'disposal'
		| 'lost';
	fromLocation: string | null;
	toLocation: string | null;
	fromWarehouseId: string | null;
	fromStorageId: string | null;
	toWarehouseId: string | null;
	toStorageId: string | null;
	movedAt: string;
	condition: string | null;
	notes: string | null;
};

export type TAssetConditionCheck = {
	id: string;
	assetId: string;
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
	assetId: string;
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

export type TAssetDepreciation = {
	id: string;
	assetId: string;
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
	assetId: string;
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

export type TAssetDocument = {
	id: string;
	assetId: string;
	documentId: string;
	documentType: 'invoice' | 'manual' | 'certificate' | 'photo' | 'contract';
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
	assetId: string;
	quantity: string;
};

export type TAssetDetail = {
	asset: TAsset;
	history: {
		movements: TAssetMovement[];
		conditionChecks: TAssetConditionCheck[];
		maintenances: TAssetMaintenance[];
		depreciations: TAssetDepreciation[];
		documents: TAssetDocument[];
	};
};

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

/* ------------------------------- assets -------------------------------- */

export type TAssetListParams = {
	page: number;
	limit: number;
	search?: string;
	status?: TAssetStatus;
	assetType?: string;
	categoryId?: string;
	includeArchived?: boolean;
};

export function assetsQueryOptions(params: TAssetListParams) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.search) search.set('search', params.search);
	if (params.status) search.set('status', params.status);
	if (params.assetType) search.set('assetType', params.assetType);
	if (params.categoryId) search.set('categoryId', params.categoryId);
	if (params.includeArchived) search.set('includeArchived', 'true');
	return queryOptions({
		queryKey: ['assets', params],
		queryFn: () =>
			getDataPaginated<TAsset>(`/assets?${search.toString()}`),
	});
}

export function assetDetailQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['assets', 'detail', id],
		queryFn: () => getData<TAssetDetail>(`/assets/${id}`),
	});
}

export function createAsset(input: Record<string, unknown>) {
	return sendData<TAsset>('/assets', 'POST', input);
}

export function updateAsset(id: string, input: Record<string, unknown>) {
	return sendData<TAsset>(`/assets/${id}`, 'PATCH', input);
}

export function deactivateAsset(id: string, reason: string) {
	return sendData<TAsset>(`/assets/${id}/deactivate`, 'POST', { reason });
}

export function reactivateAsset(id: string) {
	return sendData<TAsset>(`/assets/${id}/reactivate`, 'POST');
}

export function archiveAsset(id: string) {
	return sendData<void>(`/assets/${id}`, 'DELETE');
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
			getDataPaginated<TAssetCategory>(`/asset-categories?${search.toString()}`),
	});
}

export function createAssetCategory(input: Record<string, unknown>) {
	return sendData<TAssetCategory>('/asset-categories', 'POST', input);
}

export function updateAssetCategory(id: string, input: Record<string, unknown>) {
	return sendData<TAssetCategory>(`/asset-categories/${id}`, 'PATCH', input);
}

export function archiveAssetCategory(id: string) {
	return sendData<void>(`/asset-categories/${id}`, 'DELETE');
}

/* ----------------------------- asset types ----------------------------- */

/** Active asset types (global lookup). */
export function assetTypesQueryOptions() {
	return queryOptions({
		queryKey: ['asset-types'],
		queryFn: () => getData<TAssetTypeRow[]>('/assets/types'),
	});
}

/* ------------------------------- custody ------------------------------- */

/* removed: custody is borrowing-owned since ERP-0036 (D12). */

/* ------------------------------ location ------------------------------- */

/** Places a ready asset into a warehouse storage (receipt movement). */
export function placeAsset(
	assetId: string,
	input: {
		warehouseId: string;
		storageId?: string | null;
		locationDescription?: string | null;
	},
) {
	return sendData<TAssetMovement>(`/assets/${assetId}/place`, 'POST', input);
}

/** Moves a ready asset to another storage, clearing the source. */
export function transferAsset(
	assetId: string,
	input: {
		toWarehouseId: string;
		toStorageId?: string | null;
		notes?: string | null;
	},
) {
	return sendData<TAssetMovement>(`/assets/${assetId}/transfer`, 'POST', input);
}

/* ------------------------------ movements ------------------------------ */

export function moveAsset(
	assetId: string,
	input: { movementType: string; toLocation?: string | null; notes?: string | null },
) {
	return sendData<TAssetMovement>(`/assets/${assetId}/movements`, 'POST', input);
}

/* --------------------------- condition checks --------------------------- */

export function recordConditionCheck(
	assetId: string,
	input: { checkDate: string; condition: string; findings?: string | null },
) {
	return sendData<TAssetConditionCheck>(
		`/assets/${assetId}/condition-checks`,
		'POST',
		input,
	);
}

/* ----------------------------- maintenances ---------------------------- */

export function logMaintenance(
	assetId: string,
	input: Record<string, unknown>,
) {
	return sendData<TAssetMaintenance>(`/assets/${assetId}/maintenances`, 'POST', input);
}

export function maintenancesQueryOptions(params: {
	page: number;
	limit: number;
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	return queryOptions({
		queryKey: ['asset-maintenances', params],
		// Organization-wide maintenance listing rides the asset's own route;
		// the dedicated page reuses the first page of each active asset. For
		// now the service-records page lists per-asset history lazily.
		queryFn: () =>
			getDataPaginated<TAssetMaintenance>(`/assets?${search.toString()}`),
		enabled: false,
	});
}

/* ----------------------------- depreciations --------------------------- */

export function recordDepreciation(
	assetId: string,
	input: { periodYear: number; periodMonth: number; depreciationAmount: number },
) {
	return sendData<TAssetDepreciation>(`/assets/${assetId}/depreciations`, 'POST', input);
}

/* ------------------------------- disposals ----------------------------- */

export function requestDisposal(
	assetId: string,
	input: Record<string, unknown>,
) {
	return sendData<TAssetDisposal>(`/assets/${assetId}/disposals`, 'POST', input);
}

export function disposalsQueryOptions(params: { page: number; limit: number }) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	return queryOptions({
		queryKey: ['asset-disposals', params],
		queryFn: () =>
			getDataPaginated<TAssetDisposal>(`/assets/disposals?${search.toString()}`),
	});
}

export function approveDisposal(disposalId: string) {
	return sendData<TAssetDisposal>(`/assets/disposals/${disposalId}/approve`, 'POST');
}

export function executeDisposal(disposalId: string) {
	return sendData<TAssetDisposal>(`/assets/disposals/${disposalId}/execute`, 'POST');
}

export function cancelDisposal(disposalId: string) {
	return sendData<TAssetDisposal>(`/assets/disposals/${disposalId}/cancel`, 'POST');
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
			getDataPaginated<TToolSet>(`/assets/tool-sets?${search.toString()}`),
	});
}

export function toolSetDetailQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['asset-tool-sets', 'detail', id],
		queryFn: () =>
			getData<TToolSet & { items: TToolSetItem[] }>(`/assets/tool-sets/${id}`),
	});
}

export function createToolSet(input: { name: string; description?: string | null }) {
	return sendData<TToolSet>('/assets/tool-sets', 'POST', input);
}

export function addToolSetItem(toolSetId: string, assetId: string) {
	return sendData<TToolSetItem>(`/assets/tool-sets/${toolSetId}/items`, 'POST', {
		assetId,
	});
}

export function removeToolSetItem(toolSetId: string, itemId: string) {
	return sendData<void>(`/assets/tool-sets/${toolSetId}/items/${itemId}`, 'DELETE');
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
