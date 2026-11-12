/**
 * Code numbering unit tests (ported from the M02 branch, ADR-0011).
 *
 * @remarks
 * Covers the pure pattern rules and the service around a fake repository
 * that mirrors the atomic `allocate` contract: same period increments,
 * a new period starts at 1. The SQL itself is checked against PostgreSQL by
 * the live HTTP verification recorded in `docs/plan/progress.md`.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ICompanyService } from '../../src/app/company';
import type { TCompanyProfileSnapshot } from '../../src/app/company';
import type {
	CodeType,
	TCodeNumberSeriesSelect,
} from '@drizzle/schemas/code-number.schema';
import { CODE_TYPES } from '@drizzle/schemas/code-number.schema';
import type {
	ICodeNumberRepository,
	TCodeNumberSettings,
} from '../../src/app/code-number/contracts/code-number.repository.interface';
import { periodKey, renderNumber, validatePattern } from '../../src/app/code-number/domain/code-number';
import {
	CompanyProfileRequiredError,
	NumberingPatternError,
	UnknownCodeTypeError,
} from '../../src/app/code-number/errors/code-number.errors';
import { CodeNumberService } from '../../src/app/code-number/services/code-number.service';

/** 15 Oct 2026, 10:00 WIB. */
const OCT = new Date(Date.UTC(2026, 9, 15, 3));
/** 1 Jan 2027, 06:00 WIB (still 31 Dec 2026 in UTC). */
const NEW_YEAR_WIB = new Date(Date.UTC(2026, 11, 31, 23));

class FakeSeries implements ICodeNumberRepository {
	rows = new Map<string, TCodeNumberSeriesSelect>();

	async findAll() {
		return [...this.rows.values()];
	}

	async findByType(codeType: CodeType) {
		return this.rows.get(codeType) ?? null;
	}

	async allocate(module: string, codeType: CodeType, key: string) {
		const row = this.rows.get(codeType);
		if (!row) {
			this.rows.set(codeType, this.make({ module, codeType, periodKey: key, nextNumber: 2 }));
			return 1;
		}
		row.nextNumber = row.periodKey === key ? row.nextNumber + 1 : 2;
		row.periodKey = key;
		return row.nextNumber - 1;
	}

	async saveSettings(settings: TCodeNumberSettings, key: string) {
		const row =
			this.rows.get(settings.codeType) ??
			this.make({ module: settings.module, codeType: settings.codeType, periodKey: key, nextNumber: 1 });
		Object.assign(row, { pattern: settings.pattern, resetPolicy: settings.resetPolicy });
		this.rows.set(settings.codeType, row);
		return row;
	}

	private make(values: Partial<TCodeNumberSeriesSelect>): TCodeNumberSeriesSelect {
		return {
			id: crypto.randomUUID(),
			module: 'sales',
			codeType: 'quotation',
			pattern: null,
			resetPolicy: null,
			periodKey: 'all',
			nextNumber: 1,
			updatedBy: null,
			createdAt: new Date(0),
			updatedAt: new Date(0),
			deletedAt: null,
			...values,
		};
	}
}

function company(documentCode: string | null): ICompanyService {
	return {
		getProfile: async () =>
			documentCode ? ({ documentCode } as TCompanyProfileSnapshot) : null,
	};
}

describe('pattern rules', () => {
	test('renders the company format with a Roman month in Jakarta time', () => {
		expect(
			renderNumber('{SEQ:4}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YY}', {
				seq: 7,
				typeCode: 'QT',
				companyCode: 'IMS',
				date: OCT,
			}),
		).toBe('0007/QT/IMS/X/26');
		// 06:00 WIB on 1 January is already the new business year.
		expect(periodKey('yearly', NEW_YEAR_WIB)).toBe('2027');
		expect(periodKey('monthly', OCT)).toBe('2026-10');
		expect(periodKey('never', OCT)).toBe('all');
	});

	test('reports each problem as a code with its parameters', () => {
		expect(validatePattern('{SEQ}/{FOO}', 'quotation')).toEqual([
			{ code: 'unknownToken', params: { token: '{FOO}' } },
		]);
		expect(validatePattern('{TYPE}', 'quotation').map((p) => p.code)).toEqual(['seqOnce']);
		expect(validatePattern('{SEQ}/{SUPPLIER}', 'quotation')[0]).toEqual({
			code: 'tokenNotForType',
			params: { token: '{SUPPLIER}', types: 'purchase_order' },
		});
		expect(validatePattern('{SEQ}/{SUPPLIER}', 'purchase_order')).toEqual([]);
		expect(validatePattern('{SEQ:11}', 'quotation').map((p) => p.code)).toEqual(['seqWidth']);
		expect(validatePattern('{SEQ}#', 'quotation').map((p) => p.code)).toEqual(['literals']);
	});
});

