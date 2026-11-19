import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import type { TItemUnitLabel } from './inventory-api';

/**
 * API client for purchase requests and purchase orders
 * (`/procurement/purchase-requests`, `/procurement/purchase-orders`).
 * Company-wide; the server recomputes every total. The supplier master lives
 * in `supplier-api.ts`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PURCHASE_CATEGORIES = ['hardware', 'software', 'service', 'other'] as const;
export type TPurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];
export const PO_VAT_MODES = ['none', 'included', 'added'] as const;
export type TPoVatMode = (typeof PO_VAT_MODES)[number];
export const PURCHASE_ORDER_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'sent',
	'partially_received',
	'received',
	'cancelled',
] as const;
export type TPurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
export const PO_STATUS_VARIANT: Record<TPurchaseOrderStatus, 'default' | 'secondary' | 'outline'> = {
	draft: 'outline',
	submitted: 'secondary',
	approved: 'secondary',
	sent: 'default',
	partially_received: 'secondary',
	received: 'default',
	cancelled: 'outline',
};

export type TPoSupplierSnapshot = {
	code: string;
	name: string;
	address: string | null;
	taxId: string | null;
	phone: string | null;
	email: string | null;
	picName: string | null;
	picTitle: string | null;
	picPhone: string | null;
	picEmail: string | null;
};

export type TPurchaseOrder = {
	id: string;
	code: string | null;
	/** supplier.companies id; the PIC is supplier.suppliers. */
	supplierCompanyId: string;
	supplierPicId: string | null;
	supplierSnapshot: TPoSupplierSnapshot;
	category: TPurchaseCategory;
	subject: string;
	status: TPurchaseOrderStatus;
	/** `YYYY-MM-DD` (Asia/Jakarta). */
	orderDate: string;
	expectedDeliveryDate: string | null;
	supplierQuoteRef: string | null;
	supplierQuoteDate: string | null;
	projectName: string | null;
	buyerPicName: string | null;
	vatMode: TPoVatMode;
	vatRateBps: number;
	/** Integer IDR minor units. */
	subtotal: number;
	taxTotal: number;
	grandTotal: number;
	paymentTerms: string | null;
	terms: string | null;
	notes: string | null;
	rejectionReason: string | null;
	cancelledReason: string | null;
	createdBy: string | null;
	createdAt: string;
};

export type TPurchaseOrderItem = {
	id: string;
	productId: string;
	sku: string;
	name: string;
	specification: string | null;
	unit: TItemUnitLabel;
	quantity: string;
	unitPrice: number;
	lineTotal: number;
	quantityReceived: string;
	/** The purchase request line this line orders, and its request (PR → PO). */
	purchaseRequestItemId: string | null;
	purchaseRequestId: string | null;
	purchaseRequestCode: string | null;
};

export type TPurchaseOrderDetail = TPurchaseOrder & { items: TPurchaseOrderItem[]; taxBase: number };

export type TPurchaseOrderInput = {
	supplierCompanyId: string;
	supplierPicId: string | null;
	category: TPurchaseCategory;
	subject: string;
	orderDate: string;
	expectedDeliveryDate: string | null;
	supplierQuoteRef: string | null;
	supplierQuoteDate: string | null;
	projectName: string | null;
	buyerPicName: string | null;
	vatMode: TPoVatMode;
	vatRateBps: number | null;
	paymentTerms: string | null;
	terms: string | null;
	notes: string | null;
	lines: {
		productId: string;
		quantity: string;
		unitPrice: number | null;
		specification: string | null;
		purchaseRequestItemId: string | null;
	}[];
};

/* --------------------------- purchase requests --------------------------- */

export const PURCHASE_REQUEST_STATUSES = ['draft', 'submitted', 'approved', 'ordered', 'cancelled'] as const;
export type TPurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number];
export const PR_STATUS_VARIANT: Record<TPurchaseRequestStatus, 'default' | 'secondary' | 'outline'> = {
	draft: 'outline',
	submitted: 'secondary',
	approved: 'default',
	ordered: 'secondary',
	cancelled: 'outline',
};

/** A purchase request (company-wide); money in IDR minor units. */
export type TPurchaseRequest = {
	id: string;
	code: string | null;
	requestedBy: string | null;
	requestedByName: string | null;
	subject: string;
	justification: string | null;
	projectName: string | null;
	/** `YYYY-MM-DD` (Asia/Jakarta). */
	requestDate: string;
	neededBy: string | null;
	status: TPurchaseRequestStatus;
	estimatedTotal: number;
	rejectionReason: string | null;
	cancelledReason: string | null;
	approvedBy: string | null;
	createdAt: string;
};

export type TPurchaseRequestLine = {
	id: string;
	/** inventory.products id; null for a free-text line. */
	productId: string | null;
	sku: string | null;
	name: string;
	specification: string | null;
	unit: string;
	quantity: string;
	estimatedUnitPrice: number;
	estimatedTotal: number;
	notes: string | null;
	/** The live purchase order ordering this line, if any. */
	purchaseOrderId: string | null;
	purchaseOrderCode: string | null;
	purchaseOrderStatus: TPurchaseOrderStatus | null;
};

export type TPurchaseRequestDetail = TPurchaseRequest & { lines: TPurchaseRequestLine[] };

export type TPurchaseRequestInput = {
	subject: string;
	justification: string | null;
	projectName: string | null;
	requestDate: string;
	neededBy: string | null;
	lines: {
		productId: string | null;
		name: string | null;
		unit: string | null;
		quantity: string;
		estimatedUnitPrice: number | null;
		specification: string | null;
		notes: string | null;
	}[];
};

