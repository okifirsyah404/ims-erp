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
	CODE_TYPES_BY_SCHEMA,
	CodeNumberingRepositoryBase,
	CodeNumberingServiceBase,
	type CodeType,
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
		const longOrg = async () => 'A-VERY-LONG-ORGANIZATION-SLUG-NAME';
		await expect(
			repository.next('supplier_company', 'IMS', new Date(), undefined, undefined, longOrg),
		).rejects.toBeInstanceOf(GeneratedCodeTooLongError);
	});
});

describe('CodeNumberingServiceBase', () => {
	function setup() {
		const repository = new MemoryRepository();
		const store: TCodeNumberingStore = repository;
		return { repository, supplier: new SupplierNumbering(store, company, organizations) };
	}

	test('the default supplier code names company, organization and type', async () => {
		const { supplier } = setup();
		expect(await supplier.next('supplier_company', 'hit')).toBe('IMS-SLUG-HIT-SUP-00001');
		expect(await supplier.next('supplier_company', 'hit')).toBe('IMS-SLUG-HIT-SUP-00002');
	});

	test('the default supplier code needs an organization', async () => {
		const { supplier } = setup();
		await expect(supplier.next('supplier_company')).rejects.toBeInstanceOf(
			OrganizationRequiredForCodeError,
		);
	});

	test('listSettings returns only the schema code types, with defaults', async () => {
		const { supplier } = setup();
		const settings = await supplier.listSettings('hit');
		expect(settings.map((setting) => setting.codeType)).toEqual(['supplier_company']);
		expect(settings[0]).toMatchObject({
			typeCode: 'SUP',
			pattern: '{COMPANY}-{ORG}-{TYPE}-{SEQ:5}',
			resetPolicy: 'never',
			isDefault: true,
			maxLength: 32,
			nextNumber: 'IMS-SLUG-HIT-SUP-00001',
		});
	});

	test('a preview without an organization uses the ORG placeholder', async () => {
		const { supplier } = setup();
		const preview = await supplier.previewSetting('supplier_company', {
			pattern: '{ORG}-{TYPE}-{SEQ:3}',
			resetPolicy: 'never',
		});
		expect(preview).toBe('ORG-SUP-001');
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
