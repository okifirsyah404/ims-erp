/**
 * Sends a signed sample ERP event to n8n, exactly as the ERP outbox does
 * (same body shape, headers and HMAC), so the workflow can be tested without
 * the ERP.
 *
 *   N8N_WEBHOOK_URL=https://n8n.example.com/webhook/erp-events \
 *   N8N_WEBHOOK_SECRET=... \
 *   bun docs/integrations/n8n/send-test-event.ts <topic|all> [--change=approved] [--bad-signature] [--repeat]
 *
 * `--repeat` sends the same event id twice (the second must be skipped),
 * `--bad-signature` must be refused with 401. Sample contacts are fake.
 */
import { createHmac, randomUUID } from 'node:crypto';

const url = process.env.N8N_WEBHOOK_URL;
const secret = process.env.N8N_WEBHOOK_SECRET;
if (!url || !secret) {
	console.error('Set N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET (the same values as in the ERP .env).');
	process.exit(1);
}

const args = process.argv.slice(2);
const topicArg = args.find((arg) => !arg.startsWith('--')) ?? 'all';
const change = args.find((arg) => arg.startsWith('--change='))?.split('=')[1];
const badSignature = args.includes('--bad-signature');
const repeat = args.includes('--repeat');

const customer = { id: randomUUID(), code: 'C-0001', name: 'PT Contoh Pelanggan', email: 'pelanggan@example.com', phone: '081200000001', whatsapp: '081200000001' };
const supplier = { id: randomUUID(), code: 'S-0001', name: 'PT Contoh Pemasok', phone: '0215550001', email: 'ap@pemasok.example', picName: 'Rina', picPhone: '081200000002', picEmail: null };
const line = { sku: 'RDR-01', name: 'Card reader', unit: 'pcs', quantity: '1.000', serialNumbers: ['SN-0001'] };

const samples: Record<string, (c?: string) => Record<string, unknown>> = {
	'lead.created': () => ({ leadId: randomUUID(), reference: 'LEAD-0001', name: 'Budi', companyName: 'PT Gym Sehat', phone: '081200000003', whatsapp: '081200000003', email: null, source: 'website', channel: 'rfq', needs: 'Akses pintu 2 lantai', ownerUserId: null }),
	'invoice.issued': () => ({ invoiceId: randomUUID(), code: '0001/INV/IMS/XI/26', title: 'Swing gate lobi', customer, salesOrderCode: '0001/SO/IMS/XI/26', issueDate: '2026-11-16', dueDate: '2026-11-30', grandTotal: 1_110_000_000, outstandingTotal: 1_110_000_000, currencyCode: 'IDR' }),
	'receipt.recorded': () => ({ receiptId: randomUUID(), code: '0001/KW/IMS/XI/26', receivedDate: '2026-11-16', amount: 333_000_000, method: 'bank_transfer', invoice: { id: randomUUID(), code: '0001/INV/IMS/XI/26', status: 'partially_paid', grandTotal: 1_110_000_000, paidTotal: 333_000_000, outstandingTotal: 777_000_000 }, customer }),
	'service_ticket.updated': (c = 'created') => ({ ticketId: randomUUID(), code: 'TKT-0001', change: c, status: c === 'resolved' ? 'resolved' : 'open', customer, reporterName: 'Budi', reporterContact: '081200000003', complaint: 'Reader lobi tidak membaca kartu', assignee: { userId: 'u1', name: 'Andi' }, resolution: c === 'resolved' ? 'Ganti reader' : null }),
	'whatsapp.handoff': () => ({ conversationId: randomUUID(), phone: '081200000004', contactName: 'Sari', reason: 'restricted', question: 'Bisa diskon 20%?' }),
	'license.due': () => ({ contractId: randomUUID(), code: 'LIC-0001', threshold: 7, stage: 'ending', daysLeft: 7, endDate: '2026-11-23', graceEndsOn: '2026-12-07', application: { code: 'ACC', name: 'Entragate Access' }, customer }),
	'purchase_return.updated': (c = 'submitted') => ({ returnId: randomUUID(), code: c === 'submitted' ? null : '0001/RTB/IMS/XI/26', change: c, status: c, returnDate: '2026-11-16', reason: 'Reader mati saat dites', rejectionReason: c === 'rejected' ? 'Lampirkan foto' : null, cancelledReason: null, goodsReceiptCode: '0001/BPB/IMS/XI/26', purchaseOrderCode: 'PO/IMS-HIT/HW/1126/001', supplier, lines: [line], totalAmount: 120_000_000, currencyCode: 'IDR', actorUserId: 'u2' }),
	'sales_return.updated': (c = 'submitted') => ({ returnId: randomUUID(), code: c === 'submitted' ? null : '0001/RTJ/IMS/XI/26', change: c, status: c, returnDate: '2026-11-16', reason: 'Reader tidak menyala', rejectionReason: null, cancelledReason: null, deliveryNoteCode: '0001/SJ/IMS/XI/26', salesOrderCode: '0001/SO/IMS/XI/26', customer, lines: [{ ...line, condition: c === 'received' ? 'damaged' : null }], totalAmount: 200_000_000, currencyCode: 'IDR', actorUserId: 'u3' }),
	'supplier_bill.recorded': () => ({ billId: randomUUID(), organizationId: 'org', code: 'SB-0001', supplierInvoiceNumber: 'INV/HIT/0099', purchaseOrderId: randomUUID(), status: 'approved', billDate: '2026-11-16', dueDate: '2026-12-16', grandTotal: 144_300_000, paidTotal: 0, outstandingTotal: 144_300_000, currencyCode: 'IDR', supplier, recordedBy: 'u4' }),
	'supplier_bill.due': (c = 'upcoming') => ({ billId: randomUUID(), organizationId: 'org', code: 'SB-0001', supplierInvoiceNumber: 'INV/HIT/0099', purchaseOrderId: randomUUID(), status: 'approved', billDate: '2026-11-16', dueDate: '2026-11-23', grandTotal: 144_300_000, paidTotal: 0, outstandingTotal: 144_300_000, currencyCode: 'IDR', supplier, threshold: c === 'upcoming' ? 7 : 0, stage: c, daysLeft: c === 'upcoming' ? 7 : c === 'due' ? 0 : -3 }),
};

async function send(topic: string): Promise<void> {
	const make = samples[topic];
	if (!make) throw new Error(`Unknown topic ${topic}. Known: ${Object.keys(samples).join(', ')}`);
	const envelope = { id: randomUUID(), topic, occurredAt: new Date().toISOString(), aggregate: { type: topic.split('.')[0], id: randomUUID() }, data: make(change) };
	const body = JSON.stringify(envelope);
	for (let round = 0; round < (repeat ? 2 : 1); round += 1) {
		const timestamp = String(Date.now());
		const signature = `sha256=${createHmac('sha256', badSignature ? `${secret}-wrong` : secret!).update(`${timestamp}.${body}`).digest('hex')}`;
		const response = await fetch(url!, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Erp-Event-Id': envelope.id, 'X-Erp-Event-Type': topic, 'X-Erp-Timestamp': timestamp, 'X-Erp-Signature': signature },
			body,
		});
		console.log(`${topic}${change ? `:${change}` : ''}${round ? ' (repeat)' : ''} -> ${response.status} ${(await response.text()).slice(0, 200)}`);
	}
}

for (const topic of topicArg === 'all' ? Object.keys(samples) : [topicArg]) await send(topic);
