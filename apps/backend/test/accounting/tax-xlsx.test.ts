/**
 * Tax XLSX export tests (ERP-0016 phase 3).
 *
 * The workbook is built from our own recap data and parsed back with exceljs
 * to pin the contract: sheet name, headers, one numeric row per recap line,
 * a bold TOTAL footer, and rupiah number formats. Parsing our own output here
 * does not touch the advisory-relevant untrusted-input path.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { recapToXlsx } from '../../src/app/accounting/utils/tax-xlsx';
import type { TRecapCsvLine } from '../../src/app/accounting/utils/tax-csv';

const LINES: TRecapCsvLine[] = [
	{
		code: 'PPN',
		taxableBase: 100_000_000,
		taxAmount: 11_000_000,
		correctionTotal: -500_000,
		netPayable: 10_500_000,
		filingStatus: 'verified',
	},
	{
		code: 'PPh 23',
		taxableBase: 50_000_000,
		taxAmount: 1_000_000,
		correctionTotal: 0,
		netPayable: 1_000_000,
		filingStatus: 'draft',
	},
];

describe('recapToXlsx', () => {
	test('builds a workbook with headers, numeric rows, and a bold TOTAL', async () => {
		const buffer = await recapToXlsx(LINES, { year: 2026, month: 1 });

		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
		const sheet = workbook.worksheets[0];

		expect(sheet).toBeDefined();
		expect(sheet.name).toBe('Tax recap 2026-01');

		const headerRow = sheet.getRow(1);
		expect(headerRow.getCell(1).value).toBe('Tax code');
		expect(headerRow.getCell(6).value).toBe('Status');

		const first = sheet.getRow(2);
		expect(first.getCell(1).value).toBe('PPN');
		// Minor units are converted to whole rupiah numbers.
		expect(first.getCell(2).value).toBe(1_000_000);
		expect(first.getCell(3).value).toBe(110_000);
		expect(first.getCell(4).value).toBe(-5_000);
		expect(first.getCell(5).value).toBe(105_000);
		expect(first.getCell(6).value).toBe('verified');

		const total = sheet.getRow(sheet.rowCount);
		expect(total.getCell(1).value).toBe('TOTAL');
		expect(total.getCell(5).value).toBe(115_000);
		expect(total.font?.bold).toBe(true);
	});

	test('renders an empty recap as headers plus a zero TOTAL', async () => {
		const buffer = await recapToXlsx([], { year: 2026, month: 2 });
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
		const sheet = workbook.worksheets[0];

		expect(sheet.rowCount).toBe(2);
		expect(sheet.getRow(2).getCell(1).value).toBe('TOTAL');
		expect(sheet.getRow(2).getCell(5).value).toBe(0);
	});

	test('applies a rupiah number format to the money columns', async () => {
		const buffer = await recapToXlsx(LINES, { year: 2026, month: 1 });
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
		const sheet = workbook.worksheets[0];

		expect(sheet.getCell('B2').numFmt).toBe('#,##0.00');
		expect(sheet.getCell('E2').numFmt).toBe('#,##0.00');
	});
});
