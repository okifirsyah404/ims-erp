import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import type { TPerson } from './lead-api';
import type { TPaymentScheduleItem, TQuotationCustomerSnapshot } from './quotation-api';

/**
 * API client for sales orders (`/sales/orders`, ADR-0011 step 3d).
 *
 * @remarks
 * An order is created from an approved or sent SPH and is confirmed at once;
 * the SPH becomes Deal. The server decides visibility.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const SALES_ORDER_STATUSES = ['confirmed', 'in_progress', 'delivered', 'completed', 'cancelled'] as const;
export type TSalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const SALES_ORDER_STATUS_VARIANT: Record<TSalesOrderStatus, 'default' | 'secondary' | 'outline'> = {
	confirmed: 'default',
	in_progress: 'secondary',
	delivered: 'secondary',
	completed: 'secondary',
	cancelled: 'outline',
};

export type TSalesOrder = {
	id: string;
	code: string;
	quotationId: string;
	quotationCode: string;
	customerId: string;
	companyId: string | null;
	customerSnapshot: TQuotationCustomerSnapshot;
	customerPoNumber: string | null;
	title: string;
	attention: string | null;
	status: TSalesOrderStatus;
	/** `YYYY-MM-DD` (Asia/Jakarta). */
	orderDate: string;
	deliveryDate: string | null;
	paymentTerms: string | null;
	paymentSchedule: TPaymentScheduleItem[] | null;
	guarantee: string | null;
	vatEnabled: boolean;
	vatRateBps: number;
	/** Integer IDR minor units. */
	subtotal: number;
	discountTotal: number;
	taxTotal: number;
	grandTotal: number;
	notes: string | null;
	cancellationReason: string | null;
	createdAt: string;
};

export type TSalesOrderItem = {
	id: string;
	productId: string | null;
	sku: string | null;
	name: string;
	specification: string | null;
	unit: string;
	quantity: string;
	unitPrice: number;
	discountAmount: number;
	lineTotal: number;
	quantityDelivered: string;
	fulfillmentStatus: 'pending' | 'reserved' | 'partial' | 'fulfilled' | 'cancelled';
};

export type TSalesOrderDetail = TSalesOrder & {
	items: TSalesOrderItem[];
	history: { id: string; toStatus: TSalesOrderStatus; changedAt: string; note: string | null; by: TPerson | null }[];
	salesPerson: TPerson | null;
};

export type TSalesOrderInput = {
	quotationId: string;
	customerPoNumber: string | null;
	orderDate: string | null;
	deliveryDate: string | null;
	notes: string | null;
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

export function salesOrdersQueryOptions(params: { page?: number; limit?: number; search?: string; status?: TSalesOrderStatus; customerId?: string }) {
	return queryOptions({
		queryKey: ['sales', 'orders', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TSalesOrder[]>(
				`/sales/orders${search.size ? `?${search}` : ''}`,
			)) as TApiPaginatedResponse<TSalesOrder>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function salesOrderQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['sales', 'orders', id] as const,
		queryFn: async () => (await request<TSalesOrderDetail>(`/sales/orders/${id}`)).data as TSalesOrderDetail,
		retry: false,
	});
}

export async function createSalesOrder(input: TSalesOrderInput): Promise<TSalesOrder> {
	return (await request<TSalesOrder>('/sales/orders', { method: 'POST', body: JSON.stringify(input) })).data as TSalesOrder;
}

export async function cancelSalesOrder(id: string, reason: string): Promise<TSalesOrder> {
	return (await request<TSalesOrder>(`/sales/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }))
		.data as TSalesOrder;
}
