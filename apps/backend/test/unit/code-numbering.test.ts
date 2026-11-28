/**
 * Shared code-numbering rules (ADR-0024 Q6): rendering, `{ORG}`, the settings
 * use cases of `CodeNumberingServiceBase` and the allocation wrapper of
 * `CodeNumberingRepositoryBase.next`.
 *
 * @remarks
 * No database: the repository base is subclassed with in-memory `findByType`
 * and `allocate`, the service base gets an in-memory store.
 */
import { describe, expect, test } from 'bun:test';
import type { TTx } from '@drizzle/types';
import {
	CODE_MAX_LENGTH,
	CODE_TYPES_BY_SCHEMA,
	CodeNumberingRepositoryBase,
	CodeNumberingServiceBase,
	type CodeType,
	defaultPattern,
	GeneratedCodeTooLongError,
	NumberingPatternError,
	OrganizationRequiredForCodeError,
	organizationCodeFromSlug,
	renderNumber,
	type TCodeNumberingStore,
	type TCodeNumberSettings,
	UnknownCodeTypeError,
	validatePattern,
} from '@shared/numbering';
import { ProcurementNumberingService } from '../../src/app/procurement/services/procurement-numbering.service';

type TRow = {
	id: string;
	codeType: string;
	pattern: string | null;
	resetPolicy: string | null;
	periodKey: string;
	nextNumber: number;
	updatedBy: string | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
};

/** Repository base over a Map: exercises the real `next`. */
class MemoryRepository extends CodeNumberingRepositoryBase {
	protected readonly table = null as never;
	readonly rows = new Map<string, TRow>();

	constructor() {
		super(null as never);
	}

	override async findByType(codeType: CodeType, _tx?: TTx) {
		return (this.rows.get(codeType) ?? null) as never;
	}

	override async allocate(codeType: CodeType, key: string): Promise<number> {
		const row = this.rows.get(codeType);
		if (!row) {
			this.rows.set(codeType, makeRow(codeType, { periodKey: key, nextNumber: 2 }));
			return 1;
		}
		const seq = row.periodKey === key ? row.nextNumber : 1;
		row.periodKey = key;
		row.nextNumber = seq + 1;
		return seq;
	}

	// The real one returns an awaitable query builder; an array awaits the same.
	override findAll(): never {
		return [...this.rows.values()] as never;
	}

	override async saveSettings(settings: TCodeNumberSettings, key: string) {
		const row = this.rows.get(settings.codeType) ?? makeRow(settings.codeType, { periodKey: key });
		row.pattern = settings.pattern ?? null;
		row.resetPolicy = settings.resetPolicy ?? null;
		row.updatedBy = settings.updatedBy ?? null;
		this.rows.set(settings.codeType, row);
		return row as never;
	}
}

function makeRow(codeType: string, patch: Partial<TRow> = {}): TRow {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		codeType,
		pattern: null,
		resetPolicy: null,
		periodKey: 'all',
		nextNumber: 1,
		updatedBy: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		...patch,
	};
}

const company = { requireDocumentCode: async () => 'IMS' };
const organizations = {
	calls: 0,
	async requireOrganizationCode(organizationId: string) {
		this.calls += 1;
		return organizationCodeFromSlug(`slug-${organizationId}`);
	},
};

class SupplierNumbering extends CodeNumberingServiceBase {
	protected readonly schema = 'supplier';
	next(codeType: CodeType, organizationId?: string | null) {
		return this.issue(codeType, { organizationId });
	}
}

class SaleNumbering extends CodeNumberingServiceBase {
	protected readonly schema = 'sale';
	next(codeType: CodeType, organizationId?: string | null) {
		return this.issue(codeType, { organizationId });
	}
}

describe('domain rules', () => {
	test('{ORG} is a known token for every code type', () => {
		expect(validatePattern('{ORG}-{SEQ:4}', 'quotation')).toEqual([]);
		expect(validatePattern('{ORG}-{SEQ:4}', 'employee')).toEqual([]);
		expect(validatePattern('{ORG:3}-{SEQ}', 'employee')[0]?.code).toBe('tokenTakesNoWidth');
	});

	test('organizationCodeFromSlug upper-cases and keeps only A-Z 0-9 -', () => {
		expect(organizationCodeFromSlug('pt-entragate-hit')).toBe('PT-ENTRAGATE-HIT');
		expect(organizationCodeFromSlug('pt entragate__hit-')).toBe('PT-ENTRAGATE-HIT');
	});

	test('renderNumber fills {ORG}', () => {
		const code = renderNumber('{COMPANY}-{ORG}-{TYPE}-{SEQ:5}', {
			seq: 7,
			typeCode: 'SUP',
			companyCode: 'IMS',
			organizationCode: 'HIT',
			date: new Date('2026-11-21T00:00:00Z'),
		});
		expect(code).toBe('IMS-HIT-SUP-00007');
	});

	test('product and warehouse code types have their own schemas (ADR-0026)', () => {
		expect(CODE_TYPES_BY_SCHEMA.product).toEqual(['item_product', 'item_material', 'item_component']);
		expect(CODE_TYPES_BY_SCHEMA.warehouse).toEqual(['warehouse']);
		expect(CODE_TYPES_BY_SCHEMA.inventory as readonly string[]).not.toContain('warehouse');
	});
});

