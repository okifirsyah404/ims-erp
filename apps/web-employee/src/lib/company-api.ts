import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the company profile (`/companies/profile`), settings and branding.
 *
 * @remarks
 * Company-wide (ADR-0011): one profile, whichever organization (department) is
 * active. Any member may read the profile; saving needs `company:update`,
 * settings need `company:read` / `company:update`. Invoice bank accounts are no
 * longer part of the profile: they live in `finance.cash_bank_accounts`
 * (`/finance/cash-bank-accounts`, ADR-0024 Q19). Numbering is per module and has
 * no endpoint here.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** One bank account printed on invoices. */
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
	/** Short-lived inline URLs of the letterhead logo, signature and onboarding image. */
	logoUrl: string | null;
	signatureUrl: string | null;
	onboardingUrl: string | null;
	/**
	 * Always absent since ADR-0024 (bank accounts moved to finance); kept optional
	 * only so the invoice document keeps compiling.
	 * @deprecated
	 */
};

/**
 * What the form sends. The endpoint is a patch: an omitted field keeps its
 * stored value, so the form only sends the fields it still edits.
 */
export type TCompanyProfileInput = Partial<
	Omit<TCompanyProfile, 'logoUrl' | 'signatureUrl'>
>;

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
		queryFn: () => request<TCompanyProfile | null>('/companies/profile'),
	});
}

/** Public branding for the login page (`GET /companies/branding`, no session). */
export type TCompanyBranding = {
	name: string | null;
	onboardingUrl: string | null;
};

export function companyBrandingQueryOptions() {
	return queryOptions({
		queryKey: ['company-branding'],
		queryFn: () => request<TCompanyBranding>('/companies/branding'),
	});
}

export function saveCompanyProfile(input: TCompanyProfileInput) {
	return request<TCompanyProfile>('/companies/profile', {
		method: 'PUT',
		body: JSON.stringify(input),
	});
}

export const COMPANY_SETTING_VALUE_TYPES = ['string', 'number', 'boolean', 'json', 'date'] as const;
export type TCompanySettingValueType = (typeof COMPANY_SETTING_VALUE_TYPES)[number];

/** One company setting. Plain text value; typing is checked on save. */
export type TCompanySetting = {
	settingGroup: string;
	settingKey: string;
	valueType: TCompanySettingValueType;
	value: string | null;
};

export function companySettingsQueryOptions() {
	return queryOptions({
		queryKey: ['company-settings'],
		queryFn: () => request<TCompanySetting[]>('/companies/settings'),
	});
}

export function saveCompanySetting(
	group: string,
	key: string,
	input: { valueType: TCompanySettingValueType; value: string | null },
) {
	return request<TCompanySetting>(`/companies/settings/${encodeURIComponent(group)}/${encodeURIComponent(key)}`, {
		method: 'PUT',
		body: JSON.stringify(input),
	});
}
