import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type BankAccountInvoiceUsage,
	companyBankAccounts,
	companyProfiles,
	type TCompanyBankAccountSelect,
	type TCompanyProfileSelect,
} from '@drizzle/schemas/organization.schema';
import type { TTx } from '@drizzle/types';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TInvoiceBankAccount } from '../contracts/company-profile.contract';
import type {
	ICompanyProfileRepository,
	TCompanyProfileData,
	TInvoiceAccountsData,
} from '../contracts/company-profile.repository.interface';

/** Account codes of the two invoice accounts (unique among live accounts). */
const INVOICE_ACCOUNT_CODES: Record<BankAccountInvoiceUsage, string> = {
	vat: 'INVOICE-VAT',
	non_vat: 'INVOICE-NON-VAT',
};

/**
 * Drizzle implementation of {@link ICompanyProfileRepository}.
 *
 * @remarks
 * The profile is a singleton (`company_profiles_singleton_uq`); saving reads
 * the live row and updates it, or inserts the first one. The profile and its
 * invoice accounts commit together in `save`'s own transaction.
 */
@injectable()
export class CompanyProfileRepository implements ICompanyProfileRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findProfile(tx?: TTx): Promise<TCompanyProfileSelect | null> {
		const [row] = await (tx ?? this.database)
			.select()
			.from(companyProfiles)
			.where(isNull(companyProfiles.deletedAt))
			.limit(1);
		return row ?? null;
	}

	save(data: TCompanyProfileData, accounts?: TInvoiceAccountsData) {
		return this.database.transaction(async (tx) => {
			const profile = await this.saveProfile(data, tx);
			if (accounts) {
				await this.saveInvoiceAccount('vat', accounts.vat, tx);
				await this.saveInvoiceAccount('non_vat', accounts.nonVat, tx);
			}
			return { profile, accounts: await this.findInvoiceAccounts(tx) };
		});
	}

	private async saveProfile(data: TCompanyProfileData, tx: TTx): Promise<TCompanyProfileSelect> {
		const now = new Date();
		const existing = await this.findProfile(tx);
		if (existing) {
			const [row] = await tx
				.update(companyProfiles)
				.set({ ...data, updatedAt: now })
				.where(eq(companyProfiles.id, existing.id))
				.returning();
			return row;
		}
		const [row] = await tx
			.insert(companyProfiles)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async setImage(kind: 'logo' | 'signature', key: string | null): Promise<TCompanyProfileSelect | null> {
		const existing = await this.findProfile();
		if (!existing) return null;
		const [row] = await this.database
			.update(companyProfiles)
			.set(kind === 'logo' ? { logoObjectKey: key, updatedAt: new Date() } : { signatureObjectKey: key, updatedAt: new Date() })
			.where(eq(companyProfiles.id, existing.id))
			.returning();
		return row ?? null;
	}

	findInvoiceAccounts(tx?: TTx): Promise<TCompanyBankAccountSelect[]> {
		return (tx ?? this.database)
			.select()
			.from(companyBankAccounts)
			.where(and(isNull(companyBankAccounts.deletedAt), isNotNull(companyBankAccounts.invoiceUsage)));
	}

	/** Sets the account printed for one invoice usage; `null` soft-deletes it. */
	private async saveInvoiceAccount(
		usage: BankAccountInvoiceUsage,
		account: TInvoiceBankAccount | null,
		tx: TTx,
	): Promise<void> {
		const now = new Date();
		const live = and(eq(companyBankAccounts.invoiceUsage, usage), isNull(companyBankAccounts.deletedAt));
		if (!account) {
			await tx.update(companyBankAccounts).set({ deletedAt: now, updatedAt: now }).where(live);
			return;
		}
		const [existing] = await tx.select({ id: companyBankAccounts.id }).from(companyBankAccounts).where(live);
		if (existing) {
			await tx
				.update(companyBankAccounts)
				.set({ ...account, updatedAt: now })
				.where(eq(companyBankAccounts.id, existing.id));
			return;
		}
		await tx.insert(companyBankAccounts).values({
			...account,
			code: INVOICE_ACCOUNT_CODES[usage],
			invoiceUsage: usage,
			createdAt: now,
			updatedAt: now,
		});
	}
}
