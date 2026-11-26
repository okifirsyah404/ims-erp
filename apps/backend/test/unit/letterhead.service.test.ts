/**
 * Letterhead (kop surat) templates (ERP-0165): the first upload is the
 * default, one default at a time, a deleted letterhead still prints for the
 * documents that picked it, and the default is the fallback.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TLetterheadSelect } from '@drizzle/schemas/company.schema';
import type { ILetterheadRepository } from '../../src/app/company/contracts/company.repository.interface';
import { letterheadCreateSchema, letterheadPatchSchema } from '../../src/app/company/contracts/letterhead.contract';
import { LetterheadNotFoundError } from '../../src/app/company/errors/company.errors';
import { ExportedCompanyService } from '../../src/app/company/services/exported-company.service';
import { LetterheadService } from '../../src/app/company/services/letterhead.service';

class FakeLetterheads implements ILetterheadRepository {
	rows: TLetterheadSelect[] = [];
	private live() {
		return this.rows.filter((row) => !row.deletedAt);
	}
	async findAll() {
		return this.live().sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
	}
	async findLive(id: string) {
		return this.live().find((row) => row.id === id) ?? null;
	}
	async findAny(id: string) {
		return this.rows.find((row) => row.id === id) ?? null;
	}
	async findDefault() {
		return this.live().find((row) => row.isDefault) ?? null;
	}
	private clearDefault(exceptId: string | null) {
		for (const row of this.live()) if (row.id !== exceptId) row.isDefault = false;
	}
	async create(data: Parameters<ILetterheadRepository['create']>[0]) {
		if (data.isDefault) this.clearDefault(null);
		const now = new Date();
		const row = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null } as TLetterheadSelect;
		this.rows.push(row);
		return row;
	}
	async update(id: string, data: Parameters<ILetterheadRepository['update']>[1]) {
		const row = await this.findLive(id);
		if (!row) return null;
		if (data.isDefault) this.clearDefault(id);
		Object.assign(row, data);
		return row;
	}
	async softDelete(id: string) {
		const row = await this.findLive(id);
		if (!row) return false;
		row.deletedAt = new Date();
		row.isDefault = false;
		return true;
	}
}

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
	'base64',
);
const png = () => new File([PNG], 'kop.png', { type: 'image/png' });

let stored: string[];
let letterheads: FakeLetterheads;
let service: LetterheadService;
let exported: ExportedCompanyService;

beforeEach(() => {
	stored = [];
	letterheads = new FakeLetterheads();
	const storage = {
		put: async (key: string) => {
			stored.push(key);
		},
		presignGet: (key: string) => `https://files.test/${key}`,
	};
	service = new LetterheadService(letterheads, storage as never);
	const none = { find: async () => null, findPrimary: async () => null, findAll: async () => [] };
	exported = new ExportedCompanyService(none as never, none as never, none as never, letterheads, storage);
});

const create = (name: string, isDefault = false, footer = false) =>
	service.create(letterheadCreateSchema.parse({ name, isDefault: String(isDefault) }), { header: png(), footer: footer ? png() : null }, 'admin');

describe('letterhead templates', () => {
	test('the first one is the default; images get fresh WebP keys and inline URLs', async () => {
		const first = await create('IMS');
		expect(first.isDefault).toBe(true);
		expect(first.headerUrl).toMatch(/^https:\/\/files\.test\/company\/letterhead\/.+\.webp$/);
		expect(first.footerUrl).toBeNull();
		const second = await create('ENTRAGATE', false, true);
		expect(second.isDefault).toBe(false);
		expect(second.footerUrl).not.toBeNull();
		expect(new Set(stored).size).toBe(3);
	});

	test('one default at a time; the default lists first', async () => {
		await create('IMS');
		const other = await create('ENTRAGATE', true);
		expect((await service.list()).map((row) => [row.name, row.isDefault])).toEqual([
			['ENTRAGATE', true],
			['IMS', false],
		]);
		const ims = (await service.list())[1]!;
		await service.update(ims.id, letterheadPatchSchema.parse({ isDefault: true }), 'admin');
		expect((await service.get(other.id)).isDefault).toBe(false);
	});

	test('replacing the header stores a new key; the footer can be removed', async () => {
		const row = await create('IMS', false, true);
		const replaced = await service.setImage(row.id, 'header', png(), 'admin');
		expect(replaced.headerUrl).not.toBe(row.headerUrl);
		expect((await service.setImage(row.id, 'footer', null, 'admin')).footerUrl).toBeNull();
	});

	test('a deleted letterhead is gone from the list but still prints for documents that picked it', async () => {
		const row = await create('IMS');
		await service.remove(row.id, 'admin');
		expect(await service.list()).toEqual([]);
		await expect(service.get(row.id)).rejects.toBeInstanceOf(LetterheadNotFoundError);
		await expect(exported.assertLetterhead(row.id)).rejects.toBeInstanceOf(LetterheadNotFoundError);
		expect((await exported.getLetterheadForPrint(row.id))?.name).toBe('IMS');
		// No default left: an order without its own letterhead prints the generated header.
		expect(await exported.getLetterheadForPrint(null)).toBeNull();
	});

	test('an order without a letterhead prints with the default', async () => {
		await create('IMS');
		const brand = await create('ENTRAGATE', true);
		expect((await exported.getLetterheadForPrint(null))?.id).toBe(brand.id);
	});

	test('an unknown id is a 404', async () => {
		await expect(service.update(crypto.randomUUID(), { name: 'x' }, 'admin')).rejects.toBeInstanceOf(LetterheadNotFoundError);
		await expect(service.remove(crypto.randomUUID(), 'admin')).rejects.toBeInstanceOf(LetterheadNotFoundError);
	});
});
