import type {
	TCompanyBankAccountSelect,
	TCompanyProfileSelect,
} from '@drizzle/schemas/organization.schema';
import type { TTx } from '@drizzle/types';
import type { TCompanyProfileInput, TInvoiceBankAccount } from './company-profile.contract';

export type TCompanyProfileData = Omit<TCompanyProfileInput, 'bankAccounts'> & { updatedBy: string };

/** The two invoice accounts; `null` removes one. */
export type TInvoiceAccountsData = {
	vat: TInvoiceBankAccount | null;
	nonVat: TInvoiceBankAccount | null;
};

/** Persistence port for the company profile and its invoice bank accounts. */
export interface ICompanyProfileRepository {
	/** The live company profile, if one was saved. */
	findProfile(tx?: TTx): Promise<TCompanyProfileSelect | null>;

	/** Live bank accounts that are printed on invoices. */
	findInvoiceAccounts(tx?: TTx): Promise<TCompanyBankAccountSelect[]>;

	/**
	 * Creates or updates the profile and, when `accounts` is given, sets both
	 * invoice accounts (`null` soft-deletes one) — all in one transaction.
	 *
	 * @returns The saved profile and the live invoice accounts afterwards
	 */
	save(
		data: TCompanyProfileData,
		accounts?: TInvoiceAccountsData,
	): Promise<{ profile: TCompanyProfileSelect; accounts: TCompanyBankAccountSelect[] }>;
}

