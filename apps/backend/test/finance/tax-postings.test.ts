/**
 * Tax postings (ERP-0140): Coretax XML builders, PPN period settlement and
 * tax payments.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { buildBupotXml, buildFakturXml, normalizeTin, rupiah } from '../../src/app/tax/utils/coretax-xml';
import { TaxLedgerService } from '../../src/app/finance/services/tax-ledger.service';

describe('Coretax XML', () => {
	test('amounts are rupiah with two decimals; NPWP is 16 digits', () => {
		expect(rupiah(123_456)).toBe('1234.56');
		expect(rupiah(100)).toBe('1.00');
		expect(normalizeTin('01.234.567.8-901.000')).toBe('0012345678901000');
		expect(normalizeTin('3201234567890001')).toBe('3201234567890001');
		expect(normalizeTin('123')).toBeNull();
	});

	test('faktur uses DPP nilai lain 11/12 at 12% and escapes text', () => {
		const xml = buildFakturXml('0012345678901000', [
			{
				date: '2026-11-10',
				reference: 'INV/001',
				buyerTin: '0098765432109000',
				buyerName: 'PT A & B',
				buyerAddress: 'Jl. Merdeka',
				buyerEmail: null,
				lines: [{ name: 'Controller', isService: false, quantity: 1, unitPrice: 1_200_000_00, discount: 0, taxBase: 1_200_000_00 }],
			},
		]);
		expect(xml).toContain('<TrxCode>04</TrxCode>');
		expect(xml).toContain('<TaxBase>1200000.00</TaxBase>');
		expect(xml).toContain('<OtherTaxBase>1100000.00</OtherTaxBase>');
		expect(xml).toContain('<VAT>132000.00</VAT>');
		expect(xml).toContain('<BuyerName>PT A &amp; B</BuyerName>');
		expect(xml).toContain('<SellerIDTKU>0012345678901000000000</SellerIDTKU>');
	});

	test('bukti potong carries object code, base and rate', () => {
		const xml = buildBupotXml('0012345678901000', [
			{
				periodYear: 2026,
				periodMonth: 11,
				counterpartyTin: '0098765432109000',
				taxObjectCode: '24-104-14',
				taxBase: 1_000_000_00,
				ratePercent: '2',
				documentNumber: 'WHT-1',
				documentDate: '2026-11-20',
				withholdingDate: '2026-11-20',
			},
		]);
		expect(xml).toContain('<TaxObjectCode>24-104-14</TaxObjectCode>');
		expect(xml).toContain('<TaxBase>1000000.00</TaxBase>');
		expect(xml).toContain('<Rate>2</Rate>');
	});
});

describe('TaxLedgerService', () => {
	const accounts: Record<string, string> = {
		vat_output: 'acc-out',
		vat_input: 'acc-in',
		vat_payable: 'acc-payable',
		vat_overpaid: 'acc-overpaid',
		wht_payable: 'acc-wht23',
	};
	function harness(activity: Array<{ accountId: string; debit: number; credit: number }>) {
		const posted: Array<{ lines: Array<{ accountId: string; debit: number; credit: number }>; idempotencyKey: string }> = [];
		const movements: Array<Record<string, unknown>> = [];
		const service = new TaxLedgerService(
			{ run: <T>(work: (tx: never) => Promise<T>) => work({} as never) } as never,
			{ findPeriodByMonth: async () => ({ id: 'per', startDate: '2026-11-01', endDate: '2026-11-30' }) as never },
			{
				listAccountActivity: async () => activity,
				findPostedEntryByIdempotencyKey: async (_org: string, key: string) =>
					posted.some((entry) => entry.idempotencyKey === key) ? ({ id: 'je-ppn' } as never) : null,
				findLinesByEntryId: async () => posted[0].lines as never,
			},
			{
				resolveAccountId: async (_org: string, lookup: { role: string; discriminatorValue?: string | null }) =>
					lookup.discriminatorValue === 'PPH4_2' ? 'acc-wht42' : accounts[lookup.role],
			},
			{
				post: async (_tx: unknown, input: never) => {
					posted.push(input);
					return { entry: { id: 'je-ppn' } } as never;
				},
			} as never,
			{
				postMovement: async (_ctx: unknown, input: Record<string, unknown>) => {
					movements.push(input);
					return { id: 'cb' } as never;
				},
			},
		);
		return { service, posted, movements };
	}
	const ctx = { organizationId: 'org-1', actorUserId: 'acc' };

	test('output above input: the difference goes to Utang PPN', async () => {
		const h = harness([
			{ accountId: 'acc-out', debit: 0, credit: 1_100_000 },
			{ accountId: 'acc-in', debit: 400_000, credit: 0 },
		]);
		const result = await h.service.settlePpn(ctx, 2026, 11);
		expect(result).toMatchObject({ output: 1_100_000, input: 400_000, net: 700_000, journalEntryId: 'je-ppn' });
		expect(h.posted[0].lines).toEqual([
			{ accountId: 'acc-out', debit: 1_100_000, credit: 0 },
			{ accountId: 'acc-in', debit: 0, credit: 400_000 },
			{ accountId: 'acc-payable', debit: 0, credit: 700_000 },
		]);
		expect(h.posted[0].idempotencyKey).toBe('ppn_settlement:2026-11');
		const again = await h.service.settlePpn(ctx, 2026, 11);
		expect(again).toMatchObject({ output: 1_100_000, input: 400_000, net: 700_000, journalEntryId: 'je-ppn' });
		expect(h.posted).toHaveLength(1);
	});

	test('input above output: the difference is PPN lebih bayar', async () => {
		const h = harness([
			{ accountId: 'acc-out', debit: 0, credit: 100_000 },
			{ accountId: 'acc-in', debit: 300_000, credit: 0 },
		]);
		await h.service.settlePpn(ctx, 2026, 11);
		expect(h.posted[0].lines[2]).toEqual({ accountId: 'acc-overpaid', debit: 200_000, credit: 0 });
	});

	test('a month without PPN posts nothing', async () => {
		const h = harness([]);
		expect((await h.service.settlePpn(ctx, 2026, 11)).journalEntryId).toBeNull();
		expect(h.posted).toEqual([]);
	});

	test('a PPh payment goes out against the payable of its tax code', async () => {
		const h = harness([]);
		await h.service.payTax(ctx, {
			role: 'wht_payable',
			taxCode: 'PPH4_2',
			cashBankAccountId: 'bca',
			paymentDate: '2026-12-10',
			amount: 50_000,
			reference: 'NTPN-1',
		});
		expect(h.movements[0]).toMatchObject({ direction: 'out', amount: 50_000, counterpartAccountId: 'acc-wht42' });
	});
});
