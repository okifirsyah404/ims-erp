import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the borrowing workflow (`/inventory/borrowing-requests` and
 * `/inventory/borrowings`).
 *
 * @remarks
 * Since ADR-0024 a borrowing is two documents:
 *
 * - a **request** (`borrowing_requests`): `draft → requested → approved`, plus
 *   `rejected` / `cancelled`. It carries the borrower, the purpose and the
 *   requested items. It never moves stock.
 * - a **borrowing** (`borrowings`), created when the request is issued:
 *   `issued → partially_returned → returned → closed`. Only `issue`, `return`
 *   and `mark-lost` write movements, each exactly once.
 *
 * Every detail read is keyed by the **request id** and answers the request view
 * (`TBorrowingView`) with the borrowing nested once it exists; the actions that
 * belong to the issue document (return, extend after issue, mark lost, close)
 * are addressed by `view.borrowing.id`.
 *
 * **The client never sends a status, an approver, a code, or an organization.**
 * All are decided by the backend from the session — a client that could set them
 * could issue its own units. Each transition is its own endpoint for that
 * reason, so the buttons here can only request an edge, never assert one.
 *
 * **Guest PII is whatever the server chose to send.** A caller without
 * `asset_borrowing:mark_lost` receives the identity fields as `null` with
 * `guestIdentityRedacted: true`; this client renders the redaction marker rather
 * than assuming the fields exist, because it has no way to know the caller's
 * tier.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Request-half statuses (`BORROWING_REQUEST_STATUSES`). */
export type TBorrowingRequestStatus =
	| 'draft'
	| 'requested'
	| 'approved'
	| 'rejected'
	| 'cancelled';

/** Issue-document statuses (`BORROWING_STATUSES`). */
export type TBorrowingDocumentStatus =
	| 'issued'
	| 'partially_returned'
	| 'returned'
	| 'closed';

/** Either half's status: what the screens badge. */
export type TBorrowingStatus =
	| TBorrowingRequestStatus
	| TBorrowingDocumentStatus;

/** The three borrower paths. */
export const BORROWER_TYPES = ['user', 'customer', 'guest'] as const;
export type TBorrowerType = (typeof BORROWER_TYPES)[number];

/** Why the unit is out. `testing` is a borrowing, not a separate flow (D8). */
export const BORROWING_PURPOSES = [
	'rental',
	'internal_use',
	'testing',
	'warranty_service',
] as const;
export type TBorrowingPurpose = (typeof BORROWING_PURPOSES)[number];

/** The condition a unit comes back in. */
export const RETURN_CONDITIONS = ['good', 'damaged', 'incomplete'] as const;
export type TReturnCondition = (typeof RETURN_CONDITIONS)[number];

/** Guest identity document kinds. */
export const GUEST_ID_TYPES = ['ktp', 'sim', 'passport', 'other'] as const;
export type TGuestIdType = (typeof GUEST_ID_TYPES)[number];

/** One borrowing request (list row and the base of the detail view). */
export type TBorrowingRequest = {
	id: string;
	/** Always a tenant: a request belongs to the organization that raised it. */
	organizationId: string;
	code: string;
	status: TBorrowingRequestStatus;
	purpose: TBorrowingPurpose;
	borrowerType: TBorrowerType;
	borrowerUserId: string | null;
	borrowerCustomerId: string | null;
	/**
	 * Guest identity snapshot.
	 *
	 * @remarks
	 * `guestName`/`guestPhone` survive redaction for non-privileged readers so the
	 * list can show who holds the tool; the id number, address, and document ref
	 * are nulled. All six are nulled permanently once the retention window
	 * passes.
	 */
	guestName: string | null;
	guestPhone: string | null;
	guestIdType: TGuestIdType | null;
	guestIdNumber: string | null;
	guestAddressText: string | null;
	guestIdDocumentRef: string | null;
	requestedBy: string | null;
	requestedAt: string | null;
	approvedBy: string | null;
	approvedAt: string | null;
	dueAt: string;
	/** Set when the request lends a whole tool set (D6). */
	toolSetId: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
	/** List projection only: first requested item's photo; `null` when none. */
	imageUrl?: string | null;
};

