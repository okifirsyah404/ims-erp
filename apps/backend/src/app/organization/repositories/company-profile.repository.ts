import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
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
import type { ICacheClient } from '@cache/cache.client';
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

/** Redis key for the cached singleton profile row. */
const PROFILE_CACHE_KEY = 'organization:company-profile:singleton';

/** Redis key for the cached invoice bank-account list. */
const INVOICE_ACCOUNTS_CACHE_KEY = 'organization:company-profile:invoice-accounts';

/**
 * Drizzle + Redis implementation of {@link ICompanyProfileRepository}.
 *
 * @remarks
 * The profile is a singleton (`company_profiles_singleton_uq`); saving reads
 * the live row and updates it, or inserts the first one. The profile and its
 * invoice accounts commit together in `save`'s own transaction.
 *
 * @remarks
 * Both reads are hot (every invoice render touches them) and nearly
 * immutable, so they use cache-aside with a 5-minute TTL and negative
 * caching for the absent-profile case; `save` and `setImage` evict both
 * keys after the transaction commits.
 */
@injectable()
export class CompanyProfileRepository implements ICompanyProfileRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	async findProfile(tx?: TTx): Promise<TCompanyProfileSelect | null> {
		// Transactional callers need read-your-writes inside `save`.
		if (tx) {
			const [row] = await tx
				.select()
				.from(companyProfiles)
				.where(isNull(companyProfiles.deletedAt))
				.limit(1);
			return row ?? null;
		}

		return this.cache.remember(PROFILE_CACHE_KEY, async () => {
			const [row] = await this.database
				.select()
				.from(companyProfiles)
				.where(isNull(companyProfiles.deletedAt))
				.limit(1);
			return row ?? null;
		});
	}

	async save(data: TCompanyProfileData, accounts?: TInvoiceAccountsData) {
		const result = await this.database.transaction(async (tx) => {
			const profile = await this.saveProfile(data, tx);
			if (accounts) {
				await this.saveInvoiceAccount('vat', accounts.vat, tx);
				await this.saveInvoiceAccount('non_vat', accounts.nonVat, tx);
			}
			return { profile, accounts: await this.findInvoiceAccounts(tx) };
		});

		await this.cache.del(PROFILE_CACHE_KEY, INVOICE_ACCOUNTS_CACHE_KEY);
		return result;
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
		if (row) await this.cache.del(PROFILE_CACHE_KEY);
		return row ?? null;
	}

	findInvoiceAccounts(tx?: TTx): Promise<TCompanyBankAccountSelect[]> {
		// Transactional callers need read-your-writes inside `save`.
		if (tx) {
			return tx
				.select()
				.from(companyBankAccounts)
				.where(and(isNull(companyBankAccounts.deletedAt), isNotNull(companyBankAccounts.invoiceUsage)));
		}

		return this.cache.remember(INVOICE_ACCOUNTS_CACHE_KEY, () =>
			this.database
				.select()
				.from(companyBankAccounts)
				.where(and(isNull(companyBankAccounts.deletedAt), isNotNull(companyBankAccounts.invoiceUsage))),
		);
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
