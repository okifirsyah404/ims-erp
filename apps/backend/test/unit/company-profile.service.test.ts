/**
 * Company profile service unit tests (ported from the M02 branch, ADR-0011).
 *
 * @remarks
 * The profile is company-wide; the two invoice bank accounts are only
 * returned when the caller may see them, and saving writes the profile and
 * both accounts through one transaction handle.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	BankAccountInvoiceUsage,
	TCompanyBankAccountSelect,
	TCompanyProfileSelect,
} from '@drizzle/schemas/organization.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	companyProfileSchema,
	type TInvoiceBankAccount,
} from '../../src/app/organization/contracts/company-profile.contract';
import type {
	ICompanyProfileRepository,
	TCompanyProfileData,
} from '../../src/app/organization/contracts/company-profile.repository.interface';
import { CompanyProfileService } from '../../src/app/organization/services/company-profile.service';

const TX = { tx: true } as never;

class FakeProfiles implements ICompanyProfileRepository {
	profile: TCompanyProfileSelect | null = null;
	accounts: TCompanyBankAccountSelect[] = [];
	handles: unknown[] = [];

	async findProfile() {
		return this.profile;
	}

	async saveProfile(data: TCompanyProfileData, tx?: unknown) {
		this.handles.push(tx);
		this.profile = { ...(this.profile ?? {}), ...data } as TCompanyProfileSelect;
		return this.profile;
	}

	async findInvoiceAccounts() {
		return this.accounts;
	}

	async saveInvoiceAccount(usage: BankAccountInvoiceUsage, account: TInvoiceBankAccount | null, tx?: unknown) {
		this.handles.push(tx);
		this.accounts = this.accounts.filter((a) => a.invoiceUsage !== usage);
		if (account) this.accounts.push({ ...account, invoiceUsage: usage } as TCompanyBankAccountSelect);
	}
}

const database = {
	transaction: async <T>(run: (tx: never) => Promise<T>) => run(TX),
} as unknown as BunSQLDatabase;

const input = companyProfileSchema.parse({
	legalName: 'PT Inovasi Mitra Sejati',
	documentCode: 'ims',
	email: '',
	bankAccounts: {
		vat: { bankName: 'BCA', accountNumber: '123 456 7890', accountHolder: 'PT IMS' },
		nonVat: null,
	},
});

describe('CompanyProfileService', () => {
	let repository: FakeProfiles;
	let service: CompanyProfileService;

	beforeEach(() => {
		repository = new FakeProfiles();
		service = new CompanyProfileService(repository, database);
	});

	test('input is normalised: upper-case document code, empty text becomes null', () => {
		expect(input.documentCode).toBe('IMS');
		expect(input.email).toBeNull();
		expect(input.tagline).toBeNull();
		expect(() => companyProfileSchema.parse({ ...input, documentCode: 'IMS-1' })).toThrow();
	});

	test('nothing saved yet reads as null', async () => {
		expect(await service.get(true)).toBeNull();
	});

	test('saves the profile and both accounts in one transaction', async () => {
		const view = await service.save(input, 'user-1');
		expect(repository.handles).toEqual([TX, TX, TX]);
		expect(repository.profile?.updatedBy).toBe('user-1');
		expect(view.bankAccounts).toEqual({
			vat: { bankName: 'BCA', accountNumber: '123 456 7890', accountHolder: 'PT IMS' },
			nonVat: null,
		});
	});

	test('bank accounts are hidden from callers without access', async () => {
		await service.save(input, 'user-1');
		expect((await service.get(false))?.bankAccounts).toBeNull();
		expect((await service.get(true))?.bankAccounts?.vat?.bankName).toBe('BCA');
		expect((await service.get(false))?.legalName).toBe('PT Inovasi Mitra Sejati');
	});
});
