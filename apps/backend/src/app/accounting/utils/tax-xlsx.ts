/**
 * XLSX serialization for the period recap (phase 3, ERP-0016) via `exceljs`.
 *
 * @remarks
 * Write-only use of exceljs: the workbook is built from our own recap data and
 * streamed out — `Workbook.xlsx.load()` (the parse path holding the known
 * advisories) is never called. Cell values are plain numbers/strings, so
 * formula injection is not applicable; numbers keep their numeric type so
 * finance can total them in Excel.
 *
 * Column layout mirrors the phase-2 CSV placeholder set and is still a finance
 * gate (D12).
 */
import ExcelJS from 'exceljs';
import type { TRecapCsvLine } from './tax-csv';

const HEADERS = [
	'Tax code',
	'Taxable base',
	'Tax amount',
	'Corrections',
	'Net payable',
	'Status',
] as const;

/**
 * Builds the recap workbook: one row per recap line plus a bold TOTAL footer.
 * Returns a Buffer ready to stream as an attachment.
 */
export async function recapToXlsx(
	lines: readonly TRecapCsvLine[],
	period: { year: number; month: number },
): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'IMS ERP';
	workbook.created = new Date();

	const sheet = workbook.addWorksheet(
		`Tax recap ${period.year}-${String(period.month).padStart(2, '0')}`,
	);

	sheet.columns = HEADERS.map((header, index) => ({
		header,
		key: ['code', 'taxableBase', 'taxAmount', 'correctionTotal', 'netPayable', 'filingStatus'][
			index
		],
		width: index === 0 ? 18 : 16,
	}));

	for (const line of lines) {
		sheet.addRow({
			code: line.code,
			taxableBase: line.taxableBase / 100,
			taxAmount: line.taxAmount / 100,
			correctionTotal: line.correctionTotal / 100,
			netPayable: line.netPayable / 100,
			filingStatus: line.filingStatus,
		});
	}

	const total = lines.reduce(
		(accumulator, line) => ({
			taxableBase: accumulator.taxableBase + line.taxableBase,
			taxAmount: accumulator.taxAmount + line.taxAmount,
			correctionTotal: accumulator.correctionTotal + line.correctionTotal,
			netPayable: accumulator.netPayable + line.netPayable,
		}),
		{ taxableBase: 0, taxAmount: 0, correctionTotal: 0, netPayable: 0 },
	);
	const totalRow = sheet.addRow({
		code: 'TOTAL',
		taxableBase: total.taxableBase / 100,
		taxAmount: total.taxAmount / 100,
		correctionTotal: total.correctionTotal / 100,
		netPayable: total.netPayable / 100,
		filingStatus: '',
	});
	totalRow.font = { bold: true };

	// Rupiah number format on the money columns (B..E) for every data row.
	for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
		for (const column of ['B', 'C', 'D', 'E']) {
			sheet.getCell(`${column}${rowIndex}`).numFmt = '#,##0.00';
		}
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
