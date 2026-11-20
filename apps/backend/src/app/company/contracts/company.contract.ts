import { z } from 'zod';

/** Trimmed optional text; empty becomes `null`. */
const text = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.transform((v) => (v.length === 0 ? null : v))
		.nullish()
		.transform((v) => v ?? null);

/**
 * Editable company profile (letterhead, signatory, default terms).
 *
 * @remarks
 * The flat shape is the API contract. Storage is split: the letterhead
 * address lives in `company.addresses`, the phone, email and website in
 * `company.contacts`. The service keeps them in sync, so clients never see
 * the split. Invoice bank accounts moved to `finance.cash_bank_accounts`
 * (ADR-0024 Q19) and are no longer part of this contract.
 */
export const companyProfileSchema = z.object({
	legalName: z.string().trim().min(1).max(200),
	tradingName: text(200),
	/** Company code in document numbers (`{COMPANY}`), e.g. `IMS`. */
	documentCode: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z0-9]{1,16}$/),
	tagline: text(300),
	taxId: text(32),
	addressLine: text(1000),
	postalCode: text(10),
	phone: text(100),
	email: z
		.union([z.literal(''), z.email().max(200)])
		.nullish()
		.transform((v) => (v ? v : null)),
	website: text(200),
	signatoryName: text(200),
	signatoryTitle: text(100),
	defaultQuotationTerms: text(8000),
	defaultInvoiceTerms: text(8000),
	warrantyCoverage: text(8000),
	warrantyExclusions: text(8000),
	warrantyServiceTerms: text(8000),
});

export type TCompanyProfileInput = z.output<typeof companyProfileSchema>;

/**
 * `PUT /company/profile` body. Omitted fields keep their stored value; a
 * present `null` clears a text field.
 */
export const companyProfilePatchSchema = companyProfileSchema.partial();
export type TCompanyProfilePatch = z.output<typeof companyProfilePatchSchema>;

/** What clients get. */
export type TCompanyProfileView = TCompanyProfileInput & {
	/** Short-lived inline URLs of the letterhead logo, signature and onboarding image. */
	logoUrl: string | null;
	signatureUrl: string | null;
	onboardingUrl: string | null;
};

/**
 * Letterhead snapshot other modules render (documents, warranty, invoices).
 *
 * @remarks
 * Read-only projection of the flat profile plus the object-storage keys, so a
 * consumer never touches `company.*` tables directly.
 */
export type TCompanyProfileSnapshot = TCompanyProfileInput & {
	logoObjectKey: string | null;
	signatureObjectKey: string | null;
	onboardingObjectKey: string | null;
};

/** Images on the profile: the letterhead logo, signature and onboarding image. */
export type TCompanyImageKind = 'logo' | 'signature' | 'onboarding';

/**
 * Public branding for unauthenticated surfaces (the login page). Only the
 * display name and the onboarding image URL — no legal, tax or contact data.
 */
export type TCompanyBranding = {
	/** `tradingName ?? legalName`, or `null` before the profile was first saved. */
	name: string | null;
	/** Short-lived inline URL of the onboarding image; `null` when absent. */
	onboardingUrl: string | null;
};

/** Must match the `settings_value_type_check` constraint in `company.settings`. */
export const COMPANY_SETTING_VALUE_TYPES = ['string', 'number', 'boolean', 'json', 'date'] as const;
export type TCompanySettingValueType = (typeof COMPANY_SETTING_VALUE_TYPES)[number];

/** `group` and `key` of a setting: lower-case segments, e.g. `invoice` / `due_days`. */
const settingSegment = z
	.string()
	.trim()
	.regex(/^[a-z][a-z0-9_]{0,63}$/);

export const companySettingParamsSchema = z.object({
	group: settingSegment,
	key: settingSegment,
});

/**
 * Upsert body. `value: null` clears the value but keeps the row. Type checks
 * (number, boolean, json, date) run in the service, not in the database.
 */
export const companySettingInputSchema = z.object({
	valueType: z.enum(COMPANY_SETTING_VALUE_TYPES),
	value: z.string().max(4000).nullable(),
});

export type TCompanySettingInput = z.output<typeof companySettingInputSchema>;

/** One company setting as clients see it. Secrets are not part of this contract (ERP-0045). */
export type TCompanySettingView = {
	settingGroup: string;
	settingKey: string;
	valueType: TCompanySettingValueType;
	value: string | null;
};
