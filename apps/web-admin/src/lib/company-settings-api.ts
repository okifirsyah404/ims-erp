import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the company settings (`/company-profile`,
 * `/document-numbering`).
 *
 * @remarks
 * Both are company-wide (ADR-0011): one profile and one numbering series per
 * document type, whichever organization (department) is active. Any member
 * may read the profile; the invoice bank accounts come back `null` without
 * `invoice:read` or `company_setting:read`. Saving needs
 * `company_setting:update`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** One bank account printed on invoices. */
export type TInvoiceBankAccount = {
	bankName: string;
	accountNumber: string;
	accountHolder: string;
};

export type TCompanyProfile = {
	legalName: string;
	tradingName: string | null;
	documentCode: string;
	tagline: string | null;
	taxId: string | null;
	addressLine: string | null;
	postalCode: string | null;
	phone: string | null;
	email: string | null;
	website: string | null;
	signatoryName: string | null;
	signatoryTitle: string | null;
	defaultQuotationTerms: string | null;
	defaultInvoiceTerms: string | null;
	warrantyCoverage: string | null;
	warrantyExclusions: string | null;
	warrantyServiceTerms: string | null;
	/** `null` when the caller may not see bank accounts. */
	bankAccounts: { vat: TInvoiceBankAccount | null; nonVat: TInvoiceBankAccount | null } | null;
};

/**
 * What the form sends. Omitting `bankAccounts` leaves them unchanged (the
 * server also ignores them from callers without bank access).
 */
export type TCompanyProfileInput = Omit<TCompanyProfile, 'bankAccounts'> & {
	bankAccounts?: { vat: TInvoiceBankAccount | null; nonVat: TInvoiceBankAccount | null };
};

export const DOCUMENT_TYPES = [
	'quotation',
	'sales_order',
	'invoice',
	'receipt',
	'web_rfq',
	'web_contact',
	'web_demo',
	'purchase_order',
	'goods_receipt',
	'stock_adjustment',
	'delivery_note',
	'project',
	'bast',
	'warranty',
	'service_ticket',
] as const;
export type TDocumentType = (typeof DOCUMENT_TYPES)[number];

export const RESET_POLICIES = ['never', 'yearly', 'monthly'] as const;
export type TResetPolicy = (typeof RESET_POLICIES)[number];

export type TNumberingSetting = {
	documentType: TDocumentType;
	typeCode: string;
	pattern: string;
	resetPolicy: TResetPolicy;
	/** True while the code default applies. */
	isDefault: boolean;
	/** What the next document would get (not reserved). */
	nextNumber: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
	// Success envelopes carry the payload; `null` only where `T` allows it.
	return envelope.data as T;
}

/** The company profile, or `null` before it was first saved. */
export function companyProfileQueryOptions() {
	return queryOptions({
		queryKey: ['company-profile'],
		queryFn: () => request<TCompanyProfile | null>('/company-profile'),
	});
}

export function saveCompanyProfile(input: TCompanyProfileInput) {
	return request<TCompanyProfile>('/company-profile', {
		method: 'PUT',
		body: JSON.stringify(input),
	});
}

/** Every numbering series with its next number. */
export function numberingQueryOptions() {
	return queryOptions({
		queryKey: ['document-numbering'],
		queryFn: () => request<TNumberingSetting[]>('/document-numbering'),
	});
}

/** Renders a pattern without saving it (the server validates it). */
export async function previewNumbering(
	documentType: TDocumentType,
	input: { pattern: string; resetPolicy: TResetPolicy },
) {
	const data = await request<{ nextNumber: string }>(`/document-numbering/${documentType}/preview`, {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return data.nextNumber;
}

export function saveNumbering(
	documentType: TDocumentType,
	input: { pattern: string; resetPolicy: TResetPolicy },
) {
	return request<TNumberingSetting>(`/document-numbering/${documentType}`, {
		method: 'PUT',
		body: JSON.stringify(input),
	});
}
