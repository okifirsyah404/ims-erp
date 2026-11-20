import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for delivery notes / surat jalan (`/delivery-notes`, ADR-0011
 * step 5a). A note is numbered when prepared; shipping posts the stock
 * issue and sells the serial units on the server. `unitCost` is null for
 * callers without `product:read_cost`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const DELIVERY_NOTE_STATUSES = ['prepared', 'shipped', 'delivered', 'cancelled'] as const;
export type TDeliveryNoteStatus = (typeof DELIVERY_NOTE_STATUSES)[number];

export const DELIVERY_NOTE_STATUS_VARIANT: Record<TDeliveryNoteStatus, 'default' | 'secondary' | 'outline'> = {
	prepared: 'default',
	shipped: 'secondary',
	delivered: 'secondary',
	cancelled: 'outline',
};

export type TDeliveryNote = {
	id: string;
	code: string;
	salesOrderId: string;
	salesOrderCode: string;
	customerId: string;
	customerName: string;
	warehouseId: string;
	binId: string | null;
	status: TDeliveryNoteStatus;
	deliveryDate: string;
	projectName: string | null;
	projectLocation: string | null;
	recipientName: string;
	recipientAddress: string | null;
	recipientPic: string | null;
	recipientContact: string | null;
	driverName: string | null;
	vehicleNumber: string | null;
	/** ERP-0080: who carried it (`own` or a courier code), its service and waybill (AWB). */
	courierCode: string | null;
	courierService: string | null;
	waybillNumber: string | null;
	notes: string | null;
	shippedAt: string | null;
	receivedAt: string | null;
	receiverName: string | null;
	cancelledAt: string | null;
	cancellationReason: string | null;
	createdAt: string;
};

export type TDeliveryNoteItem = {
	id: string;
	salesOrderItemId: string;
	itemId: string | null;
	sku: string | null;
	name: string;
	unit: string;
	quantity: string;
	unitPrice: number;
	unitCost: number | null;
	serialNumbers: string[] | null;
	remarks: string | null;
};

export type TDeliveryNoteDetail = TDeliveryNote & {
	items: TDeliveryNoteItem[];
	warehouse: { code: string; name: string } | null;
	bin: { code: string; name: string | null } | null;
};

export type TShippingWarehouse = {
	id: string;
	code: string;
	name: string;
	storages: { id: string; code: string; name: string | null }[];
};

export type TDeliverableOrder = {
	id: string;
	code: string;
	title: string;
	status: string;
	orderDate: string;
	attention: string | null;
	customerName: string;
	customerAddress: string | null;
	customerContact: string | null;
	items: {
		id: string;
		itemId: string | null;
		sku: string | null;
		name: string;
		unit: string;
		quantity: string;
		quantityDelivered: string;
		unitPrice: number;
		openQuantity: string;
		isSerialized: boolean;
		isStockTracked: boolean;
	}[];
};

export type TDeliveryNoteInput = {
	salesOrderId: string;
	warehouseId: string;
	binId: string | null;
	deliveryDate: string;
	projectName: string | null;
	projectLocation: string | null;
	recipientName: string | null;
	recipientAddress: string | null;
	recipientPic: string | null;
	recipientContact: string | null;
	driverName: string | null;
	vehicleNumber: string | null;
	notes: string | null;
	lines: { salesOrderItemId: string; quantity: string; serialNumbers: string[] | null; remarks: string | null }[];
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

export function deliveryNotesQueryOptions(params: {
	page?: number;
	limit?: number;
	search?: string;
	salesOrderId?: string;
	status?: TDeliveryNoteStatus;
}) {
	return queryOptions({
		queryKey: ['sales', 'delivery-notes', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TDeliveryNote[]>(
				`/delivery-notes${search.size ? `?${search}` : ''}`,
			)) as TApiPaginatedResponse<TDeliveryNote>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function deliveryNoteQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['sales', 'delivery-notes', id] as const,
		queryFn: async () => (await request<TDeliveryNoteDetail>(`/delivery-notes/${id}`)).data as TDeliveryNoteDetail,
		retry: false,
	});
}

export function deliverableOrdersQueryOptions() {
	return queryOptions({
		queryKey: ['sales', 'deliverable-orders'] as const,
		queryFn: async () => (await request<TDeliverableOrder[]>('/delivery-notes/deliverable-orders')).data as TDeliverableOrder[],
	});
}

export function shippingWarehousesQueryOptions() {
	return queryOptions({
		queryKey: ['sales', 'shipping-warehouses'] as const,
		queryFn: async () => (await request<TShippingWarehouse[]>('/delivery-notes/warehouses')).data as TShippingWarehouse[],
	});
}

export function inStockSerialsQueryOptions(itemId: string, warehouseId: string) {
	return queryOptions({
		queryKey: ['sales', 'in-stock-serials', itemId, warehouseId] as const,
		queryFn: async () =>
			(await request<string[]>(`/delivery-notes/serials?itemId=${itemId}&warehouseId=${warehouseId}`)).data as string[],
		enabled: !!itemId && !!warehouseId,
	});
}

export async function createDeliveryNote(input: TDeliveryNoteInput): Promise<TDeliveryNoteDetail> {
	return (await request<TDeliveryNoteDetail>('/delivery-notes', { method: 'POST', body: JSON.stringify(input) }))
		.data as TDeliveryNoteDetail;
}

/** Courier codes as the backend (and RajaOngkir) name them (ERP-0080). */
export const COURIER_CODES = ['own', 'jne', 'jnt', 'sicepat', 'anteraja', 'pos', 'tiki', 'lion', 'ninja', 'wahana', 'other'] as const;
export type TCourierCode = (typeof COURIER_CODES)[number];

export type TShipInput = { courierCode: TCourierCode | null; courierService: string | null; waybillNumber: string | null };

export async function shipDeliveryNote(id: string, courier?: TShipInput): Promise<TDeliveryNoteDetail> {
	return (
		await request<TDeliveryNoteDetail>(`/delivery-notes/${id}/ship`, {
			method: 'POST',
			body: JSON.stringify(courier ?? {}),
		})
	).data as TDeliveryNoteDetail;
}

export async function deliverDeliveryNote(id: string, receiverName: string): Promise<TDeliveryNoteDetail> {
	return (
		await request<TDeliveryNoteDetail>(`/delivery-notes/${id}/deliver`, {
			method: 'POST',
			body: JSON.stringify({ receiverName }),
		})
	).data as TDeliveryNoteDetail;
}

export async function cancelDeliveryNote(id: string, reason: string): Promise<TDeliveryNoteDetail> {
	return (
		await request<TDeliveryNoteDetail>(`/delivery-notes/${id}/cancel`, {
			method: 'POST',
			body: JSON.stringify({ reason }),
		})
	).data as TDeliveryNoteDetail;
}
