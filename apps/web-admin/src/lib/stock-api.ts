import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { networkError, readEnvelope } from '@/lib/api-error';

/**
 * API client for the stock ledger and balance endpoints (`/stock/*`).
 *
 * @remarks
 * **Scope is never sent for writes.** The backend records the caller's
 * organization as the acting tenant and decides which balance moves from the
 * **warehouse** (plan D17 / data-model "scope rule"): an organization warehouse
 * keeps per-organization balances, a global warehouse has one shared row. A
 * client therefore cannot choose a scope, only narrow a read.
 *
 * Reads accept `scope=global` to select the shared rows (`organization_id IS
 * NULL`) — the one cross-tenant read that is legitimate, because a global
 * warehouse is one shared physical space.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * A movement's direction is a property of its type; the quantity is unsigned.
 *
 * @remarks
 * Mirrors `MOVEMENT_TYPES` in the backend schema. The last five types only ever
 * concern a physical item (asset) and never appear in the product stock ledger;
 * they are kept so a row of any type still has a label.
 */
export const MOVEMENT_TYPES = [
	'receipt',
	'issue',
	'transfer_in',
	'transfer_out',
	'adjustment_in',
	'adjustment_out',
	'return_in',
	'return_out',
	'consumption',
	'borrow_out',
	'borrow_return',
	'project_site',
	'disposal',
	'lost',
] as const;
export type TMovementType = (typeof MOVEMENT_TYPES)[number];

/** Movement types that decrease stock. Mirrors `isOutbound` on the backend. */
export const OUTBOUND_MOVEMENT_TYPES: ReadonlySet<TMovementType> = new Set([
	'issue',
	'transfer_out',
	'adjustment_out',
	'return_out',
	'consumption',
]);

/** One stock movement (an append-only ledger row). */
export type TStockMovement = {
	id: string;
	organizationId: string | null;
	code: string;
	movementType: TMovementType;
	productId: string;
	/** Resolved product name; `null` when archived or unknown. */
	itemName: string | null;
	/** Product photo URL; `null` when the product has no photo. */
	imageUrl?: string | null;
	warehouseId: string;
	/** Resolved warehouse name; `null` when archived or unknown. */
	warehouseName: string | null;
	binId: string | null;
	targetWarehouseId: string | null;
	/** IDR minor units; absent for callers without `product:read_cost`. */
	unitCost?: number;
	/** Unsigned; direction comes from `movementType`. */
	quantity: string;
	referenceType: string | null;
	referenceId: string | null;
	status: 'draft' | 'posted' | 'reversed';
	occurredAt: string;
	notes: string | null;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string | null;
};

/** One balance projection row. `organizationId === null` means shared. */
export type TStockBalance = {
	id: string;
	organizationId: string | null;
	productId: string;
	/** Resolved product name; `null` when archived or unknown. */
	itemName: string | null;
	/** Product photo URL; `null` when the product has no photo. */
	imageUrl?: string | null;
	warehouseId: string;
	/** Resolved warehouse name; `null` when archived or unknown. */
	warehouseName: string | null;
	binId: string | null;
	quantityOnHand: string;
	quantityReserved: string;
	quantityAvailable: string;
	/** Moving-average cost, IDR minor units; absent without `product:read_cost`. */
	averageCost?: number;
	/** `quantityOnHand` valued at cost; absent without `product:read_cost`. */
	totalValue?: number;
	lastMovementAt: string | null;
	createdAt: string;
	updatedAt: string | null;
};

/** The result of posting a movement: the ledger row and the balance it moved. */
export type TStockPostResult = {
	movement: TStockMovement;
	balance: TStockBalance;
	scopeOrganizationId: string | null;
};

/** Fields a receipt or issue submits. */
export type TStockMovementInput = {
	warehouseId: string;
	binId?: string | null;
	productId: string;
	/** Positive; the endpoint decides the direction. */
	quantity: number;
	occurredAt?: string;
	referenceType?: string | null;
	referenceId?: string | null;
	notes?: string | null;
	/** B-29: the project the stock is for (shown on the movement, counted as project material). */
	projectId?: string | null;
	/** B-29: one serial per unit for a serialized item. */
	serialNumbers?: string[];
};

/** An active project the manual stock screens can name (B-29). */
export type TStockProjectOption = { id: string; code: string; title: string; customerName: string };

/** Filter for the movement ledger. */
export type TMovementListParams = {
	page?: number;
	limit?: number;
	/** `'global'` selects the shared rows; omit for the caller's scope. */
	scope?: string;
	warehouseId?: string;
	productId?: string;
	movementType?: TMovementType;
	status?: 'draft' | 'posted' | 'reversed';
	referenceType?: string;
};

