import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import type { TItemUnitLabel } from './inventory-api';

/**
 * API client for suppliers and purchase orders (`/suppliers`,
 * `/purchase-orders`, ADR-0011 step 4a). Company-wide; the server decides
 * bank visibility (`supplier:read_bank`) and recomputes every total.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const SUPPLIER_TYPES = ['company', 'individual', 'government'] as const;
export type TSupplierType = (typeof SUPPLIER_TYPES)[number];

export type TSupplier = {
	id: string;
	code: string;
	supplierType: TSupplierType;
	name: string;
	legalName: string | null;
	taxId: string | null;
	email: string | null;
	phone: string | null;
	whatsapp: string | null;
	website: string | null;
	addressLine: string | null;
	postalCode: string | null;
	picName: string | null;
	picTitle: string | null;
	picPhone: string | null;
	picEmail: string | null;
	paymentTermsDays: number;
	paymentTermNote: string | null;
	bankName: string | null;
	bankAccountNumber: string | null;
	bankAccountHolder: string | null;
	/** False when the caller may not see bank details. */
	bankVisible: boolean;
	status: 'active' | 'inactive';
	notes: string | null;
};

export type TSupplierInput = Omit<TSupplier, 'id' | 'status' | 'bankVisible'>;

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
	supplierId: string;
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
	itemId: string;
	sku: string;
	name: string;
	specification: string | null;
	unit: TItemUnitLabel;
	quantity: string;
	unitPrice: number;
	lineTotal: number;
	quantityReceived: string;
};

export type TPurchaseOrderDetail = TPurchaseOrder & { items: TPurchaseOrderItem[]; taxBase: number };

export type TPurchaseOrderInput = {
	supplierId: string;
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
	lines: { itemId: string; quantity: string; unitPrice: number | null; specification: string | null }[];
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

export function suppliersQueryOptions(params: { page?: number; limit?: number; search?: string; status?: 'active' | 'inactive' }) {
	return queryOptions({
		queryKey: ['procurement', 'suppliers', params] as const,
		queryFn: async () => {
			const envelope = (await request<TSupplier[]>(`/suppliers${query(params)}`)) as TApiPaginatedResponse<TSupplier>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function supplierQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['procurement', 'suppliers', id] as const,
		queryFn: async () => (await request<TSupplier>(`/suppliers/${id}`)).data as TSupplier,
		retry: false,
	});
}

export const createSupplier = (input: TSupplierInput) => send<TSupplier>('/suppliers', 'POST', input);
export const updateSupplier = (id: string, input: Partial<TSupplierInput>) => send<TSupplier>(`/suppliers/${id}`, 'PATCH', input);
export const setSupplierActive = (id: string, active: boolean) =>
	send<TSupplier>(`/suppliers/${id}/${active ? 'activate' : 'deactivate'}`, 'POST');

export function purchaseOrdersQueryOptions(params: { page?: number; limit?: number; search?: string; status?: TPurchaseOrderStatus }) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-orders', params] as const,
		queryFn: async () => {
			const envelope = (await request<TPurchaseOrder[]>(
				`/purchase-orders${query(params)}`,
			)) as TApiPaginatedResponse<TPurchaseOrder>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function purchaseOrderQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-orders', id] as const,
		queryFn: async () => (await request<TPurchaseOrderDetail>(`/purchase-orders/${id}`)).data as TPurchaseOrderDetail,
		retry: false,
	});
}

export const createPurchaseOrder = (input: TPurchaseOrderInput) => send<TPurchaseOrder>('/purchase-orders', 'POST', input);
export const updatePurchaseOrder = (id: string, input: TPurchaseOrderInput) =>
	send<TPurchaseOrder>(`/purchase-orders/${id}`, 'PATCH', input);
export const submitPurchaseOrder = (id: string) => send<TPurchaseOrder>(`/purchase-orders/${id}/submit`, 'POST');
export const decidePurchaseOrder = (id: string, decision: 'approve' | 'reject', reason?: string) =>
	send<TPurchaseOrder>(`/purchase-orders/${id}/decision`, 'POST', { decision, reason });
export const sendPurchaseOrder = (id: string) => send<TPurchaseOrder>(`/purchase-orders/${id}/send`, 'POST');
export const cancelPurchaseOrder = (id: string, reason: string) =>
	send<TPurchaseOrder>(`/purchase-orders/${id}/cancel`, 'POST', { reason });

/** Totals as the server computes them (UX preview). */
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
