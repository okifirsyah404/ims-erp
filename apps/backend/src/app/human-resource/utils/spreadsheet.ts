import ExcelJS from 'exceljs';

/**
 * Spreadsheet import/export helpers for the HR templates (M08): `.xlsx`
 * through exceljs, `.csv` (comma or semicolon) by hand. Every cell comes
 * back as trimmed text: dates as `YYYY-MM-DD`, times as `HH:MM`.
 */

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

/** What a cell holds, as text. */
function cellText(value: ExcelJS.CellValue): string {
	if (value === null || value === undefined) return '';
	if (value instanceof Date) {
		// Excel times are dates on 1899-12-30; real dates keep their day.
		if (value.getUTCFullYear() < 1901) return value.toISOString().slice(11, 16);
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === 'object') {
		if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
		if ('richText' in value) return value.richText.map((part) => part.text).join('');
		if ('text' in value) return String(value.text);
		return '';
	}
	return String(value).trim();
}

function parseCsv(text: string): string[][] {
	const delimiter = (text.split('\n')[0] ?? '').includes(';') ? ';' : ',';
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const char = text[i]!;
		if (quoted) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') quoted = false;
			else field += char;
		} else if (char === '"') quoted = true;
		else if (char === delimiter) {
			row.push(field.trim());
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++;
			row.push(field.trim());
			rows.push(row);
			row = [];
			field = '';
		} else field += char;
	}
	if (field !== '' || row.length > 0) {
		row.push(field.trim());
		rows.push(row);
	}
	return rows;
}

/**
 * The data rows of an uploaded template (the header row is dropped; blank
 * rows are skipped but keep their spreadsheet row number).
 *
 * @returns Rows with their 1-based spreadsheet row number
 */
export async function readRows(file: File): Promise<{ row: number; cells: string[] }[]> {
	const name = file.name.toLowerCase();
	let table: string[][];
	if (name.endsWith('.csv')) {
		table = parseCsv((await file.text()).replace(/^﻿/, ''));
	} else {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(await file.arrayBuffer());
		const sheet = workbook.worksheets[0];
		table = [];
		sheet?.eachRow({ includeEmpty: true }, (row) => {
			const values = Array.isArray(row.values) ? row.values.slice(1) : [];
			table.push(values.map((value) => cellText(value as ExcelJS.CellValue)));
		});
	}
	return table
		.map((cells, index) => ({ row: index + 1, cells }))
		.slice(1)
		.filter(({ cells }) => cells.some((cell) => cell !== ''));
}

/** A one-sheet `.xlsx` with a bold header row and example rows. */
export async function templateWorkbook(sheetName: string, headers: string[], examples: (string | number)[][]): Promise<Uint8Array> {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet(sheetName);
	sheet.addRow(headers).font = { bold: true };
	for (const example of examples) sheet.addRow(example);
	sheet.columns.forEach((column) => {
		column.width = 18;
		// Text cells, so dates and times stay as typed.
		column.numFmt = '@';
	});
	return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** An `.xlsx` download response. */
export function xlsxResponse(bytes: Uint8Array, filename: string): Response {
	return new Response(new Blob([bytes as BlobPart]), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`,
		},
	});
}
