/**
 * PPh 21 tables and arithmetic (ERP-0138): TER lookup, Pasal 17, annual
 * reconciliation, the TER CSV import, and the statutory payroll settings.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Pph21TableService } from '../../src/app/tax/services/pph21-table.service';
import { TerImportFileError } from '../../src/app/tax/errors/tax.errors';
import { annualPph21, applyRate, progressiveTax, ptkpFor, rateMicro, terRateFor } from '../../src/app/tax/utils/pph21';
import { PayrollStatutoryService } from '../../src/app/human-resource/services/payroll-statutory.service';

const rp = (rupiah: number) => rupiah * 100;
const BRACKETS = [
	{ lowerBound: 0, rate: '5.0000' },
	{ lowerBound: rp(60_000_000), rate: '15.0000' },
	{ lowerBound: rp(250_000_000), rate: '25.0000' },
	{ lowerBound: rp(500_000_000), rate: '30.0000' },
	{ lowerBound: rp(5_000_000_000), rate: '35.0000' },
];

describe('PPh 21 arithmetic', () => {
	test('rates are exact integers; amounts round down to whole rupiah', () => {
		expect(rateMicro('0.2500')).toBe(2500);
		expect(rateMicro('35.0000')).toBe(350_000);
		expect(applyRate(rp(10_000_000), '2.2500')).toBe(rp(225_000));
		expect(applyRate(rp(1_234_567), '0.2500')).toBe(rp(3_086));
		expect(applyRate(0, '5.0000')).toBe(0);
	});

	test('TER band: the highest lower bound at or below the gross, per category', () => {
		const tables = {
			ter: [
				{ category: 'A', lowerBound: 0, rate: '0.0000' },
				{ category: 'A', lowerBound: rp(5_400_001), rate: '0.2500' },
				{ category: 'B', lowerBound: 0, rate: '0.0000' },
			],
		};
		expect(terRateFor(tables, 'A', rp(5_400_000))).toBe('0.0000');
		expect(terRateFor(tables, 'A', rp(5_400_001))).toBe('0.2500');
		expect(terRateFor(tables, 'A', rp(9_000_000))).toBe('0.2500');
		expect(terRateFor(tables, 'C', rp(9_000_000))).toBeNull();
	});

	test('a missing PTKP status counts as TK/0', () => {
		const tables = {
			ptkp: [
				{ statusCode: 'TK/0', annualAmount: rp(54_000_000), terCategory: 'A' },
				{ statusCode: 'K/3', annualAmount: rp(72_000_000), terCategory: 'C' },
			],
		};
		expect(ptkpFor(tables, null)?.annualAmount).toBe(rp(54_000_000));
		expect(ptkpFor(tables, 'K/3')?.terCategory).toBe('C');
		expect(ptkpFor(tables, 'K/1')?.statusCode).toBe('TK/0');
	});

	test('Pasal 17 is progressive across brackets', () => {
		expect(progressiveTax(rp(100_000_000), BRACKETS)).toBe(rp(9_000_000));
		expect(progressiveTax(rp(60_000_000), BRACKETS)).toBe(rp(3_000_000));
		expect(progressiveTax(rp(300_000_000), BRACKETS)).toBe(rp(3_000_000 + 28_500_000 + 12_500_000));
		expect(progressiveTax(0, BRACKETS)).toBe(0);
	});

	test('annual reconciliation caps position cost and pension, rounds PKP to thousands', () => {
		const result = annualPph21({
			annualGross: rp(120_000_000),
			months: 12,
			pensionContribution: rp(3_600_000),
			ptkpAnnual: rp(54_000_000),
			brackets: BRACKETS,
		});
		expect(result).toEqual({
			annualGross: rp(120_000_000),
			positionCost: rp(6_000_000),
			pension: rp(2_400_000),
			annualNet: rp(111_600_000),
			ptkp: rp(54_000_000),
			pkp: rp(57_600_000),
			annualTax: rp(2_880_000),
		});
		const partYear = annualPph21({ annualGross: rp(30_000_123), months: 3, pensionContribution: 0, ptkpAnnual: rp(54_000_000), brackets: BRACKETS });
		expect(partYear.positionCost).toBe(rp(1_500_000));
		expect(partYear.pkp).toBe(0);
		expect(partYear.annualTax).toBe(0);
	});
});

describe('TER import', () => {
	function harness() {
		const replaced: unknown[][] = [];
		const service = new Pph21TableService(
			{
				listPtkpInForce: async () => [],
				listTerInForce: async () => [],
				listBracketsInForce: async () => [],
				listTerVersions: async () => [],
				replaceTerRates: async (rows: unknown[]) => {
					replaced.push(rows);
				},
			},
			{ run: <T>(work: (tx: never) => Promise<T>) => work({} as never) } as never,
		);
		return { service, replaced };
	}
	const csv = (text: string, name = 'ter.csv') => new File([text], name, { type: 'text/csv' });

	test('valid rows replace the table of their effective date', async () => {
		const h = harness();
		const result = await h.service.importTer(
			csv('kategori,penghasilan_bruto_dari,tarif_persen,berlaku_mulai\nA,0,0,2024-01-01\nA,"5.400.001","0,25",2024-01-01\nb;0;0;2024-01-01'.replace('b;0;0;2024-01-01', 'B,0,0,2024-01-01')),
		);
		expect(result).toEqual({ imported: 3, effectiveFrom: ['2024-01-01'], errors: [] });
		expect(h.replaced[0]).toEqual([
			{ category: 'A', lowerBound: 0, rate: '0.0000', effectiveFrom: '2024-01-01' },
			{ category: 'A', lowerBound: rp(5_400_001), rate: '0.2500', effectiveFrom: '2024-01-01' },
			{ category: 'B', lowerBound: 0, rate: '0.0000', effectiveFrom: '2024-01-01' },
		]);
	});

	test('any bad row rejects the whole file', async () => {
		const h = harness();
		const result = await h.service.importTer(csv('A,1000,0.25,2024-01-01\nD,0,0,2024-01-01\nA,1000,101,2024-13-01\nA,1000,0.25,2024-01-01'));
		expect(result.imported).toBe(0);
		expect(result.errors.map((error) => error.code).sort()).toEqual(
			['dateInvalid', 'duplicate', 'rateInvalid', 'terCategoryInvalid', 'terStartMissing'].sort(),
		);
		expect(h.replaced).toEqual([]);
	});

	test('only non-empty .csv files are read', async () => {
		const h = harness();
		await expect(h.service.importTer(csv('A,0,0,2024-01-01', 'ter.xlsx'))).rejects.toThrow(TerImportFileError);
		await expect(h.service.importTer(csv(''))).rejects.toThrow(TerImportFileError);
		await expect(h.service.importTer('not a file')).rejects.toThrow(TerImportFileError);
	});
});

describe('PayrollStatutoryService', () => {
	function harness() {
		const store = new Map<string, string | null>();
		const service = new PayrollStatutoryService({
			find: async (_group: string, key: string) => (store.has(key) ? ({ settingValue: store.get(key) } as never) : null),
			upsert: async (_group: string, key: string, value: string | null) => {
				store.set(key, value);
			},
		});
		return { service, store };
	}

	test('defaults: everything off, health cap Rp12.000.000, no JP cap', async () => {
		expect(await harness().service.get()).toEqual({
			pph21Enabled: false,
			bpjsHealthEnabled: false,
			bpjsEmploymentEnabled: false,
			jkkRate: '0.24',
			healthWageCap: rp(12_000_000),
			pensionWageCap: null,
		});
	});

	test('saved values read back', async () => {
		const h = harness();
		const body = {
			pph21Enabled: true,
			bpjsHealthEnabled: true,
			bpjsEmploymentEnabled: true,
			jkkRate: '0.54',
			healthWageCap: rp(12_000_000),
			pensionWageCap: rp(10_000_000),
		};
		expect(await h.service.save('admin', body)).toEqual(body);
		expect(h.store.get('pph21_enabled')).toBe('true');
	});
});
