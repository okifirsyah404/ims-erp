/**
 * Document numbering unit tests (ported from the M02 branch, ADR-0011).
 *
 * @remarks
 * Covers the pure pattern rules and the service around a fake repository
 * that mirrors the atomic `allocate` contract: same period increments,
 * a new period starts at 1. The SQL itself is checked against PostgreSQL by
 * the live HTTP verification recorded in `docs/plan/progress.md`.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	DocumentType,
	TCompanyProfileSelect,
	TDocumentSequenceSelect,
} from '@drizzle/schemas/organization.schema';
import type { ICompanyProfileRepository } from '../../src/app/organization/contracts/company-profile.repository.interface';
import type {
	IDocumentSequenceRepository,
	TDocumentSequenceSettings,
} from '../../src/app/organization/contracts/document-sequence.repository.interface';
import {
	periodKey,
	renderNumber,
	validatePattern,
} from '../../src/app/organization/domain/document-number';
import {
	CompanyProfileRequiredError,
	NumberingPatternError,
	UnknownDocumentTypeError,
} from '../../src/app/organization/errors/organization.errors';
import { NumberingService } from '../../src/app/organization/services/numbering.service';

/** 15 Oct 2026, 10:00 WIB. */
const OCT = new Date(Date.UTC(2026, 9, 15, 3));
/** 1 Jan 2027, 06:00 WIB (still 31 Dec 2026 in UTC). */
const NEW_YEAR_WIB = new Date(Date.UTC(2026, 11, 31, 23));

class FakeSequences implements IDocumentSequenceRepository {
	rows = new Map<string, TDocumentSequenceSelect>();

	async findAll() {
		return [...this.rows.values()];
	}

	async findByType(documentType: DocumentType) {
		return this.rows.get(documentType) ?? null;
	}

	async allocate(module: string, documentType: DocumentType, key: string) {
		const row = this.rows.get(documentType);
		if (!row) {
			this.rows.set(documentType, this.make({ module, documentType, periodKey: key, nextNumber: 2 }));
			return 1;
		}
		row.nextNumber = row.periodKey === key ? row.nextNumber + 1 : 2;
		row.periodKey = key;
		return row.nextNumber - 1;
	}

	async saveSettings(settings: TDocumentSequenceSettings, key: string) {
		const row =
			this.rows.get(settings.documentType) ??
			this.make({ module: settings.module, documentType: settings.documentType, periodKey: key, nextNumber: 1 });
		Object.assign(row, { pattern: settings.pattern, resetPolicy: settings.resetPolicy });
		this.rows.set(settings.documentType, row);
		return row;
	}

	private make(values: Partial<TDocumentSequenceSelect>): TDocumentSequenceSelect {
		return {
			id: crypto.randomUUID(),
			module: 'sales',
			documentType: 'quotation',
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

function profiles(documentCode: string | null): Pick<ICompanyProfileRepository, 'findProfile'> {
	return {
		findProfile: async () =>
			documentCode ? ({ documentCode } as TCompanyProfileSelect) : null,
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

describe('NumberingService', () => {
	let sequences: FakeSequences;
	let service: NumberingService;

	beforeEach(() => {
		sequences = new FakeSequences();
		service = new NumberingService(sequences, profiles('IMS'));
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
		const quotation = settings.find((s) => s.documentType === 'quotation');
		expect(settings).toHaveLength(28);
		expect(quotation).toMatchObject({ typeCode: 'QT', isDefault: true, resetPolicy: 'yearly' });
		expect(settings.find((s) => s.documentType === 'purchase_order')?.resetPolicy).toBe('monthly');
		expect(settings.find((s) => s.documentType === 'employee')).toMatchObject({
			typeCode: 'EMP',
			isDefault: true,
			resetPolicy: 'never',
		});
	});

	test('invalid patterns, unknown types and a missing profile are refused', async () => {
		await expect(
			service.updateSetting('quotation', { pattern: '{TYPE}', resetPolicy: 'yearly' }, 'user-1'),
		).rejects.toBeInstanceOf(NumberingPatternError);
		await expect(service.preview('nope', { pattern: '{SEQ}', resetPolicy: 'never' })).rejects.toBeInstanceOf(
			UnknownDocumentTypeError,
		);
		const withoutProfile = new NumberingService(sequences, profiles(null));
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
