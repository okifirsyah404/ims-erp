import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	type BankAccountInvoiceUsage,
	bankAccounts,
	companyProfiles,
	companySettings,
	contacts,
	headOfficeAddresses,
	type TBankAccountSelect,
	type TCompanyProfileSelect,
	type TCompanySettingSelect,
} from '@drizzle/schemas/company.schema';
import type { TTx } from '@drizzle/types';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ICacheClient } from '@cache/cache.client';
import type {
	TCompanySettingValueType,
	TInvoiceBankAccount,
} from '../contracts/company.contract';
import type {
	ICompanyRepository,
	TCompanyProfileData,
	TCompanyProfileRecord,
	TInvoiceAccountsData,
} from '../contracts/company.repository.interface';

/** Account codes of the two invoice accounts (unique among live accounts). */
const INVOICE_ACCOUNT_CODES: Record<BankAccountInvoiceUsage, string> = {
	vat: 'INVOICE-VAT',
	non_vat: 'INVOICE-NON-VAT',
};

/**
 * Contact channels kept in sync with the flat profile contract: phone and
 * email are primary (printed on the letterhead), the website is not.
 */
const PROFILE_CONTACTS = [
	{ field: 'phone', contactType: 'phone', label: 'Phone', isPrimary: true },
	{ field: 'email', contactType: 'email', label: 'Email', isPrimary: true },
	{ field: 'website', contactType: 'other', label: 'Website', isPrimary: false },
] as const;

/** Redis key for the cached singleton profile record. */
const PROFILE_CACHE_KEY = 'company:profile:singleton';

/** Redis key for the cached invoice bank-account list. */
const INVOICE_ACCOUNTS_CACHE_KEY = 'company:profile:invoice-accounts';

/**
 * Drizzle + Redis implementation of {@link ICompanyRepository}.
 *
 * @remarks
 * The profile is a singleton (`profiles_singleton_uq`); saving reads the live
 * row and updates it, or inserts the first one. The profile, its primary
 * address, its contacts and the invoice accounts commit together in `save`'s
 * own transaction.
 *
 * @remarks
 * Both reads are hot (every invoice render touches them) and nearly
 * immutable, so they use cache-aside with a 5-minute TTL and negative
 * caching for the absent-profile case; `save` and `setImage` evict both
 * keys after the transaction commits.
 */
