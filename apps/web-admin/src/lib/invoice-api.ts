import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from './organization-store';
import type { TQuotationCustomerSnapshot } from './quotation-api';
import type { TSalesOrderItem } from './sales-order-api';

/**
 * API client for invoices and receipts (`/invoices`, `/receipts`, ADR-0011
 * step 3d-2). The server computes every amount; previews here are UX only.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void'] as const;
export type TInvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_VARIANT: Record<TInvoiceStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
	draft: 'outline',
	issued: 'secondary',
	partially_paid: 'secondary',
	paid: 'default',
	void: 'outline',
};
export type TInvoiceTermKind = 'down_payment' | 'installment' | 'settlement';

export const RECEIPT_METHODS = ['bank_transfer', 'cash', 'card', 'e_wallet', 'cheque'] as const;
export type TReceiptMethod = (typeof RECEIPT_METHODS)[number];

export type TInvoice = {
	id: string;
	code: string | null;
	termKind: TInvoiceTermKind;
	customerSnapshot: TQuotationCustomerSnapshot;
	salesOrderId: string;
	salesOrderCode: string;
	quotationCode: string;
	title: string;
	description: string;
	percentageBps: number | null;
	issueDate: string | null;
	dueDate: string | null;
	vatEnabled: boolean;
	vatRateBps: number;
	/** Integer IDR minor units; `subtotal` is the term's tax base. */
	subtotal: number;
	taxTotal: number;
	grandTotal: number;
	paidTotal: number;
	outstandingTotal: number;
	status: TInvoiceStatus;
	terms: string | null;
	notes: string | null;
	voidReason: string | null;
	createdAt: string;
};

export type TReceipt = {
	id: string;
	code: string;
	invoiceId: string;
	receivedDate: string;
	amount: number;
	method: TReceiptMethod;
	reference: string | null;
	notes: string | null;
	status: 'posted' | 'reversed';
	reversalReason: string | null;
};

export type TScheduleRow = {
	id: string;
	code: string | null;
	description: string;
	percentageBps: number | null;
	grandTotal: number;
	status: TInvoiceStatus;
	payments: { receivedDate: string; method: TReceiptMethod; amount: number }[];
};

export type TInvoiceDetail = TInvoice & {
	receipts: TReceipt[];
	order: {
		id: string;
		code: string;
		customerPoNumber: string | null;
		attention: string | null;
		paymentTerms: string | null;
		subtotal: number;
		discountTotal: number;
		taxTotal: number;
		grandTotal: number;
		items: TSalesOrderItem[];
		schedule: TScheduleRow[];
	} | null;
};

export type TPlannedTerm = { index: number; label: string; percentBps: number; last: boolean; description: string };

export type TBillingSummary = {
	salesOrderId: string;
	salesOrderCode: string;
	grandTotal: number;
	taxBase: number;
	invoiced: number;
	paid: number;
	remainingToInvoice: number;
	outstanding: number;
	nextTerm: TPlannedTerm | null;
	invoices: TInvoice[];
};

export type TTermInput =
	| { mode: 'next' }
	| { mode: 'percentage'; bps: number }
	| { mode: 'amount'; total: number }
	| { mode: 'remaining' };

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			...organizationHeaders(),
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
		if (value !== undefined && value !== '' && value !== false) search.set(key, String(value));
	}
	return search.size ? `?${search}` : '';
}

export function invoicesQueryOptions(params: {
	page?: number;
	limit?: number;
	search?: string;
	status?: TInvoiceStatus;
	termKind?: TInvoiceTermKind;
	overdue?: boolean;
}) {
	return queryOptions({
		queryKey: ['finance', 'invoices', params] as const,
		queryFn: async () => {
			const envelope = (await request<TInvoice[]>(`/invoices${query(params)}`)) as TApiPaginatedResponse<TInvoice>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function invoiceQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['finance', 'invoices', id] as const,
		queryFn: async () => (await request<TInvoiceDetail>(`/invoices/${id}`)).data as TInvoiceDetail,
		retry: false,
	});
}

export function billingSummaryQueryOptions(orderId: string, enabled: boolean) {
	return queryOptions({
		queryKey: ['finance', 'billing', orderId] as const,
		queryFn: async () => (await request<TBillingSummary>(`/invoices/orders/${orderId}/summary`)).data as TBillingSummary,
		enabled,
		retry: false,
	});
}

export function receiptsQueryOptions(params: { page?: number; limit?: number; search?: string; status?: 'posted' | 'reversed' }) {
	return queryOptions({
		queryKey: ['finance', 'receipts', params] as const,
		queryFn: async () => {
			const envelope = (await request<(TReceipt & { invoiceCode: string | null; customerName: string })[]>(
				`/receipts${query(params)}`,
			)) as TApiPaginatedResponse<TReceipt & { invoiceCode: string | null; customerName: string }>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export const createInvoice = (input: {
	salesOrderId: string;
	term: TTermInput;
	description: string | null;
	dueDate: string | null;
	notes: string | null;
}) => send<TInvoice>('/invoices', 'POST', input);
export const issueInvoice = (id: string, input: { issueDate: string; dueDate: string | null }) =>
	send<TInvoice>(`/invoices/${id}/issue`, 'POST', input);
export const voidInvoice = (id: string, reason: string) => send<TInvoice>(`/invoices/${id}/void`, 'POST', { reason });
export const addReceipt = (
	id: string,
	input: { amount: number; receivedDate: string; method: TReceiptMethod; reference: string | null; notes: string | null },
) => send<TReceipt>(`/invoices/${id}/receipts`, 'POST', input);
export const reverseReceipt = (id: string, reason: string) => send<TReceipt>(`/receipts/${id}/reverse`, 'POST', { reason });

/** Overdue: issued and unpaid with a due date before today (shown, never stored). */
export function isOverdue(invoice: Pick<TInvoice, 'status' | 'dueDate'>, today: string): boolean {
	return (invoice.status === 'issued' || invoice.status === 'partially_paid') && !!invoice.dueDate && invoice.dueDate < today;
}
