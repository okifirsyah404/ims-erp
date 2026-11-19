import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import {
	COMPANY_ADDRESS_REPOSITORY_TOKEN,
	COMPANY_CONTACT_REPOSITORY_TOKEN,
	COMPANY_PROFILE_REPOSITORY_TOKEN,
} from '../constants/di';
import type { TCompanyProfileSnapshot } from '../contracts/company.contract';
import type {
	ICompanyAddressRepository,
	ICompanyContactRepository,
	ICompanyProfileRepository,
	TCompanyProfileRecord,
} from '../contracts/company.repository.interface';
import { CompanyProfileRequiredError } from '../errors/company.errors';
import { toSnapshot } from '../utils/profile-mapper';

/**
 * Repository-only facade over the company profile.
 *
 * @remarks
 * Every module that prints or numbers documents reads the letterhead and the
 * `{COMPANY}` document code here and never touches `company.*` tables.
 * Depends only on repositories, so a consumer that itself depends on many
 * modules cannot create a cycle. `tx` lets a caller read inside its own
 * transaction (e.g. a number allocated while a document is created).
 */
@injectable()
export class ExportedCompanyService {
	constructor(
		@inject(COMPANY_PROFILE_REPOSITORY_TOKEN)
		private readonly profiles: ICompanyProfileRepository,
		@inject(COMPANY_ADDRESS_REPOSITORY_TOKEN)
		private readonly addresses: ICompanyAddressRepository,
		@inject(COMPANY_CONTACT_REPOSITORY_TOKEN)
		private readonly contacts: ICompanyContactRepository,
	) {}

	private async record(tx?: TTx): Promise<TCompanyProfileRecord | null> {
		const profile = await this.profiles.find(tx);
		if (!profile) return null;
		const [address, contacts] = await Promise.all([
			this.addresses.findPrimary(tx),
			this.contacts.findAll(tx),
		]);
		return { profile, address, contacts };
	}

	/** The letterhead: profile, primary address and primary contacts; `null` before the first save. */
	async getLetterhead(tx?: TTx): Promise<TCompanyProfileSnapshot | null> {
		const record = await this.record(tx);
		return record ? toSnapshot(record) : null;
	}

	/** The `{COMPANY}` token of document numbers (e.g. `IMS`); `null` before the first save. */
	async getDocumentCode(tx?: TTx): Promise<string | null> {
		return (await this.profiles.find(tx))?.documentCode ?? null;
	}

	/**
	 * The `{COMPANY}` token, or an error when the profile was never saved —
	 * what numbering needs, because a document number cannot be issued without it.
	 *
	 * @throws {CompanyProfileRequiredError} Before the profile was first saved
	 */
	async requireDocumentCode(tx?: TTx): Promise<string> {
		const code = await this.getDocumentCode(tx);
		if (!code) throw new CompanyProfileRequiredError();
		return code;
	}

	/** Display name for user-facing surfaces: `tradingName ?? legalName`. */
	async getDisplayName(): Promise<string | null> {
		const profile = await this.profiles.find();
		return profile ? (profile.tradingName ?? profile.legalName) : null;
	}
}
