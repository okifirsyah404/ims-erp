import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import type { TItemUnitLabel } from './inventory-api';
import type { TPerson } from './lead-api';

/**
 * API client for quotations / SPH (`/sales/quotations`, ADR-0011 step 3c).
 *
 * @remarks
 * Quotations are company-wide. The server decides visibility (approvers and
 * auditors see all, billing staff see deals, everyone else their own) and
 * recomputes every total; the previews here are UX only.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const QUOTATION_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'rejected',
	'sent',
	'superseded',
	'won',
	'lost',
] as const;
export type TQuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_STATUS_VARIANT: Record<TQuotationStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
	draft: 'outline',
	submitted: 'secondary',
	approved: 'secondary',
	rejected: 'destructive',
	sent: 'secondary',
	superseded: 'outline',
	won: 'default',
	lost: 'outline',
};

/** Statuses that can still be closed as lost ("Batal"). */
export const QUOTATION_OPEN_STATUSES: readonly TQuotationStatus[] = ['draft', 'submitted', 'approved', 'rejected', 'sent'];

export const QUOTATION_LOST_REASONS = ['price', 'competitor', 'project_cancelled', 'no_response', 'other'] as const;
export type TQuotationLostReason = (typeof QUOTATION_LOST_REASONS)[number];

/** Default VAT (11% effective), owner decision 2026-10-31; the server applies the same. */
export const DEFAULT_VAT_RATE_BPS = 1100;

export type TPaymentScheduleItem = { label: string; percentBps: number };

export type TQuotationCustomerSnapshot = {
	code: string;
	name: string;
	type: string;
	email: string | null;
	phone: string | null;
	whatsapp: string | null;
	taxId: string | null;
	addressLine: string | null;
	postalCode: string | null;
};

export type TQuotation = {
	id: string;
	code: string;
	baseCode: string;
	revision: number;
	title: string;
	customerId: string;
	customerContactId: string | null;
	customerSnapshot: TQuotationCustomerSnapshot;
	leadId: string | null;
	attention: string | null;
	status: TQuotationStatus;
	/** `YYYY-MM-DD` (Asia/Jakarta). */
	quotationDate: string;
	validUntil: string | null;
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
	terms: string | null;
	createdBy: string | null;
	rejectedReason: string | null;
	lostReason: TQuotationLostReason | null;
	lostNote: string | null;
	createdAt: string;
	/** End of the valid-until Jakarta day (unix ms); informational. */
	expiresAt: number | null;
	expired: boolean;
};

export type TQuotationItem = {
	id: string;
	itemId: string | null;
	sku: string | null;
	name: string;
	specification: string | null;
	unit: TItemUnitLabel;
	/** Decimal string, up to three decimals. */
	quantity: string;
	unitPrice: number;
	discountAmount: number;
	lineTotal: number;
	sortOrder: number;
};

export type TQuotationHistoryEntry = {
	id: string;
	fromStatus: TQuotationStatus | null;
	toStatus: TQuotationStatus;
	changedAt: string;
	note: string | null;
	by: TPerson | null;
};

export type TQuotationDetail = TQuotation & {
	items: TQuotationItem[];
	revisions: Pick<TQuotation, 'id' | 'code' | 'revision' | 'status' | 'grandTotal' | 'createdAt'>[];
	history: TQuotationHistoryEntry[];
	creator: TPerson | null;
	approver: TPerson | null;
};

export type TQuotationLineInput = {
	itemId: string | null;
	name: string | null;
	specification: string | null;
	unit: TItemUnitLabel | null;
	quantity: string;
	unitPrice: number | null;
	discountAmount: number;
};

export type TQuotationInput = {
	customerId: string;
	customerContactId: string | null;
	title: string;
	attention: string | null;
	paymentTerms: string | null;
	paymentSchedule: TPaymentScheduleItem[] | null;
	guarantee: string | null;
	quotationDate: string;
	validUntil: string | null;
	vatEnabled: boolean;
	vatRateBps: number | null;
	notes: string | null;
	terms: string | null;
	lines: TQuotationLineInput[];
};

export type TQuotationListParams = {
	page?: number;
	limit?: number;
	search?: string;
	status?: TQuotationStatus;
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

export function quotationsQueryOptions(params: TQuotationListParams) {
	return queryOptions({
		queryKey: ['sales', 'quotations', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TQuotation[]>(
				`/sales/quotations${search.size ? `?${search}` : ''}`,
			)) as TApiPaginatedResponse<TQuotation>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function quotationQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['sales', 'quotations', id] as const,
		queryFn: async () => (await request<TQuotationDetail>(`/sales/quotations/${id}`)).data as TQuotationDetail,
		retry: false,
	});
}

export const createQuotation = (input: TQuotationInput) => send<TQuotation>('/sales/quotations', 'POST', input);
export const updateQuotation = (id: string, input: TQuotationInput) =>
	send<TQuotation>(`/sales/quotations/${id}`, 'PATCH', input);
export const submitQuotation = (id: string) => send<TQuotation>(`/sales/quotations/${id}/submit`, 'POST');
export const decideQuotation = (id: string, decision: 'approve' | 'reject', reason?: string) =>
	send<TQuotation>(`/sales/quotations/${id}/decision`, 'POST', { decision, reason });
export const reviseQuotation = (id: string) => send<TQuotation>(`/sales/quotations/${id}/revisions`, 'POST');
export const sendQuotation = (id: string) => send<TQuotation>(`/sales/quotations/${id}/send`, 'POST');
export const markQuotationLost = (id: string, reason: TQuotationLostReason, note?: string) =>
	send<TQuotation>(`/sales/quotations/${id}/lost`, 'POST', { reason, note });

/** round(quantity × price) for a decimal quantity with up to three decimals (UX preview). */
export function previewLineTotal(line: Pick<TQuotationLineInput, 'quantity' | 'unitPrice' | 'discountAmount'>): number {
	const quantity = Number(line.quantity);
	if (!Number.isFinite(quantity) || line.unitPrice == null) return 0;
	return Math.round(Math.round(quantity * 1000) * line.unitPrice / 1000) - line.discountAmount;
}

/** Subtotal, discounts, VAT and total as the server computes them (UX preview). */
export function previewTotals(lines: TQuotationLineInput[], vatEnabled: boolean, vatRateBps: number) {
	const discountTotal = lines.reduce((sum, line) => sum + line.discountAmount, 0);
	const subtotal = lines.reduce((sum, line) => sum + previewLineTotal(line) + line.discountAmount, 0);
	const taxBase = subtotal - discountTotal;
	const taxTotal = vatEnabled ? Math.round((taxBase * vatRateBps) / 10_000) : 0;
	return { subtotal, discountTotal, taxTotal, grandTotal: taxBase + taxTotal };
}
