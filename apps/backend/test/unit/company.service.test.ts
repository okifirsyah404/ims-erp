/**
 * Company service unit tests (ADR-0011, ADR-0024 Q19/Q21).
 *
 * @remarks
 * The profile is company-wide and stored across `profiles`, `addresses` and
 * `contacts`; one repository per table, committed together through the
 * transaction runner. Invoice bank accounts live in `finance` now and are not
 * part of this module.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TCompanyAddressSelect,
	TCompanyProfileSelect,
	TCompanySettingSelect,
	TContactSelect,
} from '@drizzle/schemas/company.schema';
import type { TTx } from '@drizzle/types';
import {
	companyProfilePatchSchema,
	companyProfileSchema,
	companySettingInputSchema,
	type TCompanySettingValueType,
} from '../../src/app/company/contracts/company.contract';
import type {
	ICompanyAddressRepository,
	ICompanyContactRepository,
	ICompanyProfileRepository,
	ICompanySettingRepository,
	TCompanyProfileColumns,
	TContactChannel,
} from '../../src/app/company/contracts/company.repository.interface';
import { CompanyProfileRequiredError } from '../../src/app/company/errors/company.errors';
import { CompanyService } from '../../src/app/company/services/company.service';
import { ExportedCompanyService } from '../../src/app/company/services/exported-company.service';
import { DocumentImageInvalidError, documentImageFrom } from '../../src/providers/s3/document-image';

class FakeProfiles implements ICompanyProfileRepository {
	profile: TCompanyProfileSelect | null = null;
	saves = 0;
	invalidations = 0;

	async find() {
		return this.profile;
	}

	async save(data: TCompanyProfileColumns) {
		this.saves += 1;
		this.profile = { ...this.profile, ...data } as TCompanyProfileSelect;
		return this.profile;
	}

	async setImage(kind: 'logo' | 'signature' | 'onboarding', key: string | null) {
		if (!this.profile) return null;
		const field =
			kind === 'logo'
				? { logoObjectKey: key }
				: kind === 'signature'
					? { signatureObjectKey: key }
					: { onboardingObjectKey: key };
		Object.assign(this.profile, field);
		return this.profile;
	}

	async invalidate() {
		this.invalidations += 1;
	}
}

class FakeAddresses implements ICompanyAddressRepository {
	address: TCompanyAddressSelect | null = null;

	async findPrimary() {
		return this.address;
	}

	async savePrimary(data: { addressLine: string | null; postalCode: string | null }) {
		this.address = data.addressLine
			? ({ addressLine: data.addressLine, postalCode: data.postalCode } as TCompanyAddressSelect)
			: null;
	}
}

class FakeContacts implements ICompanyContactRepository {
	rows: TContactSelect[] = [];

	async findAll() {
		return this.rows;
	}

	async syncChannels(channels: Array<TContactChannel | { contactType: string; value: null }>) {
		for (const channel of channels) {
			this.rows = this.rows.filter((c) => c.contactType !== channel.contactType);
			if (channel.value) {
				this.rows.push({ contactType: channel.contactType, value: channel.value } as TContactSelect);
			}
		}
	}
}

class FakeSettings implements ICompanySettingRepository {
	settings: TCompanySettingSelect[] = [];

	async findAll() {
		return this.settings;
	}

	async find(group: string, key: string) {
		return this.settings.find((s) => s.settingGroup === group && s.settingKey === key) ?? null;
	}

	async upsert(
		group: string,
		key: string,
		data: { valueType: TCompanySettingValueType; value: string | null; updatedBy: string },
	) {
		const row = {
			id: `${group}.${key}`,
			settingGroup: group,
			settingKey: key,
			settingValue: data.value,
			valueType: data.valueType,
			isSecret: false,
			description: null,
			updatedBy: data.updatedBy,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
		} as unknown as TCompanySettingSelect;
		const i = this.settings.findIndex((s) => s.settingGroup === group && s.settingKey === key);
		if (i >= 0) this.settings[i] = row;
		else this.settings.push(row);
		return row;
	}
}

const stored: string[] = [];
const storage = {
	put: async (key: string) => {
		stored.push(key);
	},
	presignGet: (key: string) => `https://files.test/${key}`,
};

const transactions = { run: <T>(work: (tx: TTx) => Promise<T>) => work({} as TTx) };

const input = companyProfileSchema.parse({
	legalName: 'PT Inovasi Mitra Sejati',
	documentCode: 'ims',
	email: '',
});

function build() {
	const profiles = new FakeProfiles();
	const addresses = new FakeAddresses();
	const contacts = new FakeContacts();
	const settings = new FakeSettings();
	const service = new CompanyService(profiles, addresses, contacts, settings, storage, transactions);
	const letterheads = {
		findAll: async () => [],
		findLive: async () => null,
		findAny: async () => null,
		findDefault: async () => null,
		create: async () => {
			throw new Error('not used');
		},
		update: async () => null,
		softDelete: async () => false,
	};
	const exported = new ExportedCompanyService(profiles, addresses, contacts, letterheads, storage);
	return { profiles, addresses, contacts, settings, service, exported };
}

describe('CompanyService', () => {
	let ctx: ReturnType<typeof build>;

	beforeEach(() => {
		ctx = build();
	});

	test('input is normalised: upper-case document code, empty text becomes null', () => {
		expect(input.documentCode).toBe('IMS');
		expect(input.email).toBeNull();
		expect(input.tagline).toBeNull();
		expect(() => companyProfileSchema.parse({ ...input, documentCode: 'IMS-1' })).toThrow();
	});

	test('nothing saved yet reads as null', async () => {
		expect(await ctx.service.get()).toBeNull();
		expect(await ctx.exported.getLetterhead()).toBeNull();
		expect(await ctx.exported.getDocumentCode()).toBeNull();
	});

	test('saves profile, address and contacts together and evicts the cache after commit', async () => {
		const view = await ctx.service.save(
			{ ...input, addressLine: 'Jl. Merdeka 1', phone: '021-555', website: 'ims.test' },
			'user-1',
		);
		expect(ctx.profiles.saves).toBe(1);
		expect(ctx.profiles.invalidations).toBe(1);
		expect(ctx.profiles.profile?.updatedBy).toBe('user-1');
		expect(view).toMatchObject({ addressLine: 'Jl. Merdeka 1', phone: '021-555', website: 'ims.test' });
		expect(view).not.toHaveProperty('bankAccounts');
	});

	test('the exported letterhead carries the flat profile without view URLs', async () => {
		await ctx.service.save(input, 'user-1');
		const letterhead = await ctx.exported.getLetterhead();
		expect(letterhead).toMatchObject({ legalName: 'PT Inovasi Mitra Sejati', documentCode: 'IMS' });
		expect(letterhead).not.toHaveProperty('logoUrl');
		expect(await ctx.exported.getDocumentCode()).toBe('IMS');
	});

	test('display name prefers the trading name', async () => {
		await ctx.service.save({ ...input, tradingName: 'IMS' }, 'user-1');
		expect(await ctx.exported.getDisplayName()).toBe('IMS');
	});
});

describe('CompanyService partial update (PUT sends only changed fields)', () => {
	test('omitted fields keep their stored value', async () => {
		const { service } = build();
		await service.save({ ...input, signatoryName: 'Budi', defaultInvoiceTerms: 'Net 14' }, 'user-1');
		const view = await service.save({ tagline: 'Baru' }, 'user-2');
		expect(view.tagline).toBe('Baru');
		expect(view.legalName).toBe('PT Inovasi Mitra Sejati');
		expect(view.documentCode).toBe('IMS');
		expect(view.signatoryName).toBe('Budi');
		expect(view.defaultInvoiceTerms).toBe('Net 14');
	});

	test('an explicit null clears a text field', async () => {
		const { service } = build();
		await service.save({ ...input, tagline: 'Baru' }, 'user-1');
		expect((await service.save({ tagline: null }, 'user-2')).tagline).toBeNull();
	});

	test('clearing the address line soft-deletes the primary address', async () => {
		const { service, addresses } = build();
		await service.save({ ...input, addressLine: 'Jl. Merdeka 1' }, 'user-1');
		expect(addresses.address).not.toBeNull();
		await service.save({ addressLine: null }, 'user-2');
		expect(addresses.address).toBeNull();
	});

	test('a patch without legalName or documentCode on an empty profile is rejected', async () => {
		const { service } = build();
		await expect(service.save({ tagline: 'Baru' }, 'user-1')).rejects.toBeInstanceOf(
			CompanyProfileRequiredError,
		);
	});

	test('the patch schema accepts a subset and still normalises the document code', () => {
		expect(companyProfilePatchSchema.parse({ documentCode: 'ims' }).documentCode).toBe('IMS');
		expect(companyProfilePatchSchema.parse({})).toEqual({});
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
		const { service } = build();
		await expect(service.setImage('logo', png())).rejects.toBeInstanceOf(CompanyProfileRequiredError);
	});

	test('every upload gets a fresh key (printed documents keep theirs); removal clears it', async () => {
		const { service } = build();
		await service.save(input, 'user-1');
		const first = await service.setImage('logo', png());
		const second = await service.setImage('signature', png());
		const third = await service.setImage('logo', png());
		// Server normalises every upload to WebP, whatever the client sent.
		expect(first.logoUrl).toMatch(/^https:\/\/files\.test\/company\/logo\/[0-9a-f-]{36}\.webp$/);
		expect(second.signatureUrl).toContain('company/signature/');
		expect(third.logoUrl).not.toBe(first.logoUrl);
		expect((await service.setImage('logo', null)).logoUrl).toBeNull();
	});

	test('onboarding image upload lands under its own prefix and feeds the branding view', async () => {
		const { service } = build();
		expect(await service.getBranding()).toEqual({ name: null, onboardingUrl: null });
		await service.save(input, 'user-1');
		expect((await service.getBranding()).name).toBe('PT Inovasi Mitra Sejati');
		const view = await service.setImage('onboarding', png());
		expect(view.onboardingUrl).toMatch(/^https:\/\/files\.test\/company\/onboarding\/[0-9a-f-]{36}\.webp$/);
		expect((await service.getBranding()).onboardingUrl).toContain('company/onboarding/');
		expect((await service.setImage('onboarding', null)).onboardingUrl).toBeNull();
	});

	test('the boundary checks shape and size; the format is decided on decode', async () => {
		expect(() => documentImageFrom({})).toThrow(DocumentImageInvalidError);
		expect(() =>
			documentImageFrom({ file: new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }) }),
		).toThrow(DocumentImageInvalidError);
		expect(documentImageFrom({ file: png() }).name).toBe('logo.png');
		// A PDF passes the size/shape check but cannot be decoded to WebP.
		const { service } = build();
		await service.save(input, 'user-1');
		await expect(
			service.setImage('logo', new File(['x'], 'a.pdf', { type: 'application/pdf' })),
		).rejects.toBeInstanceOf(DocumentImageInvalidError);
	});
});

describe('CompanyService settings (ERP-0045)', () => {
	let ctx: ReturnType<typeof build>;

	beforeEach(() => {
		ctx = build();
	});

	test('rejects a value that does not match its type, and writes nothing', async () => {
		const cases: Array<[TCompanySettingValueType, string]> = [
			['number', 'abc'],
			['number', '  '],
			['boolean', 'yes'],
			['json', '{oops'],
			['date', '2026-13-40'],
			['date', '13/11/2026'],
		];
		for (const [valueType, value] of cases) {
			await expect(
				ctx.service.upsertSetting('invoice', 'due_days', { valueType, value }, 'user-1'),
			).rejects.toThrow();
		}
		expect(ctx.settings.settings).toHaveLength(0);
	});

	test('accepts a valid value for each type and null (cleared)', async () => {
		const valid: Array<[TCompanySettingValueType, string | null]> = [
			['string', 'anything at all'],
			['number', '-3.5'],
			['boolean', 'false'],
			['json', '{"a":1}'],
			['date', '2026-11-13'],
			['number', null],
		];
		for (const [i, [valueType, value]] of valid.entries()) {
			await ctx.service.upsertSetting('invoice', `k_${i}`, { valueType, value }, 'user-1');
		}
		expect(ctx.settings.settings).toHaveLength(valid.length);
	});

	test('upsert replaces the row for the same group and key, not a second row', async () => {
		await ctx.service.upsertSetting('invoice', 'due_days', { valueType: 'number', value: '14' }, 'user-1');
		const second = await ctx.service.upsertSetting(
			'invoice',
			'due_days',
			{ valueType: 'number', value: '30' },
			'user-2',
		);
		expect(ctx.settings.settings).toHaveLength(1);
		expect(second.value).toBe('30');
		expect(ctx.settings.settings[0].updatedBy).toBe('user-2');
	});

	test('list returns the stored settings as views', async () => {
		await ctx.service.upsertSetting('ui', 'theme', { valueType: 'string', value: 'dark' }, 'user-1');
		expect(await ctx.service.listSettings()).toEqual([
			{ settingGroup: 'ui', settingKey: 'theme', valueType: 'string', value: 'dark' },
		]);
	});

	test('the request schema rejects unknown value types', () => {
		expect(() => companySettingInputSchema.parse({ valueType: 'secret', value: 'x' })).toThrow();
	});
});
