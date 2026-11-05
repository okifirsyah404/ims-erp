import type {
	BankAccountInvoiceUsage,
	TCompanyBankAccountSelect,
	TCompanyProfileSelect,
} from '@drizzle/schemas/organization.schema';
import type { TTx } from '@drizzle/types';
import type { TCompanyProfileInput, TInvoiceBankAccount } from './company-profile.contract';

export type TCompanyProfileData = Omit<TCompanyProfileInput, 'bankAccounts'> & { updatedBy: string };

/** Persistence port for the company profile and its invoice bank accounts. */
export interface ICompanyProfileRepository {
	/** The live company profile, if one was saved. */
	findProfile(tx?: TTx): Promise<TCompanyProfileSelect | null>;

	/** Creates the profile or updates the live one. */
	saveProfile(data: TCompanyProfileData, tx?: TTx): Promise<TCompanyProfileSelect>;

	/** Live bank accounts that are printed on invoices. */
	findInvoiceAccounts(tx?: TTx): Promise<TCompanyBankAccountSelect[]>;

	/**
	 * Sets the account printed for one invoice usage; `null` soft-deletes it.
	 */
	saveInvoiceAccount(
		usage: BankAccountInvoiceUsage,
		account: TInvoiceBankAccount | null,
		tx?: TTx,
	): Promise<void>;
}