/** Filter for the balance list. */
export type TBalanceListParams = {
	page?: number;
	limit?: number;
	scope?: string;
	warehouseId?: string;
	productId?: string;
	binId?: string;
	inStockOnly?: boolean;
};

/** Failures throw `ApiError` (field errors, server reference; P7-6). */
async function request<T>(
	path: string,
	init?: RequestInit,
): Promise<TApiResponse<T>> {
	let response: Response;
	try {
		response = await fetch(`${API_URL}${path}`, {
			credentials: 'include',
			headers: {
				// Server error messages come back in the UI language.
				'Accept-Language': currentLanguage(),
				...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
			},
			...init,
		});
	} catch (cause) {
		throw networkError(cause);
	}
	return readEnvelope<T>(response);
}

/** Builds a query string, skipping absent and empty values. */
function toQuery(params: Record<string, unknown>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === '') continue;
		search.set(key, String(value));
	}
	const query = search.toString();
	return query ? `?${query}` : '';
}

/** B-29: splits the receipt's serial textarea (lines or commas) into unique, trimmed serials. */
export function parseSerialLines(text: string): string[] {
	return [...new Set(text.split(/[\n,]+/).map((line) => line.trim()).filter(Boolean))];
}

/** B-29: active projects for the manual issue / receipt project picker. */
export const stockProjectOptionsQueryOptions = (search: string) =>
	queryOptions({
		queryKey: ['stock', 'project-options', search] as const,
		queryFn: async () => (await request<TStockProjectOption[]>(`/stock/project-options${toQuery({ search })}`)).data ?? [],
		staleTime: 30_000,
	});

/**
 * B-29: serial numbers of one item in one warehouse with a status: `in_stock`
 * units an issue may take out, or `issued` units a receipt may bring back.
 */
export const warehouseSerialsQueryOptions = (productId: string, warehouseId: string, status: 'in_stock' | 'issued') =>
	queryOptions({
		queryKey: ['stock', 'serials', productId, warehouseId, status] as const,
		queryFn: async () => {
			const envelope = (await request<Array<{ serialNumber: string }>>(
				`/products/${productId}/units${toQuery({ status, warehouseId: status === 'in_stock' ? warehouseId : undefined, limit: 100 })}`,
			)) as TApiPaginatedResponse<{ serialNumber: string }>;
			return envelope.data.map((unit) => unit.serialNumber);
		},
		enabled: productId !== '' && warehouseId !== '',
	});

/** Fetches one page of balances. */
export async function listBalances(params: TBalanceListParams = {}) {
	const envelope = (await request<TStockBalance[]>(
		`/stock/balances${toQuery(params)}`,
	)) as TApiPaginatedResponse<TStockBalance>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one page of ledger movements. */
export async function listMovements(params: TMovementListParams = {}) {
	const envelope = (await request<TStockMovement[]>(
		`/stock/movements${toQuery(params)}`,
	)) as TApiPaginatedResponse<TStockMovement>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Receives stock into a warehouse. */
export async function receiveStock(input: TStockMovementInput) {
	const envelope = await request<TStockPostResult>('/stock/receipts', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/**
 * Issues stock out of a warehouse.
 *
 * @throws When the balance would go negative — the backend refuses for every
 *   movement type, and the message states what is actually on hand.
 */
export async function issueStock(input: TStockMovementInput) {
	const envelope = await request<TStockPostResult>('/stock/issues', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/**
 * Reverses a posted movement by appending an opposing row.
 *
 * @param movementId - The original movement
 * @throws When the movement is already reversed, or when reversing it would
 *   take the balance negative (a reversal is a movement like any other).
 */
export async function reverseMovement(movementId: string) {
	const envelope = await request<TStockPostResult>(
		`/stock/movements/${movementId}/reverse`,
		{ method: 'POST' },
	);
	return envelope.data;
}

/**
 * Rebuilds balances from the ledger for one scope.
 *
 * @param scope - `'global'` for the shared rows, otherwise the caller's
 *   organization is used
 * @remarks
 * A repair operation, not a routine call: the incremental balance is already
 * correct, and this exists to recover one that is not.
 */
export async function recomputeBalances(scope?: string) {
	const envelope = await request<{ written: number; removed: number }>(
		'/stock/balances/recompute',
		{
			method: 'POST',
			body: JSON.stringify(scope === undefined ? {} : { scope }),
		},
	);
	return envelope.data;
}

/** Query options for the balance list. */
export const balancesQueryOptions = (params: TBalanceListParams = {}) =>
	queryOptions({
		queryKey: ['stock', 'balances', params],
		queryFn: () => listBalances(params),
	});

/** Query options for the movement ledger. */
export const movementsQueryOptions = (params: TMovementListParams = {}) =>
	queryOptions({
		queryKey: ['stock', 'movements', params],
		queryFn: () => listMovements(params),
	});