/** The issue/return document of an issued request. */
export type TBorrowingDocument = {
	id: string;
	organizationId: string;
	code: string;
	borrowingRequestId: string;
	status: TBorrowingDocumentStatus;
	issuedBy: string | null;
	issuedAt: string | null;
	dueAt: string;
	closedBy: string | null;
	closedAt: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

/** One borrowed unit. An item is exactly one physical unit. */
export type TBorrowingItem = {
	id: string;
	borrowingRequestId: string;
	/** `null` until the request is issued. */
	borrowingId: string | null;
	itemId: string;
	/** The warehouse the unit left from; a return restores it here. */
	originWarehouseId: string | null;
	originStorageId: string | null;
	issuedAt: string | null;
	dueAt: string | null;
	returnedAt: string | null;
	returnedCondition: TReturnCondition | null;
	/** Set by the late sweep, never by a human. */
	markedLateAt: string | null;
	markedLostAt: string | null;
	lostReportedBy: string | null;
	siteAddressText: string | null;
	projectId: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
};

/**
 * One timeline entry, from either half of the lifecycle.
 *
 * @remarks
 * **`issued`, `returned`, and `marked_lost` always carry a `movementId`** — the
 * backend's CHECK constraint requires it, which is how the trail proves a
 * physical event was actually written to the ledger rather than merely claimed.
 * Every other event carries `null`. `marked_late` also has a null actor: it is
 * the sweep, not a person.
 */
export type TBorrowingEvent = {
	id: string;
	/** `request` before issue, `borrowing` after. */
	scope: 'request' | 'borrowing';
	borrowingItemId: string | null;
	eventType: string;
	movementId: string | null;
	actorUserId: string | null;
	occurredAt: string;
	note: string | null;
};

/** One request with its borrowing (once issued), items and full timeline. */
export type TBorrowingView = TBorrowingRequest & {
	/** The issue document; `null` until the request is issued. */
	borrowing: TBorrowingDocument | null;
	items: TBorrowingItem[];
	events: TBorrowingEvent[];
	/** `true` when guest identity fields were withheld from this caller. */
	guestIdentityRedacted: boolean;
};

/** The status a screen should badge: the issue document's once it exists. */
export function borrowingStatusOf(view: TBorrowingView): TBorrowingStatus {
	return view.borrowing?.status ?? view.status;
}

/** One requested unit. */
export type TBorrowingItemInput = {
	itemId: string;
	dueAt?: string | null;
	siteAddressText?: string | null;
	projectId?: string | null;
	notes?: string | null;
};

/** The borrower half of a create request, discriminated by `borrowerType`. */
export type TBorrowerInput =
	| { borrowerType: 'user'; borrowerUserId: string }
	| { borrowerType: 'customer'; borrowerCustomerId: string }
	| {
			borrowerType: 'guest';
			guestName: string;
			guestPhone: string;
			guestIdType?: TGuestIdType | null;
			guestIdNumber: string;
			guestAddressText?: string | null;
			guestIdDocumentRef?: string | null;
	  };

/** Fields the create form submits. */
export type TBorrowingCreateInput = TBorrowerInput & {
	purpose: TBorrowingPurpose;
	dueAt: string;
	notes?: string | null;
	/** Lends a whole tool set; the backend expands it to one item per member. */
	toolSetId?: string | null;
	/** Starts as a draft instead of being raised immediately. */
	draft?: boolean;
	items: TBorrowingItemInput[];
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

/** Fetches one page of borrowing requests. */
export async function listBorrowingRequests(params?: {
	page?: number;
	limit?: number;
	status?: TBorrowingRequestStatus;
	borrowerType?: TBorrowerType;
	search?: string;
}) {
	const search = new URLSearchParams();
	if (params?.page) search.set('page', String(params.page));
	if (params?.limit) search.set('limit', String(params.limit));
	if (params?.status) search.set('status', params.status);
	if (params?.borrowerType) search.set('borrowerType', params.borrowerType);
	if (params?.search) search.set('search', params.search);
	const query = search.toString();

	const envelope = (await request<TBorrowingRequest[]>(
		`/inventory/borrowing-requests${query ? `?${query}` : ''}`,
	)) as TApiPaginatedResponse<TBorrowingRequest>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one page of issue documents (borrowings proper). */
export async function listBorrowingDocuments(params?: {
	page?: number;
	limit?: number;
	status?: TBorrowingDocumentStatus;
	search?: string;
}) {
	const search = new URLSearchParams();
	if (params?.page) search.set('page', String(params.page));
	if (params?.limit) search.set('limit', String(params.limit));
	if (params?.status) search.set('status', params.status);
	if (params?.search) search.set('search', params.search);
	const query = search.toString();

	const envelope = (await request<TBorrowingDocument[]>(
		`/inventory/borrowings${query ? `?${query}` : ''}`,
	)) as TApiPaginatedResponse<TBorrowingDocument>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one request with its borrowing, items and timeline. */
export async function getBorrowing(requestId: string) {
	const envelope = await request<TBorrowingView>(
		`/inventory/borrowing-requests/${requestId}`,
	);
	return envelope.data as TBorrowingView;
}

/** Raises a request. It starts in `requested` (or `draft` when asked). */
export async function createBorrowing(input: TBorrowingCreateInput) {
	const envelope = await request<TBorrowingView>('/inventory/borrowing-requests', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data as TBorrowingView;
}

/** The request-level edges that need no body. */
export type TBorrowingAction =
	| 'submit'
	| 'approve'
	| 'reject'
	| 'issue'
	| 'cancel';

/**
 * Requests one bodyless request-level transition.
 *
 * @param requestId - The request's id
 * @param action - The edge to request
 * @remarks
 * The backend decides whether the edge is legal **and** whether this caller may
 * take it; a refusal is a 422 or 403 surfaced as a thrown `Error`.
 */
export async function transitionBorrowing(
	requestId: string,
	action: TBorrowingAction,
) {
	const envelope = await request<TBorrowingView>(
		`/inventory/borrowing-requests/${requestId}/${action}`,
		{ method: 'POST' },
	);
	return envelope.data as TBorrowingView;
}

/** Closes a returned borrowing, starting the guest-PII retention clock. */
export async function closeBorrowing(borrowingId: string) {
	const envelope = await request<TBorrowingView>(
		`/inventory/borrowings/${borrowingId}/close`,
		{ method: 'POST' },
	);
	return envelope.data as TBorrowingView;
}

/** Returns one item, or every open item when `borrowingItemId` is omitted. */
export async function returnBorrowing(
	borrowingId: string,
	input: {
		borrowingItemId?: string;
		condition: TReturnCondition;
		note?: string | null;
	},
) {
	const envelope = await request<TBorrowingView>(
		`/inventory/borrowings/${borrowingId}/return`,
		{ method: 'POST', body: JSON.stringify(input) },
	);
	return envelope.data as TBorrowingView;
}

/** Extends the due date of an issued borrowing. Nothing physical moves. */
export async function extendBorrowing(borrowingId: string, dueAt: string) {
	const envelope = await request<TBorrowingView>(
		`/inventory/borrowings/${borrowingId}/extend`,
		{ method: 'POST', body: JSON.stringify({ dueAt }) },
	);
	return envelope.data as TBorrowingView;
}

/** Moves the due date of a request that has not been issued yet. */
export async function extendBorrowingRequest(requestId: string, dueAt: string) {
	const envelope = await request<TBorrowingView>(
		`/inventory/borrowing-requests/${requestId}/extend`,
		{ method: 'POST', body: JSON.stringify({ dueAt }) },
	);
	return envelope.data as TBorrowingView;
}

/**
 * Reports one item lost.
 *
 * @remarks
 * Writes a `lost` movement and parks the unit as lost. The unit is not restored
 * anywhere — it is gone, which is why this needs `asset_borrowing:mark_lost`.
 */
export async function markBorrowingItemLost(
	borrowingId: string,
	input: { borrowingItemId: string; note?: string | null },
) {
	const envelope = await request<TBorrowingView>(
		`/inventory/borrowings/${borrowingId}/mark-lost`,
		{ method: 'POST', body: JSON.stringify(input) },
	);
	return envelope.data as TBorrowingView;
}

/** Query options for the request list. */
export const borrowingRequestsQueryOptions = (
	params: {
		page?: number;
		limit?: number;
		status?: TBorrowingRequestStatus;
		borrowerType?: TBorrowerType;
		search?: string;
	} = {},
) =>
	queryOptions({
		queryKey: ['assets', 'borrowings', 'requests', params] as const,
		queryFn: () => listBorrowingRequests(params),
	});

/** Query options for the issued-borrowing list. */
export const borrowingDocumentsQueryOptions = (
	params: {
		page?: number;
		limit?: number;
		status?: TBorrowingDocumentStatus;
		search?: string;
	} = {},
) =>
	queryOptions({
		queryKey: ['assets', 'borrowings', 'issued', params] as const,
		queryFn: () => listBorrowingDocuments(params),
	});

/** Query options for one request (the detail view). */
export const borrowingQueryOptions = (requestId: string) =>
	queryOptions({
		queryKey: ['assets', 'borrowings', 'detail', requestId] as const,
		queryFn: () => getBorrowing(requestId),
	});
