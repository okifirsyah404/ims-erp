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

/** Editable company profile (letterhead, signatory, banks, default terms). */
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
type TInvoiceBankAccounts = NonNullable<TCompanyProfileInput['bankAccounts']>;
export type TInvoiceBankAccount = NonNullable<TInvoiceBankAccounts['vat']>;

/** What clients get; `bankAccounts` is `null` for callers without access. */
export type TCompanyProfileView = Omit<TCompanyProfileInput, 'bankAccounts'> & {
	bankAccounts: TInvoiceBankAccounts | null;
	/** Short-lived inline URLs of the letterhead logo and the signature image. */
	logoUrl: string | null;
	signatureUrl: string | null;
};

/** Images on the profile: the letterhead logo and the signature with stamp. */
export type TCompanyImageKind = 'logo' | 'signature';
