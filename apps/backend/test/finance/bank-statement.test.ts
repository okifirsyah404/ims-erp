/**
 * Bank statement CSV import and auto-match (ERP-0143).
 */
import { describe, expect, test } from 'bun:test';
import { matchStatement, parseStatement, statementAmount, statementMappingSchema } from '../../src/app/finance/utils/bank-statement';

const rp = (rupiah: number) => rupiah * 100;

describe('statement amounts', () => {
	test('Indonesian and English separators, signs and DB/CR suffixes', () => {
		expect(statementAmount('1.500.000,50', ',')).toBe(rp(1_500_000) + 50);
		expect(statementAmount('1,500,000.50', '.')).toBe(rp(1_500_000) + 50);
		expect(statementAmount('-250.000', ',')).toBe(-rp(250_000));
		expect(statementAmount('(250.000)', ',')).toBe(-rp(250_000));
		expect(statementAmount('2,500,000.00 CR', '.')).toBe(rp(2_500_000));
		expect(statementAmount('abc', ',')).toBeNull();
	});
});

describe('parseStatement', () => {
	test('indicator mode with DD/MM dates takes the year of the statement (BCA-style)', () => {
		const mapping = statementMappingSchema.parse({
			skipRows: 1,
			dateColumn: 1,
			dateFormat: 'DD/MM',
			descriptionColumn: 2,
			amountMode: 'indicator',
			amountColumn: 4,
			indicatorColumn: 5,
			decimalSeparator: '.',
		});
		const csv = [
			'Tanggal,Keterangan,Cabang,Jumlah,DB/CR,Saldo',
			"'03/11,TRSF E-BANKING CR PT SATU INV-2026-0001,0000,\"11,100,000.00\",CR,\"20,000,000.00\"",
			"'04/11,BIAYA ADM,0000,\"15,000.00\",DB,\"19,985,000.00\"",
			'Saldo Akhir,,,,,"19,985,000.00"',
		].join('\n');
		const { lines, errors } = parseStatement(csv.replace(/'/g, ''), mapping, 2026);
		expect(errors).toEqual([]);
		expect(lines).toEqual([
			{ row: 2, date: '2026-11-03', description: 'TRSF E-BANKING CR PT SATU INV-2026-0001', reference: null, direction: 'in', amount: rp(11_100_000) },
			{ row: 3, date: '2026-11-04', description: 'BIAYA ADM', reference: null, direction: 'out', amount: rp(15_000) },
		]);
	});

	test('split debit/credit columns with ; and a reference column', () => {
		const mapping = statementMappingSchema.parse({
			delimiter: ';',
			dateColumn: 1,
			dateFormat: 'DD/MM/YYYY',
			descriptionColumn: 2,
			referenceColumn: 3,
			amountMode: 'split',
			debitColumn: 4,
			creditColumn: 5,
		});
		const { lines } = parseStatement('Tgl;Uraian;Ref;Debet;Kredit\n05/11/2026;Bayar pemasok;BILL-9;1.000.000,00;\n06/11/2026;Jasa giro;;;12.345,67', mapping, 2026);
		expect(lines.map((line) => [line.date, line.direction, line.amount, line.reference])).toEqual([
			['2026-11-05', 'out', rp(1_000_000), 'BILL-9'],
			['2026-11-06', 'in', rp(12_345) + 67, null],
		]);
	});

	test('a dated row with an unreadable amount is an error; mappings need their columns', () => {
		const mapping = statementMappingSchema.parse({ dateColumn: 1, dateFormat: 'YYYY-MM-DD', descriptionColumn: 2, amountMode: 'signed', amountColumn: 3 });
		expect(parseStatement('h\n2026-11-01,x,abc', mapping, 2026).errors[0]?.code).toBe('amountInvalid');
		expect(() => statementMappingSchema.parse({ dateColumn: 1, dateFormat: 'YYYY-MM-DD', descriptionColumn: 2, amountMode: 'split', debitColumn: 3 })).toThrow();
	});
});

describe('matchStatement', () => {
	const line = (id: string, date: string, amount: number, text = '', direction: 'in' | 'out' = 'in') => ({ id, date, amount, text, direction });
	const book = (id: string, date: string, amount: number, references: string[] = [], direction: 'in' | 'out' = 'in') => ({ id, date, amount, references, direction });

	test('same amount and direction within 3 days; reference beats a nearer date', () => {
		const pairs = matchStatement(
			[line('L1', '2026-11-03', rp(500_000), 'TRSF INV-2026-0007')],
			[book('B1', '2026-11-03', rp(500_000), ['CB-0001']), book('B2', '2026-11-01', rp(500_000), ['CB-0002', 'INV-2026-0007'])],
		);
		expect(pairs).toEqual([{ lineId: 'L1', transactionId: 'B2' }]);
	});

	test('outside 3 days, other direction or amount do not match; ties without reference stay manual', () => {
		expect(matchStatement([line('L1', '2026-11-10', rp(1))], [book('B1', '2026-11-06', rp(1))])).toEqual([]);
		expect(matchStatement([line('L1', '2026-11-10', rp(1))], [book('B1', '2026-11-10', rp(1), [], 'out')])).toEqual([]);
		expect(
			matchStatement([line('L1', '2026-11-10', rp(1))], [book('B1', '2026-11-09', rp(1)), book('B2', '2026-11-11', rp(1))]),
		).toEqual([]);
	});

	test('each book movement is used once', () => {
		const pairs = matchStatement(
			[line('L1', '2026-11-03', rp(100)), line('L2', '2026-11-04', rp(100))],
			[book('B1', '2026-11-03', rp(100)), book('B2', '2026-11-05', rp(100))],
		);
		expect(pairs).toEqual([
			{ lineId: 'L1', transactionId: 'B1' },
			{ lineId: 'L2', transactionId: 'B2' },
		]);
	});
});
