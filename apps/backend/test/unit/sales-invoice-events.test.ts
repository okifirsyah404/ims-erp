/**
 * M04 stage 2 billing events from the sales invoice service: a receipt
 * publishes `receipt.recorded` with the invoice as it stands after the
 * payment; a refused receipt publishes nothing.
 */
import { describe, expect, test } from 'bun:test';
import type { TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/sales.schema';
import { InvoiceService } from '../../src/app/sales/services/invoice.service';
import { invoiceIssuedEvent } from '../../src/app/sales/utils/invoice-events';

const invoice = {
	id: 'inv-1',
	organizationId: 'org-1',
	code: '0001/INV/IMS/XI/26',
	customerId: 'cus-1',
	customerSnapshot: { code: 'PT-MAJU', name: 'PT Maju', type: 'company', email: null, phone: '021', whatsapp: '0812', taxId: null, addressLine: null, postalCode: null },
	status: 'issued',
	grandTotal: 1_000_000,
	paidTotal: 0,
	outstandingTotal: 1_000_000,
	currencyCode: 'IDR',
} as unknown as TInvoiceSelect;

function service(events: { topic: string; data: Record<string, unknown> }[]) {
	let current = { ...invoice };
	return new InvoiceService(
		{} as never,
		{
			findById: async () => current,
			addReceipt: async (data: Record<string, unknown>) => {
				current = { ...current, status: 'partially_paid', paidTotal: 400_000, outstandingTotal: 600_000 } as TInvoiceSelect;
				return { ...data, id: 'rcp-1' } as unknown as TReceiptSelect;
			},
		} as never,
		{} as never,
		{} as never,
		{} as never,
		{ next: async () => '0001/KW/IMS/XI/26' } as never,
		{
			publish: async (topic, _aggregate, data) => {
				events.push({ topic, data });
				return null;
			},
		},
		// ERP-0044: the registry is exercised elsewhere; receipts register here.
		{ register: async () => ({}) as never, voidBySource: async () => 1 }, { notify: async () => {} },
	);
}

const ctx = { organizationId: 'org-1', actorUserId: 'finance' } as never;

describe('sales invoice events (M04)', () => {
	test('a receipt publishes receipt.recorded with the invoice after the payment', async () => {
		const events: { topic: string; data: Record<string, unknown> }[] = [];
		await service(events).addReceipt(ctx, 'inv-1', { amount: 400_000, method: 'bank_transfer', reference: null, notes: null } as never);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			topic: 'receipt.recorded',
			data: { code: '0001/KW/IMS/XI/26', amount: 400_000, invoice: { status: 'partially_paid', outstandingTotal: 600_000 }, customer: { name: 'PT Maju', whatsapp: '0812' } },
		});
	});

	test('a receipt over the outstanding amount publishes nothing', async () => {
		const events: { topic: string; data: Record<string, unknown> }[] = [];
		await expect(
			service(events).addReceipt(ctx, 'inv-1', { amount: 2_000_000, method: 'cash', reference: null, notes: null } as never),
		).rejects.toThrow();
		expect(events).toHaveLength(0);
	});

	test('invoice.issued carries the customer contact; a missing snapshot gives nulls', () => {
		expect(invoiceIssuedEvent(invoice)).toMatchObject({ code: '0001/INV/IMS/XI/26', customer: { code: 'PT-MAJU', phone: '021' } });
		expect(invoiceIssuedEvent({ ...invoice, customerSnapshot: null })).toMatchObject({ customer: { id: 'cus-1', name: null } });
	});
});
