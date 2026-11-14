import type {
	TBankAccountSelect,
	TCompanyProfileSelect,
	TCompanySettingSelect,
	TContactSelect,
	THeadOfficeAddressSelect,
} from '@drizzle/schemas/company.schema';
import type { TTx } from '@drizzle/types';
import type {
	TCompanyProfileInput,
	TCompanySettingValueType,
	TInvoiceBankAccount,
} from './company.contract';

/**
 * Flat profile as the repository persists it: the letterhead columns of
 * `company.profiles` plus the primary address and contacts it keeps in sync.
 */
export type TCompanyProfileData = Omit<TCompanyProfileInput, 'bankAccounts'> & {
	updatedBy: string;
};

/** The two invoice accounts; `null` removes one. */
export type TInvoiceAccountsData = {
	vat: TInvoiceBankAccount | null;
	nonVat: TInvoiceBankAccount | null;
};

/** Everything a profile read needs, already joined. */
export type TCompanyProfileRecord = {
	profile: TCompanyProfileSelect;
	address: THeadOfficeAddressSelect | null;
	contacts: TContactSelect[];
};

/** Persistence port for `company.profiles` and the tables it owns. */
export interface ICompanyRepository {
	/** The live profile with its primary address and contacts, if saved. */
	findProfile(tx?: TTx): Promise<TCompanyProfileRecord | null>;

	/** Live bank accounts that are printed on invoices. */
	findInvoiceAccounts(tx?: TTx): Promise<TBankAccountSelect[]>;

	/** Saves the profile, its primary address, contacts and (optionally) invoice accounts. */
	save(
		data: TCompanyProfileData,
		accounts?: TInvoiceAccountsData,
	): Promise<{ record: TCompanyProfileRecord; accounts: TBankAccountSelect[] }>;

	/** Sets (or clears) the logo or signature key of the live profile; `null` when there is none. */
	setImage(kind: 'logo' | 'signature', key: string | null): Promise<TCompanyProfileRecord | null>;

	/** Every live company setting. */
	findSettings(): Promise<TCompanySettingSelect[]>;

	/** The live setting for a group/key, if any. */
	findSetting(group: string, key: string): Promise<TCompanySettingSelect | null>;

	/** Creates or updates the live setting for a group/key. */
	upsertSetting(
		group: string,
		key: string,
		data: { valueType: TCompanySettingValueType; value: string | null; updatedBy: string },
	): Promise<TCompanySettingSelect>;
}