describe('CodeNumberingRepositoryBase.next', () => {
	test('{TYPE} renders the type code, not the code type name', async () => {
		const repository = new MemoryRepository();
		const code = await repository.next('quotation', 'IMS', new Date('2026-11-21T05:00:00Z'));
		expect(code).toBe('0001/QT/IMS/XI/26');
	});

	test('a pattern with {ORG} and no resolver is refused before allocating', async () => {
		const repository = new MemoryRepository();
		repository.rows.set('quotation', makeRow('quotation', { pattern: '{ORG}-{SEQ:4}' }));
		await expect(repository.next('quotation', 'IMS', new Date())).rejects.toBeInstanceOf(
			OrganizationRequiredForCodeError,
		);
		expect(repository.rows.get('quotation')?.nextNumber).toBe(1);
	});

	test('{ORG} is resolved only when the pattern uses it', async () => {
		const repository = new MemoryRepository();
		let resolved = 0;
		const resolve = async () => {
			resolved += 1;
			return 'HIT';
		};
		await repository.next('quotation', 'IMS', new Date(), undefined, undefined, resolve);
		expect(resolved).toBe(0);
		repository.rows.set('order', makeRow('order', { pattern: '{ORG}/{SEQ:3}' }));
		expect(await repository.next('order', 'IMS', new Date(), undefined, undefined, resolve)).toBe('HIT/001');
		expect(resolved).toBe(1);
	});

	test('a code longer than its column is refused', async () => {
		const repository = new MemoryRepository();
		// The old long default, saved as a custom pattern.
		repository.rows.set('supplier_company', makeRow('supplier_company', { pattern: '{COMPANY}-{ORG}-{TYPE}-{SEQ:5}' }));
		const longOrg = async () => 'A-VERY-LONG-ORGANIZATION-SLUG-NAME';
		await expect(
			repository.next('supplier_company', 'IMS', new Date(), undefined, undefined, longOrg),
		).rejects.toBeInstanceOf(GeneratedCodeTooLongError);
	});

	test('P7-5: the default supplier code is short and keeps the PO number within 32 characters', async () => {
		const repository = new MemoryRepository();
		const supplier = await repository.next('supplier_company', 'IMS', new Date('2026-11-28T12:00:00+07:00'));
		expect(supplier).toBe('SUP-00001');
		expect(defaultPattern('supplier_company')).toBe('{TYPE}-{SEQ:5}');
		const order = await repository.next('purchase_order', 'IMS', new Date('2026-11-28T12:00:00+07:00'), undefined, {
			supplier,
			category: 'HW',
		});
		expect(order).toBe('PO/IMS-SUP-00001/HW/1126/001');
		expect(order.length).toBeLessThanOrEqual(32);
		// Even a five-letter company code and a five-digit supplier sequence fit.
		expect('PO/ABCDE-SUP-99999/SVC/1226/999'.length).toBeLessThanOrEqual(32);
	});

	test('P7-5: a PO number over 32 characters is refused with the FU6 message key', async () => {
		const repository = new MemoryRepository();
		const error = await repository
			.next('purchase_order', 'IMS', new Date(), undefined, { supplier: 'DEV-ENTRAGATE-SUP-00001', category: 'HW' })
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(GeneratedCodeTooLongError);
		expect((error as GeneratedCodeTooLongError).key).toBe('numbering.purchaseOrderTooLong');
		expect((error as GeneratedCodeTooLongError).params).toMatchObject({ max: 32 });
	});

	test('P7-5: a warranty number over 32 characters is refused', async () => {
		expect(CODE_MAX_LENGTH.warranty).toBe(32);
		const repository = new MemoryRepository();
		// 001/SG-GARANSI/IMSID-CUS00001/2026 = 34 characters with a 5-letter company code.
		await expect(
			repository.next('warranty', 'IMSID', new Date('2026-11-28T12:00:00+07:00'), undefined, { customer: 'CUS00001' }),
		).rejects.toBeInstanceOf(GeneratedCodeTooLongError);
		// The usual 3-letter company code fits exactly.
		expect(
			await repository.next('warranty', 'IMS', new Date('2026-11-28T12:00:00+07:00'), undefined, { customer: 'CUS00001' }),
		).toHaveLength(32);
	});
});

