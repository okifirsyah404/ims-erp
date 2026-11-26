/**
 * Purchase term templates (ERP-0165): placeholders checked on save, one
 * default at a time, soft delete.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TPurchaseTermTemplateSelect } from '@drizzle/schemas/procurement.schema';
import type {
	IPurchaseTermTemplateRepository,
	TPurchaseTermTemplateData,
} from '../../src/app/procurement/contracts/procurement.repository.interface';
import { purchaseTermTemplateBodySchema } from '../../src/app/procurement/contracts/purchase-term-template.contract';
import { PurchaseTermPlaceholderError, PurchaseTermTemplateNotFoundError } from '../../src/app/procurement/errors/procurement.errors';
import { PurchaseTermTemplateService } from '../../src/app/procurement/services/purchase-term-template.service';

class FakeTemplates implements IPurchaseTermTemplateRepository {
	rows: TPurchaseTermTemplateSelect[] = [];
	private live() {
		return this.rows.filter((row) => !row.deletedAt);
	}
	async findAll() {
		return this.live().sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
	}
	async findLive(id: string) {
		return this.live().find((row) => row.id === id) ?? null;
	}
	async create(data: TPurchaseTermTemplateData & { createdBy: string }) {
		if (data.isDefault) for (const row of this.live()) row.isDefault = false;
		const now = new Date();
		const row = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null };
		this.rows.push(row);
		return row;
	}
	async update(id: string, data: TPurchaseTermTemplateData) {
		const row = await this.findLive(id);
		if (!row) return null;
		if (data.isDefault) for (const other of this.live()) if (other.id !== id) other.isDefault = false;
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

let templates: FakeTemplates;
let service: PurchaseTermTemplateService;

beforeEach(() => {
	templates = new FakeTemplates();
	service = new PurchaseTermTemplateService(templates);
});

const body = (extra: Record<string, unknown>) => purchaseTermTemplateBodySchema.parse({ name: 'Hardware', ...extra });

describe('purchase term templates', () => {
	test('placeholders are checked in every text field', async () => {
		for (const field of ['paymentTerms', 'terms', 'notes']) {
			await expect(service.create(body({ [field]: 'DP {{dp_50}}' }), 'buyer')).rejects.toBeInstanceOf(PurchaseTermPlaceholderError);
		}
		const row = await service.create(
			body({ terms: 'Pembayaran: DP 50% sebesar {{grand_total_pct:50}}\nGaransi: 12 bulan', notes: '', isDefault: true }),
			'buyer',
		);
		expect(row).toMatchObject({ notes: null, isDefault: true, createdBy: 'buyer' });
	});

	test('one default at a time, listed first', async () => {
		const hardware = await service.create(body({ isDefault: true }), 'buyer');
		const licence = await service.create(body({ name: 'Lisensi', isDefault: true }), 'buyer');
		expect((await service.list()).map((row) => [row.name, row.isDefault])).toEqual([
			['Lisensi', true],
			['Hardware', false],
		]);
		await service.update(hardware.id, body({ isDefault: true }), 'buyer');
		expect((await service.get(licence.id)).isDefault).toBe(false);
	});

	test('deleted templates are gone; unknown ids are a 404', async () => {
		const row = await service.create(body({}), 'buyer');
		await service.remove(row.id, 'buyer');
		expect(await service.list()).toEqual([]);
		await expect(service.get(row.id)).rejects.toBeInstanceOf(PurchaseTermTemplateNotFoundError);
		await expect(service.update(row.id, body({}), 'buyer')).rejects.toBeInstanceOf(PurchaseTermTemplateNotFoundError);
		await expect(service.remove(row.id, 'buyer')).rejects.toBeInstanceOf(PurchaseTermTemplateNotFoundError);
	});
});
