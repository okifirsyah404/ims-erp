import type { TCompanyBankAccountSelect, TCompanyProfileSelect } from '@drizzle/schemas/organization.schema';
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
 * invoice accounts are saved in one transaction; omitted accounts, or
 * accounts sent by a caller without bank access, are left unchanged.
 */
@injectable()
export class CompanyProfileService {
	constructor(
		@inject(COMPANY_PROFILE_REPOSITORY_TOKEN)
		private readonly repository: ICompanyProfileRepository,
	) {}

	/** The profile, or `null` before it was first saved. */
	async get(includeBanks: boolean): Promise<TCompanyProfileView | null> {
		const profile = await this.repository.findProfile();
		if (!profile) return null;
		return toView(profile, includeBanks ? await this.repository.findInvoiceAccounts() : null);
	}

	async save(
		input: TCompanyProfileInput,
		actorUserId: string,
		includeBanks: boolean,
	): Promise<TCompanyProfileView> {
		const { bankAccounts, ...profile } = input;
		// Callers who may not see the accounts may not change them either.
		const saved = await this.repository.save(
			{ ...profile, updatedBy: actorUserId },
			includeBanks ? bankAccounts : undefined,
		);
		return toView(saved.profile, includeBanks ? saved.accounts : null);
	}
}
