/**
 * Receipts and gateway settlement (ERP-0139): kuitansi journals, open-item
 * updates, status after credit memos, and the gateway payout split.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import type { TReceiptSelect } from '@drizzle/schemas/sale.schema';
import { receiptStatus } from '../../src/app/sale/utils/payment-status';
import { ReceiptLedgerService } from '../../src/app/sale/services/receipt-ledger.service';
import { GatewaySettlementService } from '../../src/app/finance/services/gateway-settlement.service';
import { GatewaySettlementAmountError } from '../../src/app/finance/errors/ledger.errors';

const receipt = {
	id: 'rcp-1',
	organizationId: 'org-1',
	invoiceId: 'inv-1',
	code: 'KW-1',
	receivedDate: '2026-11-25',
	amount: 400_000,
	method: 'cash',
	receivedBy: 'finance-a',
} as unknown as TReceiptSelect;

function ledgerHarness(existing: { status: string; reversedByEntryId: string | null } | null = null) {
	const posted: Array<{ eventType: string; lines: Array<Record<string, unknown>> }> = [];
	const applied: number[] = [];
	const reversed: string[] = [];
	const service = new ReceiptLedgerService(
		{
			postBusinessEvent: async (_tx: unknown, input: { eventType: string; lines: never }) => {
				posted.push({ eventType: input.eventType, lines: input.lines });
				return { entry: { id: 'je-1' } } as never;
			},
			reverse: async (_tx: unknown, _org: string, entryId: string) => {
				reversed.push(entryId);
				return {} as never;
			},
		} as never,
		{
			applyReceipt: async (_org: string, _invoice: string, delta: number) => {
				applied.push(delta);
			},
			findPostedEntryForSource: async () => (existing ? ({ id: 'je-1', ...existing } as never) : null),
		},
	);
	return { service, posted, applied, reversed };
}

describe('receipt status', () => {
	test('a credit memo can make an invoice paid below its grand total', () => {
		expect(receiptStatus(600_000, 0)).toBe('paid');
		expect(receiptStatus(400_000, 200_000)).toBe('partially_paid');
		expect(receiptStatus(0, 1_000_000)).toBe('issued');
	});
});

describe('ReceiptLedgerService', () => {
	const invoice = { id: 'inv-1', code: 'INV-1', customerId: 'cus-1' };

	test('a manual receipt debits cash by method and credits the receivable', async () => {
		const h = ledgerHarness();
		await h.service.post({} as never, receipt, invoice, false);
		expect(h.posted[0].eventType).toBe('sale.receipt_posted');
		expect(h.posted[0].lines).toEqual([
			{ role: 'cash_receipt', discriminatorType: 'payment_method', discriminatorValue: 'cash', debit: 400_000, credit: 0 },
			{ role: 'receivable', debit: 0, credit: 400_000, partyType: 'customer', partyId: 'cus-1' },
		]);
		expect(h.applied).toEqual([400_000]);
	});

	test('a gateway receipt debits gateway clearing', async () => {
		const h = ledgerHarness();
		await h.service.post({} as never, receipt, invoice, true);
		expect(h.posted[0].lines[0]).toEqual({ role: 'gateway_clearing', debit: 400_000, credit: 0 });
	});

	test('a reversal reverses the journal and gives the amount back', async () => {
		const h = ledgerHarness({ status: 'posted', reversedByEntryId: null });
		await h.service.reverse({} as never, receipt, 'finance-b', 'salah nominal');
		expect(h.reversed).toEqual(['je-1']);
		expect(h.applied).toEqual([-400_000]);
	});

	test('a receipt recorded before ERP-0139 (no journal) leaves the ledger alone', async () => {
		const h = ledgerHarness(null);
		await h.service.reverse({} as never, receipt, 'finance-b', 'x');
		expect(h.reversed).toEqual([]);
		expect(h.applied).toEqual([]);
	});
});

describe('GatewaySettlementService', () => {
	function harness() {
		const movements: Array<Record<string, unknown>> = [];
		const posted: Array<{ lines: Array<Record<string, unknown>> }> = [];
		const service = new GatewaySettlementService(
			{ run: <T>(work: (tx: never) => Promise<T>) => work({} as never) } as never,
			{
				postMovement: async (_ctx: unknown, input: Record<string, unknown>) => {
					movements.push(input);
					return { id: 'cb-1' } as never;
				},
			},
			{ resolveAccountId: async () => 'acc-clearing' },
			{
				postBusinessEvent: async (_tx: unknown, input: { lines: never }) => {
					posted.push({ lines: input.lines });
					return { entry: { id: 'je' } } as never;
				},
			} as never,
		);
		return { service, movements, posted };
	}
	const ctx = { organizationId: 'org-1', actorUserId: 'finance-a' };

	test('the net payout hits the bank against clearing, the fee is an expense', async () => {
		const h = harness();
		const result = await h.service.record(ctx, {
			cashBankAccountId: 'bca',
			settlementDate: '2026-11-26',
			grossAmount: 1_000_000,
			feeAmount: 4_500,
			reference: 'XND-001',
		});
		expect(result).toMatchObject({ net: 995_500, fee: 4_500 });
		expect(h.movements[0]).toMatchObject({ direction: 'in', amount: 995_500, counterpartAccountId: 'acc-clearing' });
		expect(h.posted[0].lines).toEqual([
			{ role: 'gateway_fee', debit: 4_500, credit: 0 },
			{ role: 'gateway_clearing', debit: 0, credit: 4_500 },
		]);
	});

	test('a fee as large as the gross is refused', async () => {
		const h = harness();
		await expect(
			h.service.record(ctx, { cashBankAccountId: 'bca', settlementDate: '2026-11-26', grossAmount: 100, feeAmount: 100, reference: 'x' }),
		).rejects.toThrow(GatewaySettlementAmountError);
	});
});
