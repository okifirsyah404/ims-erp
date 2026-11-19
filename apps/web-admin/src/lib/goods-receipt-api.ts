import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for goods receipts (`/procurement/goods-receipts`, ADR-0011 step 4b).
 * Posted on creation: stock, moving-average cost and serial units are
 * written by the server in one transaction. `unitCost` is 0 for callers
 * without `product:read_cost`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type TGoodsReceipt = {
	id: string;
	code: string;
	purchaseOrderId: string;
	purchaseOrderCode: string | null;
	supplierName: string;
	warehouseId: string;
	binId: string | null;
	receiptDate: string;
	supplierDeliveryRef: string | null;
	notes: string | null;
	createdAt: string;
};

export type TGoodsReceiptItem = {
	id: string;
	purchaseOrderItemId: string;
	sku: string;
	name: string;
	unit: string;
	quantity: string;
	unitCost: number;
	serialNumbers: string[] | null;
};

export type TGoodsReceiptDetail = TGoodsReceipt & {
	items: TGoodsReceiptItem[];
	warehouse: { code: string; name: string } | null;
	bin: { code: string; name: string | null } | null;
};

export type TReceivingWarehouse = {
	id: string;
	code: string;
	name: string;
	storages: { id: string; code: string; name: string | null }[];
};

export type TReceivableOrder = {
	id: string;
	code: string | null;
	subject: string;
	status: string;
	orderDate: string;
	supplierName: string;
	items: {
		id: string;
		productId: string;
		sku: string;
		name: string;
		unit: string;
		quantity: string;
		quantityReceived: string;
		openQuantity: string;
		isSerialized: boolean;
	}[];
};

export type TGoodsReceiptInput = {
	purchaseOrderId: string;
	warehouseId: string;
	binId: string | null;
	receiptDate: string;
	supplierDeliveryRef: string | null;
	notes: string | null;
	lines: { purchaseOrderItemId: string; quantity: string; serialNumbers: string[] | null }[];
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

export function goodsReceiptsQueryOptions(params: { page?: number; limit?: number; search?: string; purchaseOrderId?: string }) {
	return queryOptions({
		queryKey: ['procurement', 'goods-receipts', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TGoodsReceipt[]>(
				`/procurement/goods-receipts${search.size ? `?${search}` : ''}`,
			)) as TApiPaginatedResponse<TGoodsReceipt>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function goodsReceiptQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['procurement', 'goods-receipts', id] as const,
		queryFn: async () => (await request<TGoodsReceiptDetail>(`/procurement/goods-receipts/${id}`)).data as TGoodsReceiptDetail,
		retry: false,
	});
}

export function receivableOrdersQueryOptions() {
	return queryOptions({
		queryKey: ['procurement', 'receivable-orders'] as const,
		queryFn: async () => (await request<TReceivableOrder[]>('/procurement/goods-receipts/receivable-orders')).data as TReceivableOrder[],
	});
}

export async function createGoodsReceipt(input: TGoodsReceiptInput): Promise<TGoodsReceiptDetail> {
	return (await request<TGoodsReceiptDetail>('/procurement/goods-receipts', { method: 'POST', body: JSON.stringify(input) }))
		.data as TGoodsReceiptDetail;
}

export function receivingWarehousesQueryOptions() {
	return queryOptions({
		queryKey: ['procurement', 'receiving-warehouses'] as const,
		queryFn: async () => (await request<TReceivingWarehouse[]>('/procurement/goods-receipts/warehouses')).data as TReceivingWarehouse[],
	});
}
