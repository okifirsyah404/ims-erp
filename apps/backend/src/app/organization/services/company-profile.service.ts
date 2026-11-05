import { DRIZZLE_TOKEN } from '@di/provider';
import type { TCompanyBankAccountSelect, TCompanyProfileSelect } from '@drizzle/schemas/organization.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { COMPANY_PROFILE_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TCompanyProfileInput,
	TCompanyProfileView,
	TInvoiceBankAccount,
} from '../contracts/company-profile.contract';
import type { ICompanyProfileRepository } from '../contracts/company-profile.repository.interface';

function toAccount(row: TCompanyBankAccountSelect | undefined): TInvoiceBankAccount | null {
	return row ? { bankName: row.bankName, accountNumber: row.accountNumber, accountHolder: row.accountHolder } : null;
}

function toView(
	profile: TCompanyProfileSelect,
	accounts: TCompanyBankAccountSelect[] | null,
): TCompanyProfileView {
	return {
		legalName: profile.legalName,
		tradingName: profile.tradingName,
		documentCode: profile.documentCode,
		tagline: profile.tagline,
		taxId: profile.taxId,
		addressLine: profile.addressLine,
		postalCode: profile.postalCode,
		phone: profile.phone,
		email: profile.email,
		website: profile.website,
		signatoryName: profile.signatoryName,
		signatoryTitle: profile.signatoryTitle,
		defaultQuotationTerms: profile.defaultQuotationTerms,
		defaultInvoiceTerms: profile.defaultInvoiceTerms,
		warrantyCoverage: profile.warrantyCoverage,
		warrantyExclusions: profile.warrantyExclusions,
		warrantyServiceTerms: profile.warrantyServiceTerms,
		bankAccounts: accounts
			? {
					vat: toAccount(accounts.find((a) => a.invoiceUsage === 'vat')),
					nonVat: toAccount(accounts.find((a) => a.invoiceUsage === 'non_vat')),
				}
			: null,
	};
}

/**
 * Company profile use cases: one profile for the whole company (ADR-0011).
 *
 * @remarks
 * Readable by every organization member because every print needs the
 * letterhead; the invoice bank accounts only when `includeBanks` (decided
 * by the controller from the caller's grants). The profile and its two
 * invoice accounts are saved in one transaction.
 */
@injectable()
export class CompanyProfileService {
	constructor(
		@inject(COMPANY_PROFILE_REPOSITORY_TOKEN)
		private readonly repository: ICompanyProfileRepository,
		/** The live Drizzle handle, for the service-owned transaction boundary. */
		@inject(DRIZZLE_TOKEN)
		private readonly database: BunSQLDatabase,
	) {}

	/** The profile, or `null` before it was first saved. */
	async get(includeBanks: boolean): Promise<TCompanyProfileView | null> {
		const profile = await this.repository.findProfile();
		if (!profile) return null;
		return toView(profile, includeBanks ? await this.repository.findInvoiceAccounts() : null);
	}

	async save(input: TCompanyProfileInput, actorUserId: string): Promise<TCompanyProfileView> {
		const { bankAccounts, ...profile } = input;
		return this.database.transaction(async (tx) => {
			const saved = await this.repository.saveProfile({ ...profile, updatedBy: actorUserId }, tx);
			await this.repository.saveInvoiceAccount('vat', bankAccounts.vat, tx);
			await this.repository.saveInvoiceAccount('non_vat', bankAccounts.nonVat, tx);
			return toView(saved, await this.repository.findInvoiceAccounts(tx));
		});
	}
}
