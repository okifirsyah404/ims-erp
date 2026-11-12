/**
 * Company service unit tests (ported from the M02 branch, ADR-0011).
 *
 * @remarks
 * The profile is company-wide; the two invoice bank accounts are only
 * returned when the caller may see them, and saving hands the profile and
 * both accounts to one repository call (one transaction there). Storage is
 * split since ERP-0042, so the repository returns the profile row with its
 * primary address and contacts.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	BankAccountInvoiceUsage,
	TBankAccountSelect,
	TCompanyProfileSelect,
	TContactSelect,
	THeadOfficeAddressSelect,
} from '@drizzle/schemas/company.schema';
import {
	companyProfileSchema,
	type TInvoiceBankAccount,
} from '../../src/app/company/contracts/company.contract';
import type {
	ICompanyRepository,
	TCompanyProfileData,
	TCompanyProfileRecord,
	TInvoiceAccountsData,
} from '../../src/app/company/contracts/company.repository.interface';
import { CompanyProfileRequiredError } from '../../src/app/company/errors/company.errors';
import { CompanyService } from '../../src/app/company/services/company.service';
import { DocumentImageInvalidError, documentImageFrom } from '../../src/providers/s3/document-image';

class FakeProfiles implements ICompanyRepository {
	profile: TCompanyProfileSelect | null = null;
	address: THeadOfficeAddressSelect | null = null;
	contacts: TContactSelect[] = [];
	accounts: TBankAccountSelect[] = [];
	saves = 0;

	async findProfile() {
		return this.profile ? this.record() : null;
	}

	async findInvoiceAccounts() {
		return this.accounts;
	}

	async save(data: TCompanyProfileData, accounts?: TInvoiceAccountsData) {
		this.saves += 1;
		this.profile = { ...this.profile, ...data } as TCompanyProfileSelect;
		if (data.addressLine) {
			this.address = { addressLine: data.addressLine, postalCode: data.postalCode } as THeadOfficeAddressSelect;
		}
		const contact = (type: string, value: string | null) => {
			this.contacts = this.contacts.filter((c) => c.contactType !== type);
			if (value) this.contacts.push({ contactType: type, value } as TContactSelect);
		};
		contact('phone', data.phone);
		contact('email', data.email);
		contact('other', data.website);
		if (accounts) {
			const set = (usage: BankAccountInvoiceUsage, account: TInvoiceBankAccount | null) => {
				this.accounts = this.accounts.filter((a) => a.invoiceUsage !== usage);
				if (account) this.accounts.push({ ...account, invoiceUsage: usage } as TBankAccountSelect);
			};
			set('vat', accounts.vat);
			set('non_vat', accounts.nonVat);
		}
		return { record: this.record(), accounts: this.accounts };
	}

	async setImage(kind: 'logo' | 'signature', key: string | null) {
		if (!this.profile) return null;
		Object.assign(
			this.profile,
			kind === 'logo' ? { logoObjectKey: key } : { signatureObjectKey: key },
		);
		return this.record();
	}

	private record(): TCompanyProfileRecord {
		return { profile: this.profile!, address: this.address, contacts: this.contacts };
	}
}

const stored: string[] = [];
const storage = {
	put: async (key: string) => {
		stored.push(key);
	},
	presignGet: (key: string) => `https://files.test/${key}`,
};

const input = companyProfileSchema.parse({
	legalName: 'PT Inovasi Mitra Sejati',
	documentCode: 'ims',
	email: '',
	bankAccounts: {
		vat: { bankName: 'BCA', accountNumber: '123 456 7890', accountHolder: 'PT IMS' },
		nonVat: null,
	},
});

describe('CompanyService', () => {
	let repository: FakeProfiles;
	let service: CompanyService;

	beforeEach(() => {
		repository = new FakeProfiles();
		service = new CompanyService(repository, storage);
	});

	test('input is normalised: upper-case document code, empty text becomes null', () => {
		expect(input.documentCode).toBe('IMS');
		expect(input.email).toBeNull();
		expect(input.tagline).toBeNull();
		expect(() => companyProfileSchema.parse({ ...input, documentCode: 'IMS-1' })).toThrow();
	});

	test('nothing saved yet reads as null', async () => {
		expect(await service.get(true)).toBeNull();
		expect(await service.getProfile()).toBeNull();
	});

	test('saves the profile and both accounts in one repository call', async () => {
		const view = await service.save(input, 'user-1', true);
		expect(repository.saves).toBe(1);
		expect(repository.profile?.updatedBy).toBe('user-1');
		expect(view.bankAccounts).toEqual({
			vat: { bankName: 'BCA', accountNumber: '123 456 7890', accountHolder: 'PT IMS' },
			nonVat: null,
		});
	});

	test('the exported snapshot carries the letterhead without bank accounts', async () => {
		await service.save(input, 'user-1', true);
		const snapshot = await service.getProfile();
		expect(snapshot).toMatchObject({ legalName: 'PT Inovasi Mitra Sejati', documentCode: 'IMS' });
		expect(snapshot).not.toHaveProperty('bankAccounts');
		expect(snapshot).not.toHaveProperty('logoUrl');
	});

	test('bank accounts are hidden from callers without access', async () => {
		await service.save(input, 'user-1', true);
		expect((await service.save(input, 'user-2', false)).bankAccounts).toBeNull();
		expect((await service.get(false))?.bankAccounts).toBeNull();
		expect((await service.get(true))?.bankAccounts?.vat?.bankName).toBe('BCA');
		expect((await service.get(false))?.legalName).toBe('PT Inovasi Mitra Sejati');
	});
});

describe('CompanyService without bank accounts in the input', () => {
	test('saving the profile alone leaves the accounts untouched', async () => {
		const repository = new FakeProfiles();
		const service = new CompanyService(repository, storage);
		await service.save(input, 'user-1', true);
		const { bankAccounts: _omitted, ...profileOnly } = input;
		const view = await service.save({ ...profileOnly, tagline: 'Baru' }, 'user-2', true);
		expect(view.tagline).toBe('Baru');
		expect(view.bankAccounts?.vat?.bankName).toBe('BCA');
	});

	test('a caller without bank access cannot change the accounts', async () => {
		const repository = new FakeProfiles();
		const service = new CompanyService(repository, storage);
		await service.save(input, 'user-1', true);
		await service.save(
			{ ...input, bankAccounts: { vat: null, nonVat: null } },
			'user-2',
			false,
		);
		expect((await service.get(true))?.bankAccounts?.vat?.bankName).toBe('BCA');
	});
});

describe('CompanyService images', () => {
	/** Real 1x1 PNG so the server-side WebP conversion can decode it. */
	const PNG_BYTES = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
		'base64',
	);
	const png = () => new File([PNG_BYTES], 'logo.png', { type: 'image/png' });

	test('needs a saved profile first', async () => {
		const service = new CompanyService(new FakeProfiles(), storage);
		await expect(service.setImage('logo', png(), false)).rejects.toBeInstanceOf(CompanyProfileRequiredError);
	});

	test('every upload gets a fresh key (printed documents keep theirs); removal clears it', async () => {
		const service = new CompanyService(new FakeProfiles(), storage);
		await service.save(input, 'user-1', true);
		const first = await service.setImage('logo', png(), false);
		const second = await service.setImage('signature', png(), false);
		const third = await service.setImage('logo', png(), false);
		// Server normalises every upload to WebP, whatever the client sent.
		expect(first.logoUrl).toMatch(/^https:\/\/files\.test\/company\/logo\/[0-9a-f-]{36}\.webp$/);
		expect(second.signatureUrl).toContain('company/signature/');
		expect(third.logoUrl).not.toBe(first.logoUrl);
		expect((await service.setImage('logo', null, false)).logoUrl).toBeNull();
	});

	test('the boundary checks shape and size; the format is decided on decode', async () => {
		expect(() => documentImageFrom({})).toThrow(DocumentImageInvalidError);
		expect(() =>
			documentImageFrom({ file: new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }) }),
		).toThrow(DocumentImageInvalidError);
		expect(documentImageFrom({ file: png() }).name).toBe('logo.png');
		// A PDF passes the size/shape check but cannot be decoded to WebP.
		const service = new CompanyService(new FakeProfiles(), storage);
		await service.save(input, 'user-1', true);
		await expect(
			service.setImage('logo', new File(['x'], 'a.pdf', { type: 'application/pdf' }), false),
		).rejects.toBeInstanceOf(DocumentImageInvalidError);
	});
});