/** An approved request line not yet on a live purchase order. */
export type TOpenRequestLine = Omit<TPurchaseRequestLine, 'purchaseOrderId' | 'purchaseOrderCode' | 'purchaseOrderStatus'> & {
	purchaseRequestId: string;
	purchaseRequestCode: string | null;
	purchaseRequestSubject: string;
	projectName: string | null;
	neededBy: string | null;
	requestedByName: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			// Server error messages come back in the UI language.
			'Accept-Language': currentLanguage(),
			...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope;
}

const send = async <T>(path: string, method: string, body?: unknown) =>
	(await request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })).data as T;

function query(params: Record<string, unknown>) {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	return search.size ? `?${search}` : '';
}

export function purchaseOrdersQueryOptions(params: { page?: number; limit?: number; search?: string; status?: TPurchaseOrderStatus; supplierCompanyId?: string }) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-orders', params] as const,
		queryFn: async () => {
			const envelope = (await request<TPurchaseOrder[]>(
				`/procurement/purchase-orders${query(params)}`,
			)) as TApiPaginatedResponse<TPurchaseOrder>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function purchaseOrderQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-orders', id] as const,
		queryFn: async () => (await request<TPurchaseOrderDetail>(`/procurement/purchase-orders/${id}`)).data as TPurchaseOrderDetail,
		retry: false,
	});
}

export const createPurchaseOrder = (input: TPurchaseOrderInput) => send<TPurchaseOrder>('/procurement/purchase-orders', 'POST', input);
export const updatePurchaseOrder = (id: string, input: TPurchaseOrderInput) =>
	send<TPurchaseOrder>(`/procurement/purchase-orders/${id}`, 'PATCH', input);
export const submitPurchaseOrder = (id: string) => send<TPurchaseOrder>(`/procurement/purchase-orders/${id}/submit`, 'POST');
export const decidePurchaseOrder = (id: string, decision: 'approve' | 'reject', reason?: string) =>
	send<TPurchaseOrder>(`/procurement/purchase-orders/${id}/decision`, 'POST', { decision, reason });
export const sendPurchaseOrder = (id: string) => send<TPurchaseOrder>(`/procurement/purchase-orders/${id}/send`, 'POST');
export const cancelPurchaseOrder = (id: string, reason: string) =>
	send<TPurchaseOrder>(`/procurement/purchase-orders/${id}/cancel`, 'POST', { reason });

/** Totals as the server computes them (UX preview). */
export function purchaseRequestsQueryOptions(params: {
	page?: number;
	limit?: number;
	search?: string;
	status?: TPurchaseRequestStatus;
	mine?: boolean;
}) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-requests', params] as const,
		queryFn: async () => {
			const envelope = (await request<TPurchaseRequest[]>(`/procurement/purchase-requests${query(params)}`)) as TApiPaginatedResponse<TPurchaseRequest>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function purchaseRequestQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-requests', id] as const,
		queryFn: async () => (await request<TPurchaseRequestDetail>(`/procurement/purchase-requests/${id}`)).data as TPurchaseRequestDetail,
		retry: false,
	});
}

export function openRequestLinesQueryOptions(params: { search?: string; purchaseRequestId?: string }, enabled = true) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-requests', 'open-lines', params] as const,
		queryFn: async () => (await request<TOpenRequestLine[]>(`/procurement/purchase-requests/open-lines${query(params)}`)).data as TOpenRequestLine[],
		enabled,
	});
}

/** An item a requester may ask for (requesters hold no `product:read`). */
export type TRequestableItem = {
	id: string;
	sku: string;
	name: string;
	unitLabel: string;
	specification: string | null;
	purchasePrice: number;
};

export function requestableItemsQueryOptions(search: string) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-requests', 'items', search] as const,
		queryFn: async () => (await request<TRequestableItem[]>(`/procurement/purchase-requests/items${query({ search })}`)).data as TRequestableItem[],
		enabled: search !== '',
	});
}

export const createPurchaseRequest = (input: TPurchaseRequestInput) => send<TPurchaseRequest>('/procurement/purchase-requests', 'POST', input);
export const updatePurchaseRequest = (id: string, input: TPurchaseRequestInput) =>
	send<TPurchaseRequest>(`/procurement/purchase-requests/${id}`, 'PATCH', input);
export const submitPurchaseRequest = (id: string) => send<TPurchaseRequest>(`/procurement/purchase-requests/${id}/submit`, 'POST');
export const approvePurchaseRequest = (id: string) => send<TPurchaseRequest>(`/procurement/purchase-requests/${id}/approve`, 'POST');
export const rejectPurchaseRequest = (id: string, reason: string) =>
	send<TPurchaseRequest>(`/procurement/purchase-requests/${id}/reject`, 'POST', { reason });
export const cancelPurchaseRequest = (id: string, reason: string) =>
	send<TPurchaseRequest>(`/procurement/purchase-requests/${id}/cancel`, 'POST', { reason });

export function previewPoTotals(lineTotals: number[], vatMode: TPoVatMode, vatRateBps: number) {
	const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
	if (vatMode === 'none' || vatRateBps === 0) return { subtotal, taxTotal: 0, grandTotal: subtotal };
	if (vatMode === 'added') {
		const taxTotal = Math.round((subtotal * vatRateBps) / 10_000);
		return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
	}
	const taxBase = Math.round((subtotal * 10_000) / (10_000 + vatRateBps));
	return { subtotal, taxTotal: subtotal - taxBase, grandTotal: subtotal };
}