describe('CodeNumberingServiceBase', () => {
	function setup() {
		const repository = new MemoryRepository();
		const store: TCodeNumberingStore = repository;
		return { repository, supplier: new SupplierNumbering(store, company, organizations) };
	}

	test('the default supplier code is the short type + sequence (K6)', async () => {
		const { supplier } = setup();
		expect(await supplier.next('supplier_company', 'hit')).toBe('SUP-00001');
		expect(await supplier.next('supplier_company')).toBe('SUP-00002');
	});

	test('a pattern with {ORG} needs an organization', async () => {
		const { repository, supplier } = setup();
		repository.rows.set('supplier_company', makeRow('supplier_company', { pattern: '{ORG}-{TYPE}-{SEQ:3}' }));
		await expect(supplier.next('supplier_company')).rejects.toBeInstanceOf(
			OrganizationRequiredForCodeError,
		);
		expect(await supplier.next('supplier_company', 'hit')).toBe('SLUG-HIT-SUP-001');
	});

	test('listSettings returns only the schema code types, with defaults', async () => {
		const { supplier } = setup();
		const settings = await supplier.listSettings('hit');
		expect(settings.map((setting) => setting.codeType)).toEqual(['supplier_company']);
		expect(settings[0]).toMatchObject({
			typeCode: 'SUP',
			pattern: '{TYPE}-{SEQ:5}',
			resetPolicy: 'never',
			isDefault: true,
			maxLength: 32,
			nextNumber: 'SUP-00001',
		});
	});

	test('a preview without an organization uses the ORG placeholder', async () => {
		const { supplier } = setup();
		const preview = await supplier.previewSetting('supplier_company', {
			pattern: '{ORG}-{TYPE}-{SEQ:3}',
			resetPolicy: 'never',
		});
		expect(preview.nextNumber).toBe('ORG-SUP-001');
	});

	test('a code type of another schema is unknown here', async () => {
		const { supplier } = setup();
		await expect(
			supplier.previewSetting('quotation', { pattern: '{SEQ}', resetPolicy: 'never' }),
		).rejects.toBeInstanceOf(UnknownCodeTypeError);
	});

	test('an invalid pattern is refused with its first problem', async () => {
		const { supplier } = setup();
		await expect(
			supplier.updateSetting('supplier_company', { pattern: '{TYPE}', resetPolicy: 'never' }, 'u1'),
		).rejects.toBeInstanceOf(NumberingPatternError);
	});

	test('updateSetting saves an override that the next issue uses', async () => {
		const repository = new MemoryRepository();
		const sale = new SaleNumbering(repository, company, organizations);
		const saved = await sale.updateSetting(
			'quotation',
			{ pattern: ' SPH/{SEQ:3} ', resetPolicy: 'never' },
			'u1',
		);
		expect(saved).toMatchObject({ pattern: 'SPH/{SEQ:3}', isDefault: false, nextNumber: 'SPH/001' });
		expect(repository.rows.get('quotation')?.updatedBy).toBe('u1');
		expect(await sale.next('quotation')).toBe('SPH/001');
		const [listed] = await sale.listSettings();
		expect(listed).toMatchObject({ codeType: 'quotation', nextNumber: 'SPH/002' });
	});
});

describe('PO preview with real supplier codes (P7-5, K6)', () => {
	function setup(codes: Record<string, string>) {
		const repository = new MemoryRepository();
		const suppliers = {
			findLongestCompanyCode: async () =>
				Object.values(codes).sort((a, b) => b.length - a.length)[0] ?? null,
			assertActiveCompany: async (id: string) => ({ code: codes[id] }) as never,
		};
		return new ProcurementNumberingService(repository as never, company, undefined, suppliers);
	}

	test('the example uses the longest live supplier code, and says so', async () => {
		const service = setup({ a: 'SUP-00001', b: 'HIT' });
		const settings = await service.listSettings();
		const order = settings.find((setting) => setting.codeType === 'purchase_order')!;
		expect(order.sampleContext.supplier).toBe('SUP-00001');
		expect(order.nextNumber.startsWith('PO/IMS-SUP-00001/HW/')).toBe(true);
		expect(order.nextNumber.length).toBeLessThanOrEqual(32);
		// Series without {SUPPLIER} keep the placeholder set.
		expect(settings.find((setting) => setting.codeType === 'goods_receipt')!.sampleContext.supplier).toBe('SUP');
	});

	test('a long real supplier code makes the PO example exceed 32 characters (visible before approval)', async () => {
		const service = setup({ a: 'DEV-ENTRAGATE-SUP-00001' });
		const order = (await service.listSettings()).find((setting) => setting.codeType === 'purchase_order')!;
		expect(order.nextNumber.length).toBeGreaterThan(32);
		expect(order.maxLength).toBe(32);
	});

	test('a preview can use the supplier the owner picked', async () => {
		const service = setup({ a: 'SUP-00001', b: 'HIT' });
		const preview = await service.previewSetting(
			'purchase_order',
			{ pattern: '{TYPE}/{COMPANY}-{SUPPLIER}/{CATEGORY}/{MM}{YY}/{SEQ:3}', resetPolicy: 'monthly' },
			null,
			{ supplierCompanyId: 'b' },
		);
		expect(preview.sampleContext.supplier).toBe('HIT');
		expect(preview.nextNumber.startsWith('PO/IMS-HIT/HW/')).toBe(true);
		expect(preview.maxLength).toBe(32);
	});

	test('without suppliers the placeholder stays', async () => {
		const service = setup({});
		const order = (await service.listSettings()).find((setting) => setting.codeType === 'purchase_order')!;
		expect(order.sampleContext.supplier).toBe('SUP');
	});
});