@injectable()
export class CompanyRepository implements ICompanyRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	async findProfile(tx?: TTx): Promise<TCompanyProfileRecord | null> {
		// Transactional callers need read-your-writes inside `save`.
		if (tx) return this.readProfile(tx);
		return this.cache.remember(PROFILE_CACHE_KEY, () => this.readProfile(this.database));
	}

	private async readProfile(database: TTx | BunSQLDatabase): Promise<TCompanyProfileRecord | null> {
		const [profile] = await database
			.select()
			.from(companyProfiles)
			.where(isNull(companyProfiles.deletedAt))
			.limit(1);
		if (!profile) return null;

		const [address] = await database
			.select()
			.from(headOfficeAddresses)
			.where(and(isNull(headOfficeAddresses.deletedAt), eq(headOfficeAddresses.isPrimary, true)))
			.limit(1);
		const liveContacts = await database
			.select()
			.from(contacts)
			.where(isNull(contacts.deletedAt));

		return { profile, address: address ?? null, contacts: liveContacts };
	}

	async save(
		data: TCompanyProfileData,
		accounts?: TInvoiceAccountsData,
	): Promise<{ record: TCompanyProfileRecord; accounts: TBankAccountSelect[] }> {
		const result = await this.database.transaction(async (tx) => {
			await this.saveProfile(data, tx);
			await this.saveAddress(data, tx);
			await this.saveContacts(data, tx);
			if (accounts) {
				await this.saveInvoiceAccount('vat', accounts.vat, tx);
				await this.saveInvoiceAccount('non_vat', accounts.nonVat, tx);
			}
			const record = await this.readProfile(tx);
			if (!record) throw new Error('Company profile disappeared inside its own transaction');
			return { record, accounts: await this.findInvoiceAccounts(tx) };
		});

		await this.cache.del(PROFILE_CACHE_KEY, INVOICE_ACCOUNTS_CACHE_KEY);
		return result;
	}

	private async saveProfile(data: TCompanyProfileData, tx: TTx): Promise<TCompanyProfileSelect> {
		const now = new Date();
		const {
			addressLine: _addressLine,
			postalCode: _postalCode,
			phone: _phone,
			email: _email,
			website: _website,
			...profile
		} = data;
		const [existing] = await tx
			.select({ id: companyProfiles.id })
			.from(companyProfiles)
			.where(isNull(companyProfiles.deletedAt))
			.limit(1);
		if (existing) {
			const [row] = await tx
				.update(companyProfiles)
				.set({ ...profile, updatedAt: now })
				.where(eq(companyProfiles.id, existing.id))
				.returning();
			return row;
		}
		const [row] = await tx
			.insert(companyProfiles)
			.values({ ...profile, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	/** Keeps exactly one live primary address; `null` soft-deletes it. */
	private async saveAddress(
		data: Pick<TCompanyProfileData, 'addressLine' | 'postalCode'>,
		tx: TTx,
	): Promise<void> {
		const now = new Date();
		const [existing] = await tx
			.select({ id: headOfficeAddresses.id })
			.from(headOfficeAddresses)
			.where(and(isNull(headOfficeAddresses.deletedAt), eq(headOfficeAddresses.isPrimary, true)))
			.limit(1);

		if (!data.addressLine) {
			if (existing) {
				await tx
					.update(headOfficeAddresses)
					.set({ deletedAt: now, updatedAt: now })
					.where(eq(headOfficeAddresses.id, existing.id));
			}
			return;
		}
		if (existing) {
			await tx
				.update(headOfficeAddresses)
				.set({ addressLine: data.addressLine, postalCode: data.postalCode, updatedAt: now })
				.where(eq(headOfficeAddresses.id, existing.id));
			return;
		}
		await tx.insert(headOfficeAddresses).values({
			addressLine: data.addressLine,
			postalCode: data.postalCode,
			isPrimary: true,
			createdAt: now,
			updatedAt: now,
		});
	}

	/** Keeps one live row per letterhead contact; a `null` value removes it. */
	private async saveContacts(data: TCompanyProfileData, tx: TTx): Promise<void> {
		const now = new Date();
		const live = await tx
			.select({ id: contacts.id, contactType: contacts.contactType })
			.from(contacts)
			.where(isNull(contacts.deletedAt));

		for (const { field, contactType, label, isPrimary } of PROFILE_CONTACTS) {
			const value = data[field];
			const existing = live.find((row) => row.contactType === contactType);
			if (!value) {
				if (existing) {
					await tx
						.update(contacts)
						.set({ deletedAt: now, updatedAt: now })
						.where(eq(contacts.id, existing.id));
				}
				continue;
			}
			if (existing) {
				await tx
					.update(contacts)
					.set({ value, label, isPrimary, updatedAt: now })
					.where(eq(contacts.id, existing.id));
				continue;
			}
			await tx
				.insert(contacts)
				.values({ contactType, value, label, isPrimary, createdAt: now, updatedAt: now });
		}
	}

	async setImage(
		kind: 'logo' | 'signature',
		key: string | null,
	): Promise<TCompanyProfileRecord | null> {
		const [existing] = await this.database
			.select({ id: companyProfiles.id })
			.from(companyProfiles)
			.where(isNull(companyProfiles.deletedAt))
			.limit(1);
		if (!existing) return null;

		await this.database
			.update(companyProfiles)
			.set(
				kind === 'logo'
					? { logoObjectKey: key, updatedAt: new Date() }
					: { signatureObjectKey: key, updatedAt: new Date() },
			)
			.where(eq(companyProfiles.id, existing.id));

		await this.cache.del(PROFILE_CACHE_KEY);
		return this.readProfile(this.database);
	}

	findInvoiceAccounts(tx?: TTx): Promise<TBankAccountSelect[]> {
		// Transactional callers need read-your-writes inside `save`.
		if (tx) return this.readInvoiceAccounts(tx);
		return this.cache.remember(INVOICE_ACCOUNTS_CACHE_KEY, () =>
			this.readInvoiceAccounts(this.database),
		);
	}

	private readInvoiceAccounts(database: TTx | BunSQLDatabase): Promise<TBankAccountSelect[]> {
		return database
			.select()
			.from(bankAccounts)
			.where(and(isNull(bankAccounts.deletedAt), isNotNull(bankAccounts.invoiceUsage)));
	}

	findSettings(): Promise<TCompanySettingSelect[]> {
		return this.database
			.select()
			.from(companySettings)
			.where(isNull(companySettings.deletedAt))
			.orderBy(companySettings.settingGroup, companySettings.settingKey);
	}

	async findSetting(group: string, key: string): Promise<TCompanySettingSelect | null> {
		const [row] = await this.database
			.select()
			.from(companySettings)
			.where(
				and(
					eq(companySettings.settingGroup, group),
					eq(companySettings.settingKey, key),
					isNull(companySettings.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * Insert-or-update on the live (group, key) row. A single statement keeps
	 * two concurrent PUTs for the same key from both inserting.
	 */
	async upsertSetting(
		group: string,
		key: string,
		data: { valueType: TCompanySettingValueType; value: string | null; updatedBy: string },
	): Promise<TCompanySettingSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(companySettings)
			.values({
				settingGroup: group,
				settingKey: key,
				valueType: data.valueType,
				settingValue: data.value,
				updatedBy: data.updatedBy,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [companySettings.settingGroup, companySettings.settingKey],
				targetWhere: isNull(companySettings.deletedAt),
				set: {
					valueType: data.valueType,
					settingValue: data.value,
					updatedBy: data.updatedBy,
					updatedAt: now,
				},
			})
			.returning();
		return row;
	}

	/** Sets the account printed for one invoice usage; `null` soft-deletes it. */
	private async saveInvoiceAccount(
		usage: BankAccountInvoiceUsage,
		account: TInvoiceBankAccount | null,
		tx: TTx,
	): Promise<void> {
		const now = new Date();
		const live = and(eq(bankAccounts.invoiceUsage, usage), isNull(bankAccounts.deletedAt));
		if (!account) {
			await tx.update(bankAccounts).set({ deletedAt: now, updatedAt: now }).where(live);
			return;
		}
		const [existing] = await tx.select({ id: bankAccounts.id }).from(bankAccounts).where(live);
		if (existing) {
			await tx
				.update(bankAccounts)
				.set({ ...account, updatedAt: now })
				.where(eq(bankAccounts.id, existing.id));
			return;
		}
		await tx.insert(bankAccounts).values({
			...account,
			code: INVOICE_ACCOUNT_CODES[usage],
			invoiceUsage: usage,
			createdAt: now,
			updatedAt: now,
		});
	}
}
