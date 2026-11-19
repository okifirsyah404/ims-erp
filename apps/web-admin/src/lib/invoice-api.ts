import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from './organization-store';
import type { TQuotationCustomerSnapshot } from './quotation-api';
import type { TSalesOrderItem } from './sales-order-api';

/**
 * API client for invoices and receipts (`/sales/invoices`, `/sales/receipts`, ADR-0011
 * step 3d-2). The server computes every amount; previews here are UX only.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** `cancelled` = a draft cancelled before it was issued (Sales invoice API since PR #68). */
export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void', 'cancelled'] as const;
export type TInvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_VARIANT: Record<TInvoiceStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
	draft: 'outline',
	issued: 'secondary',
	partially_paid: 'secondary',
	paid: 'default',
	void: 'outline',
	cancelled: 'outline',
};
export type TInvoiceTermKind = 'down_payment' | 'installment' | 'settlement';

export const RECEIPT_METHODS = ['bank_transfer', 'cash', 'card', 'e_wallet', 'cheque'] as const;
export type TReceiptMethod = (typeof RECEIPT_METHODS)[number];

export type TInvoice = {
	id: string;
	code: string | null;
	termKind: TInvoiceTermKind;
	customerId: string | null;
	companyId: string | null;
	customerSnapshot: TQuotationCustomerSnapshot | null;
	orderId: string | null;
	orderCode: string | null;
	quotationCode: string | null;
	title: string | null;
	description: string | null;
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
	description: string | null;
	percentageBps: number | null;
	grandTotal: number;
	status: TInvoiceStatus;
	payments: { receivedDate: string; method: TReceiptMethod; amount: number }[];
};

export type TInvoiceDetail = TInvoice & {
	items: {
		id: string;
		productId: string | null;
		description: string | null;
		quantity: string;
		unitPrice: number;
		discountAmount: number;
		taxAmount: number;
		lineTotal: number;
	}[];
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
	orderId: string;
	orderCode: string;
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
			const envelope = (await request<TInvoice[]>(`/sales/invoices${query(params)}`)) as TApiPaginatedResponse<TInvoice>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function invoiceQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['finance', 'invoices', id] as const,
		queryFn: async () => (await request<TInvoiceDetail>(`/sales/invoices/${id}`)).data as TInvoiceDetail,
		retry: false,
	});
}

export function billingSummaryQueryOptions(orderId: string, enabled: boolean) {
	return queryOptions({
		queryKey: ['finance', 'billing', orderId] as const,
		queryFn: async () => (await request<TBillingSummary>(`/sales/invoices/orders/${orderId}/summary`)).data as TBillingSummary,
		enabled,
		retry: false,
	});
}

export function receiptsQueryOptions(params: { page?: number; limit?: number; search?: string; status?: 'posted' | 'reversed' }) {
	return queryOptions({
		queryKey: ['finance', 'receipts', params] as const,
		queryFn: async () => {
			const envelope = (await request<(TReceipt & { invoiceCode: string | null; customerName: string })[]>(
				`/sales/receipts${query(params)}`,
			)) as TApiPaginatedResponse<TReceipt & { invoiceCode: string | null; customerName: string }>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export const createInvoice = (input: {
	orderId: string;
	term: TTermInput;
	description: string | null;
	dueDate: string | null;
	notes: string | null;
}) => send<TInvoice>('/sales/invoices', 'POST', input);
export const issueInvoice = (id: string, input: { issueDate: string; dueDate: string | null }) =>
	send<TInvoice>(`/sales/invoices/${id}/issue`, 'POST', input);
export const voidInvoice = (id: string, reason: string) => send<TInvoice>(`/sales/invoices/${id}/void`, 'POST', { reason });
export const addReceipt = (
	id: string,
	input: { amount: number; receivedDate: string; method: TReceiptMethod; reference: string | null; notes: string | null },
) => send<TReceipt>(`/sales/invoices/${id}/receipts`, 'POST', input);
export const reverseReceipt = (id: string, reason: string) => send<TReceipt>(`/sales/receipts/${id}/reverse`, 'POST', { reason });

/* ------------------------- online payment (ERP-0020) ------------------------- */

export const GATEWAY_PAYMENT_STATUSES = ['pending', 'paid', 'expired', 'failed'] as const;
export type TGatewayPaymentStatus = (typeof GATEWAY_PAYMENT_STATUSES)[number];
export const GATEWAY_STATUS_VARIANT: Record<TGatewayPaymentStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
	pending: 'secondary',
	paid: 'default',
	expired: 'outline',
	failed: 'destructive',
};

/** A hosted checkout of an invoice: a `channel = gateway` row of the one payment ledger (`/payments`); amounts in IDR minor units. */
export type TGatewayPayment = {
	id: string;
	code: string;
	channel: string;
	provider: 'xendit' | 'singapay' | 'fake';
	providerReference: string | null;
	paymentUrl: string | null;
	amount: number;
	status: TGatewayPaymentStatus;
	expiresAt: string | null;
	paidAt: string | null;
	paidAmount: number | null;
	paymentChannel: string | null;
	receiptId: string | null;
	settlementNote: string | null;
	createdAt: string;
};

export function gatewayStatusQueryOptions() {
	return queryOptions({
		queryKey: ['finance', 'gateway-status'] as const,
		queryFn: async () =>
			(await request<{ enabled: boolean; provider: string | null }>('/payments/checkouts/status')).data as {
				enabled: boolean;
				provider: string | null;
			},
		staleTime: 5 * 60 * 1000,
	});
}

export function gatewayPaymentsQueryOptions(invoiceId: string) {
	return queryOptions({
		queryKey: ['finance', 'invoices', invoiceId, 'gateway-payments'] as const,
		queryFn: async () => (await request<TGatewayPayment[]>(`/payments/checkouts/invoices/${invoiceId}`)).data as TGatewayPayment[],
	});
}

/** Opens (or reuses) a checkout of the outstanding amount. */
export const openGatewayPayment = (invoiceId: string) => send<TGatewayPayment>(`/payments/checkouts/invoices/${invoiceId}`, 'POST');

/** Overdue: issued and unpaid with a due date before today (shown, never stored). */
export function isOverdue(invoice: Pick<TInvoice, 'status' | 'dueDate'>, today: string): boolean {
	return (invoice.status === 'issued' || invoice.status === 'partially_paid') && !!invoice.dueDate && invoice.dueDate < today;
}
