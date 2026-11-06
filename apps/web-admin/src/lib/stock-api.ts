import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

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

/** A movement's direction is a property of its type; the quantity is signed. */
export type TMovementType =
	| 'receipt'
	| 'issue'
	| 'transfer_in'
	| 'transfer_out'
	| 'adjustment_in'
	| 'adjustment_out'
	| 'return_in'
	| 'return_out'
	| 'consumption'
	| 'borrowing_out'
	| 'borrowing_in';

/** Movement types that decrease stock. Mirrors `isOutbound` on the backend. */
export const OUTBOUND_MOVEMENT_TYPES: ReadonlySet<TMovementType> = new Set([
	'issue',
	'transfer_out',
	'adjustment_out',
	'return_out',
	'consumption',
	'borrowing_out',
]);

/** One stock movement (an append-only ledger row). */
export type TStockMovement = {
	id: string;
	organizationId: string | null;
	code: string;
	movementType: TMovementType;
	itemId: string;
	/** Resolved item name; `null` when archived or unknown. */
	itemName: string | null;
	warehouseId: string;
	/** Resolved warehouse name; `null` when archived or unknown. */
	warehouseName: string | null;
	binId: string | null;
	targetWarehouseId: string | null;
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
	itemId: string;
	/** Resolved item name; `null` when archived or unknown. */
	itemName: string | null;
	warehouseId: string;
	/** Resolved warehouse name; `null` when archived or unknown. */
	warehouseName: string | null;
	binId: string | null;
	quantityOnHand: string;
	quantityReserved: string;
	quantityAvailable: string;
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
	itemId: string;
	/** Positive; the endpoint decides the direction. */
	quantity: number;
	occurredAt?: string;
	referenceType?: string | null;
	referenceId?: string | null;
	notes?: string | null;
};

/** Filter for the movement ledger. */
export type TMovementListParams = {
	page?: number;
	limit?: number;
	/** `'global'` selects the shared rows; omit for the caller's scope. */
	scope?: string;
	warehouseId?: string;
	itemId?: string;
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
	itemId?: string;
	binId?: string;
	inStockOnly?: boolean;
};

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
