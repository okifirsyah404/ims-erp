import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for purchase returns (`/purchase-returns`, ERP-0064): goods
 * from a goods receipt go back to the supplier for replacement. Shipping
 * posts the stock out and re-opens the purchase order. Costs are 0 for
 * callers without `product:read_cost`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PURCHASE_RETURN_STATUSES = ['draft', 'submitted', 'approved', 'shipped', 'cancelled'] as const;
export type TPurchaseReturnStatus = (typeof PURCHASE_RETURN_STATUSES)[number];

export const RETURN_STATUS_VARIANT: Record<TPurchaseReturnStatus, 'default' | 'secondary' | 'outline'> = {
	draft: 'outline',
	submitted: 'secondary',
	approved: 'secondary',
	shipped: 'default',
	cancelled: 'outline',
};

export type TPurchaseReturn = {
	id: string;
	code: string | null;
	goodsReceiptId: string;
	goodsReceiptCode: string;
	purchaseOrderId: string;
	purchaseOrderCode: string | null;
	supplierName: string;
	warehouseId: string;
	binId: string | null;
	status: TPurchaseReturnStatus;
	returnDate: string;
	reason: string;
	notes: string | null;
	totalAmount: number;
	rejectionReason: string | null;
	cancelledReason: string | null;
	createdBy: string | null;
	shippedAt: string | null;
	createdAt: string;
};

export type TPurchaseReturnItem = {
	id: string;
	goodsReceiptItemId: string;
	itemId: string;
	sku: string;
	name: string;
	unit: string;
	quantity: string;
	unitCost: number;
	lineTotal: number;
	serialNumbers: string[] | null;
};

export type TPurchaseReturnDetail = TPurchaseReturn & {
	items: TPurchaseReturnItem[];
	warehouse: { code: string; name: string } | null;
	bin: { code: string; name: string | null } | null;
};

export type TReturnableReceipt = {
	id: string;
	code: string;
	receiptDate: string;
	purchaseOrderId: string;
	purchaseOrderCode: string | null;
	supplierName: string;
	items: {
		id: string;
		itemId: string;
		sku: string;
		name: string;
		unit: string;
		quantity: string;
		returnableQuantity: string;
		serialNumbers: string[];
		isSerialized: boolean;
	}[];
};

export type TPurchaseReturnInput = {
	goodsReceiptId: string;
	returnDate: string;
	reason: string;
	notes: string | null;
	lines: { goodsReceiptItemId: string; quantity: string; serialNumbers: string[] | null }[];
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

export function purchaseReturnsQueryOptions(params: { page?: number; limit?: number; search?: string; status?: TPurchaseReturnStatus }) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-returns', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TPurchaseReturn[]>(
				`/purchase-returns${search.size ? `?${search}` : ''}`,
			)) as TApiPaginatedResponse<TPurchaseReturn>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function purchaseReturnQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['procurement', 'purchase-returns', id] as const,
		queryFn: async () => (await request<TPurchaseReturnDetail>(`/purchase-returns/${id}`)).data as TPurchaseReturnDetail,
		retry: false,
	});
}

export function returnableReceiptsQueryOptions() {
	return queryOptions({
		queryKey: ['procurement', 'returnable-receipts'] as const,
		queryFn: async () => (await request<TReturnableReceipt[]>('/purchase-returns/returnable-receipts')).data as TReturnableReceipt[],
	});
}

export async function createPurchaseReturn(input: TPurchaseReturnInput): Promise<TPurchaseReturn> {
	return (await request<TPurchaseReturn>('/purchase-returns', { method: 'POST', body: JSON.stringify(input) })).data as TPurchaseReturn;
}

export async function updatePurchaseReturn(id: string, input: TPurchaseReturnInput): Promise<TPurchaseReturn> {
	return (await request<TPurchaseReturn>(`/purchase-returns/${id}`, { method: 'PATCH', body: JSON.stringify(input) }))
		.data as TPurchaseReturn;
}

export async function submitPurchaseReturn(id: string): Promise<void> {
	await request(`/purchase-returns/${id}/submit`, { method: 'POST' });
}

export async function decidePurchaseReturn(id: string, decision: 'approve' | 'reject', reason?: string): Promise<void> {
	await request(`/purchase-returns/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) });
}

export async function shipPurchaseReturn(id: string, shipDate: string): Promise<void> {
	await request(`/purchase-returns/${id}/ship`, { method: 'POST', body: JSON.stringify({ shipDate }) });
}

export async function cancelPurchaseReturn(id: string, reason: string): Promise<void> {
	await request(`/purchase-returns/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
}
