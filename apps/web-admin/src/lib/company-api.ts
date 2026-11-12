import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the company profile (`/company/profile`) and the code
 * numbering series (`/code-numbers`).
 *
 * @remarks
 * Both are company-wide (ADR-0011): one profile and one numbering series per
 * code type, whichever organization (department) is active. Any member may
 * read the profile; the invoice bank accounts come back `null` without
 * `invoice:read` or `company:read`. Saving needs `company:update`, numbering
 * needs `code_number:read` / `code_number:update`.
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
	/** Short-lived inline URLs of the letterhead logo and the signature image. */
	logoUrl: string | null;
	signatureUrl: string | null;
	/** `null` when the caller may not see bank accounts. */
	bankAccounts: { vat: TInvoiceBankAccount | null; nonVat: TInvoiceBankAccount | null } | null;
};

/**
 * What the form sends. Omitting `bankAccounts` leaves them unchanged (the
 * server also ignores them from callers without bank access).
 */
export type TCompanyProfileInput = Omit<TCompanyProfile, 'bankAccounts' | 'logoUrl' | 'signatureUrl'> & {
	bankAccounts?: { vat: TInvoiceBankAccount | null; nonVat: TInvoiceBankAccount | null };
};

export const RESET_POLICIES = ['never', 'yearly', 'monthly'] as const;
export type TResetPolicy = (typeof RESET_POLICIES)[number];

/** Every code type the numbering authority serves (mirrors `CODE_TYPES`). */
export const CODE_TYPES = [
	'quotation',
	'sales_order',
	'sales_invoice',
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
	'license_contract',
	'stock_movement',
	'asset',
	'asset_maintenance',
	'asset_disposal',
	'asset_tool_set',
	'asset_borrowing',
	'bank_reconciliation',
	'cash_bank_transaction',
	'payment',
	'journal_entry',
	'supplier_bill',
	'employee',
	'warehouse',
] as const;
export type TCodeType = (typeof CODE_TYPES)[number];

export type TCodeNumberSetting = {
	codeType: TCodeType;
	typeCode: string;
	pattern: string;
	resetPolicy: TResetPolicy;
	/** True while the code default applies. */
	isDefault: boolean;
	/** What the next number would get (not reserved). */
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
		queryFn: () => request<TCompanyProfile | null>('/company/profile'),
	});
}

export function saveCompanyProfile(input: TCompanyProfileInput) {
	return request<TCompanyProfile>('/company/profile', {
		method: 'PUT',
		body: JSON.stringify(input),
	});
}

/** Every numbering series with its next number. */
export function numberingQueryOptions() {
	return queryOptions({
		queryKey: ['code-numbers'],
		queryFn: () => request<TCodeNumberSetting[]>('/code-numbers'),
	});
}

/** Renders a pattern without saving it (the server validates it). */
export async function previewNumbering(
	codeType: TCodeType,
	input: { pattern: string; resetPolicy: TResetPolicy },
) {
	const data = await request<{ nextNumber: string }>(`/code-numbers/${codeType}/preview`, {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return data.nextNumber;
}

export function saveNumbering(codeType: TCodeType, input: { pattern: string; resetPolicy: TResetPolicy }) {
	return request<TCodeNumberSetting>(`/code-numbers/${codeType}`, {
		method: 'PUT',
		body: JSON.stringify(input),
	});
}
