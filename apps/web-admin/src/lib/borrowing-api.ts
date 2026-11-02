import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the borrowing workflow (`/borrowings`).
 *
 * @remarks
 * A borrowing is a **document with a custody chain and a physical ledger
 * effect**, not a bare movement: `requested → approved → issued →
 * partially_returned → returned → closed`, plus `rejected` / `cancelled`. Only
 * `issue`, `return`, and `mark-lost` write movements, each exactly once.
 *
 * **The client never sends a status, an approver, a code, or an organization.**
 * All are decided by the backend from the session — a client that could set them
 * could issue its own units. Each transition is its own endpoint for that
 * reason, so the buttons here can only request an edge, never assert one.
 *
 * **Guest PII is whatever the server chose to send.** A caller without
 * `borrowing:mark_lost` receives the identity fields as `null` with
 * `guestIdentityRedacted: true`; this client renders the redaction marker rather
 * than assuming the fields exist, because it has no way to know the caller's
 * tier.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Borrowing document status, mirroring the backend state machine. */
export type TBorrowingStatus =
	| 'draft'
	| 'requested'
	| 'approved'
	| 'rejected'
	| 'issued'
	| 'partially_returned'
	| 'returned'
	| 'closed'
	| 'cancelled';

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

/** One borrowing (header). */
export type TBorrowing = {
	id: string;
	/** Always a tenant: a borrowing belongs to the organization that issued it. */
	organizationId: string;
	code: string;
	status: TBorrowingStatus;
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

/** One borrowed unit. A line is exactly one serialized unit. */
export type TBorrowingLine = {
	id: string;
	borrowingId: string;
	serialTrackedItemId: string;
	/** The warehouse the unit left from; a return restores it here. */
	originWarehouseId: string;
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
 * One timeline entry.
 *
 * @remarks
 * **`issued`, `returned`, and `marked_lost` always carry a `stockMovementId`** —
 * the backend's CHECK constraint requires it, which is how the trail proves a
 * physical event was actually written to the ledger rather than merely claimed.
 * Every other event carries `null`. `marked_late` also has a null actor: it is
 * the sweep, not a person.
 */
export type TBorrowingEvent = {
	id: string;
	borrowingLineId: string | null;
	eventType: string;
	stockMovementId: string | null;
	actorUserId: string | null;
	occurredAt: string;
	note: string | null;
};

/** One borrowing with its lines and full timeline. */
export type TBorrowingDetail = {
	borrowing: TBorrowing;
	lines: TBorrowingLine[];
	events: TBorrowingEvent[];
};

/** One requested unit. */
export type TBorrowingLineInput = {
	serialTrackedItemId: string;
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
	lines: TBorrowingLineInput[];
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

/**
 * Unwraps a response that may be a bare borrowing, a detail envelope, or
 * nothing.
 *
 * @remarks
 * The service returns the detail shape everywhere, but the shared envelope
 * generic cannot see the discriminant, so both shapes arrive at this seam. A
 * `null` body is passed through as `null` — the detail page renders it as
 * "not found" rather than crashing on a destructure.
 */
function toDetail(
	data: TBorrowing | TBorrowingDetail | null,
): TBorrowingDetail | null {
	if (data === null) return null;
	return 'borrowing' in data
		? data
		: { borrowing: data, lines: [], events: [] };
}

/** Fetches one page of borrowings. */
export async function listBorrowings(params?: {
	page?: number;
	limit?: number;
	status?: TBorrowingStatus;
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

	const envelope = (await request<TBorrowing[]>(
		`/borrowings${query ? `?${query}` : ''}`,
	)) as TApiPaginatedResponse<TBorrowing>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one borrowing with its lines and timeline. */
export async function getBorrowing(borrowingId: string) {
	const envelope = await request<TBorrowingDetail | TBorrowing>(
		`/borrowings/${borrowingId}`,
	);
	return toDetail(envelope.data);
}

/** Raises a borrowing. It starts in `requested`. */
export async function createBorrowing(input: TBorrowingCreateInput) {
	const envelope = await request<TBorrowingDetail | TBorrowing>('/borrowings', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return toDetail(envelope.data);
}

/** The edges that need no body. */
export type TBorrowingAction =
	| 'submit'
	| 'approve'
	| 'reject'
	| 'issue'
	| 'cancel'
	| 'close';

/**
 * Requests one bodyless transition.
 *
 * @param action - The edge to request
 * @remarks
 * The backend decides whether the edge is legal **and** whether this caller may
 * take it; a refusal is a 422 or 403 surfaced as a thrown `Error`.
 */
export async function transitionBorrowing(
	borrowingId: string,
	action: TBorrowingAction,
) {
	const envelope = await request<TBorrowingDetail | TBorrowing>(
		`/borrowings/${borrowingId}/${action}`,
		{ method: 'POST' },
	);
	return toDetail(envelope.data);
}

/** Returns one line, or every open line when `lineId` is omitted. */
export async function returnBorrowing(
	borrowingId: string,
	input: {
		lineId?: string;
		condition: TReturnCondition;
		note?: string | null;
	},
) {
	const envelope = await request<TBorrowingDetail | TBorrowing>(
		`/borrowings/${borrowingId}/return`,
		{ method: 'POST', body: JSON.stringify(input) },
	);
	return toDetail(envelope.data);
}

/** Extends the due date. Nothing physical moves. */
export async function extendBorrowing(borrowingId: string, dueAt: string) {
	const envelope = await request<TBorrowingDetail | TBorrowing>(
		`/borrowings/${borrowingId}/extend`,
		{ method: 'POST', body: JSON.stringify({ dueAt }) },
	);
	return toDetail(envelope.data);
}

/**
 * Reports one line lost.
 *
 * @remarks
 * Reduces stock by one at the line's origin warehouse. The unit is not restored
 * anywhere — it is gone, which is why this needs `borrowing:mark_lost`.
 */
export async function markBorrowingLineLost(
	borrowingId: string,
	input: { lineId: string; note?: string | null },
) {
	const envelope = await request<TBorrowingDetail | TBorrowing>(
		`/borrowings/${borrowingId}/mark-lost`,
		{ method: 'POST', body: JSON.stringify(input) },
	);
	return toDetail(envelope.data);
}

/** Query options for the borrowing list. */
export const borrowingsQueryOptions = (params: {
	page?: number;
	limit?: number;
	status?: TBorrowingStatus;
	borrowerType?: TBorrowerType;
	search?: string;
} = {}) =>
	queryOptions({
		queryKey: ['inventory', 'borrowings', params] as const,
		queryFn: () => listBorrowings(params),
	});

/** Query options for one borrowing. */
export const borrowingQueryOptions = (borrowingId: string) =>
	queryOptions({
		queryKey: ['inventory', 'borrowings', borrowingId] as const,
		queryFn: () => getBorrowing(borrowingId),
	});
