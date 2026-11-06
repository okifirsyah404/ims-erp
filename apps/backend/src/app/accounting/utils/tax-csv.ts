/**
 * CSV serialization for the period recap (phase 2, ERP-0016).
 *
 * @remarks
 * D12 marks the column list as a finance gate; these columns are the
 * placeholder recap shape (`TRecapLine`) until finance confirms the final
 * layout. Semicolon delimiter and comma decimal mark are not applied yet —
 * plain RFC 4180 CSV with a UTF-8 BOM so Excel opens it correctly.
 */

/** One CSV row per recap line, plus a TOTAL footer row. */
export function recapToCsv(lines: readonly TRecapCsvLine[]): string {
	const header = [
		'tax_code',
		'taxable_base',
		'tax_amount',
		'correction_total',
		'net_payable',
		'filing_status',
	];
	const rows = lines.map((line) =>
		[
			line.code,
			line.taxableBase,
			line.taxAmount,
			line.correctionTotal,
			line.netPayable,
			line.filingStatus,
		]
			.map(csvField)
			.join(','),
	);
	const total = lines.reduce(
		(accumulator, line) => ({
			taxableBase: accumulator.taxableBase + line.taxableBase,
			taxAmount: accumulator.taxAmount + line.taxAmount,
			correctionTotal: accumulator.correctionTotal + line.correctionTotal,
			netPayable: accumulator.netPayable + line.netPayable,
		}),
		{ taxableBase: 0, taxAmount: 0, correctionTotal: 0, netPayable: 0 },
	);
	const footer = ['TOTAL', total.taxableBase, total.taxAmount, total.correctionTotal, total.netPayable, '']
		.map(csvField)
		.join(',');
	return [`\uFEFF${header.join(',')}`, ...rows, footer].join('\r\n');
}

export type TRecapCsvLine = {
	code: string;
	taxableBase: number;
	taxAmount: number;
	correctionTotal: number;
	netPayable: number;
	filingStatus: string;
};

/** Quotes a field when it contains a comma, quote, or newline. */
function csvField(value: string | number): string {
	const text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