describe('CodeNumberService', () => {
	let series: FakeSeries;
	let service: CodeNumberService;

	beforeEach(() => {
		series = new FakeSeries();
		service = new CodeNumberService(series, company('IMS'));
	});

	test('numbers increase within a period and restart in a new year', async () => {
		expect(await service.next('quotation', { date: OCT })).toBe('0001/QT/IMS/X/26');
		expect(await service.next('quotation', { date: OCT })).toBe('0002/QT/IMS/X/26');
		expect(await service.next('quotation', { date: NEW_YEAR_WIB })).toBe('0001/QT/IMS/I/27');
		// Another type has its own series.
		expect(await service.next('sales_invoice', { date: OCT })).toBe('0001/INV/IMS/X/26');
	});

	test('purchase orders restart monthly and fill supplier/category from the document', async () => {
		expect(
			await service.next('purchase_order', { date: OCT, context: { supplier: 'HIT', category: 'HW' } }),
		).toBe('PO/IMS-HIT/HW/1026/001');
	});

	test('warehouse codes are sequence-allocated (ERP-0042)', async () => {
		expect(await service.next('warehouse')).toBe('WH-0001');
		expect(await service.next('warehouse')).toBe('WH-0002');
	});

	test('a saved pattern applies to the next number; the preview does not reserve', async () => {
		await service.next('quotation', { date: OCT });
		const saved = await service.updateSetting(
			'quotation',
			{ pattern: 'SPH-{YYYY}-{SEQ:3}', resetPolicy: 'yearly' },
			'user-1',
		);
		expect(saved.isDefault).toBe(false);
		const preview = await service.preview('quotation', { pattern: 'SPH-{YYYY}-{SEQ:3}', resetPolicy: 'yearly' });
		expect(preview).toBe(saved.nextNumber);
		expect(await service.next('quotation', { date: OCT })).toBe('SPH-2026-002');
	});

	test('listSettings shows every type with defaults until overridden', async () => {
		const settings = await service.listSettings();
		const quotation = settings.find((s) => s.codeType === 'quotation');
		// One row per code type, no fewer (ERP-0043 added the three item kinds).
		expect(settings).toHaveLength(CODE_TYPES.length);
		expect(quotation).toMatchObject({ typeCode: 'QT', isDefault: true, resetPolicy: 'yearly' });
		expect(settings.find((s) => s.codeType === 'purchase_order')?.resetPolicy).toBe('monthly');
		expect(settings.find((s) => s.codeType === 'employee')).toMatchObject({
			typeCode: 'EMP',
			isDefault: true,
			resetPolicy: 'never',
		});
		expect(settings.find((s) => s.codeType === 'item_product')).toMatchObject({
			typeCode: 'PRD',
			isDefault: true,
			resetPolicy: 'never',
		});
	});

	test('invalid patterns, unknown types and a missing profile are refused', async () => {
		await expect(
			service.updateSetting('quotation', { pattern: '{TYPE}', resetPolicy: 'yearly' }, 'user-1'),
		).rejects.toBeInstanceOf(NumberingPatternError);
		await expect(service.preview('nope', { pattern: '{SEQ}', resetPolicy: 'never' })).rejects.toBeInstanceOf(
			UnknownCodeTypeError,
		);
		const withoutProfile = new CodeNumberService(series, company(null));
		await expect(withoutProfile.next('quotation')).rejects.toBeInstanceOf(CompanyProfileRequiredError);
	});

	test('a pattern error carries its locale key and parameters', async () => {
		const error = await service
			.updateSetting('quotation', { pattern: '{SEQ}/{FOO}', resetPolicy: 'yearly' }, 'user-1')
			.catch((e: NumberingPatternError) => e);
		expect(error).toBeInstanceOf(NumberingPatternError);
		expect((error as NumberingPatternError).key).toBe('numbering.pattern.unknownToken');
		expect((error as NumberingPatternError).params).toEqual({ token: '{FOO}' });
	});
});
