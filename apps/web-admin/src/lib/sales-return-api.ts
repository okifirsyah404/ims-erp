import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for sales returns (`/sales-returns`, ERP-0065): goods a
 * customer sends back from a shipped delivery note, for replacement.
 * Receiving books the stock back in per line condition and re-opens the
 * order. `unitCost` is 0 for callers without `product:read_cost`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const SALES_RETURN_STATUSES = ['draft', 'submitted', 'approved', 'received', 'cancelled'] as const;
export type TSalesReturnStatus = (typeof SALES_RETURN_STATUSES)[number];
export type TSalesReturnCondition = 'good' | 'damaged';

export const SALES_RETURN_STATUS_VARIANT: Record<TSalesReturnStatus, 'default' | 'secondary' | 'outline'> = {
	draft: 'outline',
	submitted: 'secondary',
	approved: 'secondary',
	received: 'default',
	cancelled: 'outline',
};

export type TSalesReturn = {
	id: string;
	code: string | null;
	deliveryNoteId: string;
	deliveryNoteCode: string;
	salesOrderId: string;
	salesOrderCode: string;
	customerName: string;
	warehouseId: string;
	status: TSalesReturnStatus;
	returnDate: string;
	reason: string;
	notes: string | null;
	totalAmount: number;
	rejectionReason: string | null;
	cancelledReason: string | null;
	createdBy: string | null;
	createdAt: string;
};

export type TSalesReturnItem = {
	id: string;
	deliveryNoteItemId: string;
	itemId: string;
	sku: string | null;
	name: string;
	unit: string;
	quantity: string;
	unitPrice: number;
	unitCost: number;
	lineTotal: number;
	serialNumbers: string[] | null;
	condition: TSalesReturnCondition | null;
	binId: string | null;
};

export type TSalesReturnDetail = TSalesReturn & {
	items: TSalesReturnItem[];
	warehouse: { code: string; name: string; storages: { id: string; code: string; name: string | null }[] } | null;
};

export type TReturnableDelivery = {
	id: string;
	code: string;
	deliveryDate: string;
	salesOrderId: string;
	salesOrderCode: string;
	customerName: string;
	warehouseId: string;
	items: {
		id: string;
		itemId: string | null;
		sku: string | null;
		name: string;
		unit: string;
		quantity: string;
		returnableQuantity: string;
		serialNumbers: string[];
		isSerialized: boolean;
	}[];
};

export type TSalesReturnInput = {
	deliveryNoteId: string;
	returnDate: string;
	reason: string;
	notes: string | null;
	lines: { deliveryNoteItemId: string; quantity: string; serialNumbers: string[] | null }[];
};

export type TSalesReturnReceiveInput = {
	receivedDate: string;
	lines: { salesReturnItemId: string; condition: TSalesReturnCondition; binId: string | null }[];
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

export function salesReturnsQueryOptions(params: { page?: number; limit?: number; search?: string; status?: TSalesReturnStatus }) {
	return queryOptions({
		queryKey: ['sales', 'sales-returns', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TSalesReturn[]>(`/sales-returns${search.size ? `?${search}` : ''}`)) as TApiPaginatedResponse<TSalesReturn>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function salesReturnQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['sales', 'sales-returns', id] as const,
		queryFn: async () => (await request<TSalesReturnDetail>(`/sales-returns/${id}`)).data as TSalesReturnDetail,
		retry: false,
	});
}

export function returnableDeliveriesQueryOptions() {
	return queryOptions({
		queryKey: ['sales', 'returnable-deliveries'] as const,
		queryFn: async () => (await request<TReturnableDelivery[]>('/sales-returns/returnable-deliveries')).data as TReturnableDelivery[],
	});
}

export async function createSalesReturn(input: TSalesReturnInput): Promise<TSalesReturn> {
	return (await request<TSalesReturn>('/sales-returns', { method: 'POST', body: JSON.stringify(input) })).data as TSalesReturn;
}

export async function updateSalesReturn(id: string, input: TSalesReturnInput): Promise<TSalesReturn> {
	return (await request<TSalesReturn>(`/sales-returns/${id}`, { method: 'PATCH', body: JSON.stringify(input) })).data as TSalesReturn;
}

export async function submitSalesReturn(id: string): Promise<void> {
	await request(`/sales-returns/${id}/submit`, { method: 'POST' });
}

export async function decideSalesReturn(id: string, decision: 'approve' | 'reject', reason?: string): Promise<void> {
	await request(`/sales-returns/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) });
}

export async function receiveSalesReturn(id: string, input: TSalesReturnReceiveInput): Promise<void> {
	await request(`/sales-returns/${id}/receive`, { method: 'POST', body: JSON.stringify(input) });
}

export async function cancelSalesReturn(id: string, reason: string): Promise<void> {
	await request(`/sales-returns/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
}
