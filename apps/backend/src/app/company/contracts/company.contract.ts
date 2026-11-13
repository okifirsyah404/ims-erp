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

/** One bank account printed on invoices; `null` removes it. */
const invoiceBankAccountSchema = z
	.object({
		bankName: z.string().trim().min(1).max(100),
		accountNumber: z
			.string()
			.trim()
			.min(1)
			.max(50)
			.regex(/^[0-9 .-]+$/),
		accountHolder: z.string().trim().min(1).max(200),
	})
	.nullable();

/**
 * Editable company profile (letterhead, signatory, banks, default terms).
 *
 * @remarks
 * The flat shape is the API contract. Storage is split since ERP-0042: the
 * letterhead address lives in `company.head_office_addresses`, the phone,
 * email and website in `company.contacts`. The repository keeps them in sync,
 * so clients never see the split.
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
	/**
	 * Omitted = leave the accounts unchanged (callers who may not see them
	 * must not blank them by saving the profile).
	 */
	bankAccounts: z
		.object({
			/** Printed on invoices with VAT. */
			vat: invoiceBankAccountSchema,
			/** Printed on invoices without VAT. */
			nonVat: invoiceBankAccountSchema,
		})
		.optional(),
});

export type TCompanyProfileInput = z.output<typeof companyProfileSchema>;

/**
 * `PUT /company/profile` body. Omitted fields keep their stored value; a
 * present `null` clears a text field.
 */
export const companyProfilePatchSchema = companyProfileSchema.partial();
export type TCompanyProfilePatch = z.output<typeof companyProfilePatchSchema>;
type TInvoiceBankAccounts = NonNullable<TCompanyProfileInput['bankAccounts']>;
export type TInvoiceBankAccount = NonNullable<TInvoiceBankAccounts['vat']>;

/** What clients get; `bankAccounts` is `null` for callers without access. */
export type TCompanyProfileView = Omit<TCompanyProfileInput, 'bankAccounts'> & {
	bankAccounts: TInvoiceBankAccounts | null;
	/** Short-lived inline URLs of the letterhead logo and the signature image. */
	logoUrl: string | null;
	signatureUrl: string | null;
};

/**
 * Letterhead snapshot other modules render (documents, warranty, invoices).
 *
 * @remarks
 * Read-only projection of the flat profile plus the object-storage keys, so a
 * consumer never touches `company.*` tables directly.
 */
export type TCompanyProfileSnapshot = Omit<
	TCompanyProfileView,
	'bankAccounts' | 'logoUrl' | 'signatureUrl'
> & {
	logoObjectKey: string | null;
	signatureObjectKey: string | null;
};

/** Images on the profile: the letterhead logo and the signature with stamp. */
export type TCompanyImageKind = 'logo' | 'signature';

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
