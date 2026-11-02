import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the stock adjustment document workflow
 * (`/stock/adjustments`).
 *
 * @remarks
 * An adjustment is a **document with an approval chain**, not a bare movement:
 * `draft → submitted → approved|rejected → posted|cancelled`. Only `posted`
 * writes ledger rows, and it writes them once.
 *
 * **The client never sends a status, an approver, or an organization.** All
 * four are decided by the backend from the session, because a client that could
 * set them could approve its own adjustment and defeat the workflow. Each
 * transition is its own endpoint for exactly that reason.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Document status. `posted` is final; the movements it wrote are immutable. */
export type TAdjustmentStatus =
	| 'draft'
	| 'submitted'
	| 'approved'
	| 'rejected'
	| 'posted'
	| 'cancelled';

/**
 * Why the count was taken.
 *
 * @remarks
 * `increase`/`decrease` record a known direction; `recount` records the counted
 * total. In every case a line stores counted totals and the backend derives the
 * direction from the difference — so this field is the *reason*, not the
 * mechanism, and a `recount` may legitimately move stock either way.
 */
export type TAdjustmentType = 'increase' | 'decrease' | 'recount';

/** One adjustment document (header). */
export type TStockAdjustment = {
	id: string;
	/** Always a tenant — an adjustment is always raised by an organization. */
	organizationId: string;
	code: string;
	warehouseId: string;
	adjustmentType: TAdjustmentType;
	status: TAdjustmentStatus;
	reasonCode: string | null;
	notes: string | null;
	requestedBy: string | null;
	requestedAt: string;
	approvedBy: string | null;
	approvedAt: string | null;
	postedAt: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

/**
 * One adjustment line.
 *
 * @remarks
 * `quantityBefore`/`quantityAfter` are counted **totals**, not deltas: the
 * system's belief and the counter's count, so the document is auditable.
 */
export type TStockAdjustmentItem = {
	id: string;
	organizationId: string;
	stockAdjustmentId: string;
	itemId: string;
	binId: string | null;
	quantityBefore: string;
	quantityAfter: string;
	note: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

/** A document plus its lines. */
export type TStockAdjustmentDetail = {
	adjustment: TStockAdjustment;
	lines: TStockAdjustmentItem[];
};

/** One line as the form submits it. */
export type TAdjustmentLineInput = {
	itemId: string;
	binId?: string | null;
	/** The counted total. */
	quantityAfter: number;
	note?: string | null;
};

/** Fields the create form submits. */
export type TAdjustmentCreateInput = {
	warehouseId: string;
	adjustmentType: TAdjustmentType;
	reasonCode?: string | null;
	notes?: string | null;
	lines: TAdjustmentLineInput[];
};

/** Filter for the adjustment list. */
export type TAdjustmentListParams = {
	page?: number;
	limit?: number;
	warehouseId?: string;
	status?: TAdjustmentStatus;
	adjustmentType?: TAdjustmentType;
	search?: string;
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

/** Fetches one page of adjustment documents. */
export async function listAdjustments(params: TAdjustmentListParams = {}) {
	const envelope = (await request<TStockAdjustment[]>(
		`/stock/adjustments${toQuery(params)}`,
	)) as TApiPaginatedResponse<TStockAdjustment>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one document with its lines. */
export async function getAdjustment(adjustmentId: string) {
	const envelope = await request<TStockAdjustmentDetail>(
		`/stock/adjustments/${adjustmentId}`,
	);
	return envelope.data;
}

/** Raises a new adjustment in `draft`. */
export async function createAdjustment(input: TAdjustmentCreateInput) {
	const envelope = await request<TStockAdjustmentDetail>('/stock/adjustments', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/** Replaces the lines of a `draft` adjustment. */
export async function setAdjustmentLines(
	adjustmentId: string,
	lines: TAdjustmentLineInput[],
) {
	const envelope = await request<TStockAdjustmentDetail>(
		`/stock/adjustments/${adjustmentId}/lines`,
		{ method: 'PUT', body: JSON.stringify({ lines }) },
	);
	return envelope.data;
}

/**
 * Moves a document along its approval chain.
 *
 * @param adjustmentId - The document
 * @param action - The transition to perform
 * @throws When the edge is illegal for the current status (a 422), or when
 *   approving your own document without `stock_adjustment:approve`
 * @remarks
 * One endpoint per transition rather than a generic `PATCH { status }`: the
 * legal edges live in the backend's state machine, not in whatever the client
 * happens to send.
 */
export async function transitionAdjustment(
	adjustmentId: string,
	action: 'submit' | 'approve' | 'reject' | 'cancel' | 'post',
) {
	const envelope = await request<TStockAdjustment | TStockAdjustmentDetail>(
		`/stock/adjustments/${adjustmentId}/${action}`,
		{ method: 'POST' },
	);
	const data = envelope.data as TStockAdjustmentDetail | TStockAdjustment;
	return 'adjustment' in data ? data.adjustment : data;
}

/** Query options for the adjustment list. */
export const adjustmentsQueryOptions = (params: TAdjustmentListParams = {}) =>
	queryOptions({
		queryKey: ['stock', 'adjustments', params],
		queryFn: () => listAdjustments(params),
	});

/** Query options for one adjustment document. */
export const adjustmentQueryOptions = (adjustmentId: string) =>
	queryOptions({
		queryKey: ['stock', 'adjustments', adjustmentId],
		queryFn: () => getAdjustment(adjustmentId),
	});
