/**
 * Payment gateway (ERP-0020, ADR-0021): the provider adapters against the
 * documented wire formats with faked HTTP (no sandbox accounts yet) — Xendit
 * Invoice API + x-callback-token, SingaPay signed access token, Payment Link
 * v2 and the HMAC-SHA512 webhook signature with its replay window — the
 * and the checkout service: opening or reusing a checkout on a gateway row,
 * and the webhook posting exactly one receipt, capped at the outstanding
 * amount, with replays, unapplicable money and status changes.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TPaymentSelect } from '@drizzle/schemas/payment.schema';
import type { TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/sale.schema';
import { FakePaymentGateway } from '../../src/app/payment/adapters/fake-payment-gateway';
import { SingapayPaymentGateway, type TSingapayConfig } from '../../src/app/payment/adapters/singapay-payment-gateway';
import { XenditPaymentGateway } from '../../src/app/payment/adapters/xendit-payment-gateway';
import type { IInvoicePaymentPort } from '../../src/app/sale/contracts/invoice-payment.port';
import type { IPaymentGateway, TCheckoutRequest } from '../../src/app/payment/contracts/payment-gateway.contract';
import type { IPaymentRepository } from '../../src/app/payment/contracts/payment.repository.interface';
import type { TGatewaySelect } from '@drizzle/schemas/payment.schema';
import { InvoiceNotPayableError } from '../../src/app/sale/errors/invoice.errors';
import {
	GatewayNotConfiguredError,
	GatewayProviderError,
	GatewayProviderUnknownError,
	GatewayWebhookUnauthorizedError,
} from '../../src/app/payment/errors/payment-gateway.errors';
import { GatewayCheckoutService } from '../../src/app/payment/services/gateway-checkout.service';
import { canonicalJson, hmacHex, minorToChargeRupiah, rupiahToMinor } from '../../src/app/payment/utils/gateway-signature';
import { businessDateOf } from '@utils/business-date.util';

type TCall = { url: string; init: RequestInit };

/** A fetch that records calls and answers from a queue. */
function fakeFetch(answers: Array<{ status?: number; body: unknown }>) {
	const calls: TCall[] = [];
	const fetcher = (async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		const answer = answers.shift() ?? { status: 500, body: {} };
		return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
	}) as unknown as typeof fetch;
	return { calls, fetcher };
}

const request: TCheckoutRequest = {
	reference: '0190a1b2-0000-7000-8000-00000000c001',
	amountRupiah: 1_110_000,
	description: 'INV-202611-00001 - CCTV',
	expiresAt: new Date(Date.now() + 24 * 3_600_000),
	customer: { name: 'PT Pelanggan', email: 'billing@pelanggan.test', phone: '0812' },
	successRedirectUrl: 'https://portal.test/paid',
};

const headers = (values: Record<string, string>) => new Headers(values);

describe('money helpers', () => {
	test('minor units are charged in whole rupiah, rounded up', () => {
		expect(minorToChargeRupiah(111_000_000)).toBe(1_110_000);
		expect(minorToChargeRupiah(111_000_037)).toBe(1_110_001);
		expect(rupiahToMinor('10000.00')).toBe(1_000_000);
		expect(rupiahToMinor(1_110_000)).toBe(111_000_000);
		expect(rupiahToMinor(null)).toBeNull();
	});

	test('canonical JSON sorts keys at every depth', () => {
		expect(canonicalJson({ b: 1, a: { d: [{ z: 1, y: 2 }], c: 'x/y' } })).toBe('{"a":{"c":"x/y","d":[{"y":2,"z":1}]},"b":1}');
	});
});

describe('Xendit adapter', () => {
	const config = { baseUrl: 'https://api.xendit.test', secretKey: 'xnd_secret', callbackToken: 'cb-token' };

	test('opens an Invoice API checkout with Basic auth and maps the answer', async () => {
		const { calls, fetcher } = fakeFetch([
			{ body: { id: 'inv_1', invoice_url: 'https://checkout.xendit.test/inv_1', expiry_date: '2026-11-15T10:00:00.000Z' } },
		]);
		const checkout = await new XenditPaymentGateway(config, fetcher).createCheckout(request);
		expect(checkout).toEqual({
			providerReference: 'inv_1',
			paymentUrl: 'https://checkout.xendit.test/inv_1',
			expiresAt: new Date('2026-11-15T10:00:00.000Z'),
		});
		expect(calls[0]!.url).toBe('https://api.xendit.test/v2/invoices');
		const sent = calls[0]!.init;
		expect((sent.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('xnd_secret:').toString('base64')}`);
		const body = JSON.parse(String(sent.body));
		expect(body.external_id).toBe(request.reference);
		expect(body.amount).toBe(1_110_000);
		expect(body.currency).toBe('IDR');
		expect(body.invoice_duration).toBeGreaterThan(86_000);
		expect(body.success_redirect_url).toBe('https://portal.test/paid');
	});

	test('a refused request is a provider error', async () => {
		const { fetcher } = fakeFetch([{ status: 400, body: { error_code: 'API_VALIDATION_ERROR' } }]);
		await expect(new XenditPaymentGateway(config, fetcher).createCheckout(request)).rejects.toBeInstanceOf(GatewayProviderError);
	});

	test('a callback without the verification token is refused', async () => {
		const gateway = new XenditPaymentGateway(config);
		const body = { external_id: request.reference, status: 'PAID' };
		await expect(gateway.parseWebhook({ method: 'POST', path: '/', headers: headers({}), body })).rejects.toBeInstanceOf(
			GatewayWebhookUnauthorizedError,
		);
		await expect(
			gateway.parseWebhook({ method: 'POST', path: '/', headers: headers({ 'x-callback-token': 'cb-tokeX' }), body }),
		).rejects.toBeInstanceOf(GatewayWebhookUnauthorizedError);
	});

	test('a PAID callback maps to a paid event', async () => {
		const event = await new XenditPaymentGateway(config).parseWebhook({
			method: 'POST',
			path: '/',
			headers: headers({ 'x-callback-token': 'cb-token' }),
			body: {
				id: 'inv_1',
				external_id: request.reference,
				status: 'PAID',
				paid_amount: 1_110_000,
				paid_at: '2026-11-14T03:00:00.000Z',
				payment_method: 'EWALLET',
				payment_channel: 'OVO',
				payment_id: 'pay_9',
			},
		});
		expect(event).toMatchObject({
			reference: request.reference,
			status: 'paid',
			paidAmountRupiah: 1_110_000,
			channel: 'OVO',
			method: 'e_wallet',
			providerTransactionId: 'pay_9',
		});
		expect(event!.paidAt).toEqual(new Date('2026-11-14T03:00:00.000Z'));
	});

	test('EXPIRED maps to expired; an unrelated body is ignored', async () => {
		const gateway = new XenditPaymentGateway(config);
		const auth = headers({ 'x-callback-token': 'cb-token' });
		expect((await gateway.parseWebhook({ method: 'POST', path: '/', headers: auth, body: { external_id: 'x', status: 'EXPIRED' } }))!.status).toBe(
			'expired',
		);
		expect(await gateway.parseWebhook({ method: 'POST', path: '/', headers: auth, body: { hello: 1 } })).toBeNull();
	});
});

describe('SingaPay adapter', () => {
	const config: TSingapayConfig = {
		baseUrl: 'https://sandbox-payment-b2b.singapay.test',
		partnerId: 'partner-key',
		clientId: 'client-1',
		clientSecret: 'client-secret',
		accountId: '01HACCOUNT',
		webhookPath: '/webhooks/singapay',
	};
	let clock: number;
	const now = () => clock;

	beforeEach(() => {
		clock = Date.parse('2026-11-14T03:00:00.000Z');
	});

	const tokenAnswer = { body: { status: 200, success: true, data: { access_token: 'jwt-1', token_type: 'Bearer', expires_in: '3600' } } };
	const linkAnswer = (id: number) => ({
		body: { status: 200, success: true, data: { id, payment_url: `https://paymentlink.singapay.test/${id}`, expired_at: null } },
	});

	test('signs the access token request and opens a Payment Link v2', async () => {
		const { calls, fetcher } = fakeFetch([tokenAnswer, linkAnswer(189)]);
		const checkout = await new SingapayPaymentGateway(config, fetcher, now).createCheckout(request);
		expect(checkout.providerReference).toBe('189');
		expect(checkout.paymentUrl).toBe('https://paymentlink.singapay.test/189');

		expect(calls[0]!.url).toBe('https://sandbox-payment-b2b.singapay.test/api/v1.1/access-token/b2b');
		const tokenHeaders = calls[0]!.init.headers as Record<string, string>;
		const day = businessDateOf(clock).replaceAll('-', '');
		expect(day).toBe('20261114');
		expect(tokenHeaders['X-Signature']).toBe(hmacHex('sha512', 'client-secret', `client-1_client-secret_${day}`));
		expect(tokenHeaders['X-PARTNER-ID']).toBe('partner-key');
		expect(tokenHeaders['X-CLIENT-ID']).toBe('client-1');
		expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ grant_type: 'client_credentials' });

		expect(calls[1]!.url).toBe('https://sandbox-payment-b2b.singapay.test/api/v2.0/payment-link/01HACCOUNT');
		expect((calls[1]!.init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1');
		const body = JSON.parse(String(calls[1]!.init.body));
		expect(body).toMatchObject({ reff_no: request.reference, payment_link_type: 'total', total_amount: 1_110_000 });
		expect(body.reff_no.length).toBeLessThanOrEqual(40);
	});

	test('reuses the access token until shortly before it expires', async () => {
		const { calls, fetcher } = fakeFetch([tokenAnswer, linkAnswer(1), linkAnswer(2), tokenAnswer, linkAnswer(3)]);
		const gateway = new SingapayPaymentGateway(config, fetcher, now);
		await gateway.createCheckout(request);
		await gateway.createCheckout(request);
		clock += 3_600_000;
		await gateway.createCheckout(request);
		expect(calls.filter((call) => call.url.endsWith('/access-token/b2b'))).toHaveLength(2);
	});

	test('a failed envelope is a provider error', async () => {
		const { fetcher } = fakeFetch([{ status: 401, body: { status: 401, success: false, error: { code: 401, message: 'Invalid credentials' } } }]);
		await expect(new SingapayPaymentGateway(config, fetcher, now).createCheckout(request)).rejects.toBeInstanceOf(GatewayProviderError);
	});

	const paidBody = {
		status: 200,
		success: true,
		data: {
			transaction: { reff_no: '18917720251110094037705', type: 'pl', status: 'paid', amount: { value: '1110000.00', currency: 'IDR' } },
			customer: { id: null, name: 'PT Pelanggan', email: 'billing@pelanggan.test', phone: '0812' },
			payment: { method: 'payment_link', additional_info: { payment_link: { id: 189, reff_no: request.reference, status: 'open' } } },
		},
	};

	function signed(body: unknown, at = clock, token = 'hook-token') {
		const timestamp = String(Math.floor(at / 1000));
		const gateway = new SingapayPaymentGateway(config, fetch, now);
		return headers({
			authorization: `Bearer ${token}`,
			'x-timestamp': timestamp,
			'x-signature': gateway.signWebhook(token, body, timestamp),
		});
	}

	test('a correctly signed payment-link webhook maps to a paid event, whatever the key order', async () => {
		const gateway = new SingapayPaymentGateway(config, fetch, now);
		// Signed over keys in reverse order, received in the documented order.
		const reverseKeys = (value: unknown): unknown =>
			Array.isArray(value)
				? value.map(reverseKeys)
				: value && typeof value === 'object'
					? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]))
					: value;
		const reordered = reverseKeys(paidBody);
		expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(paidBody));
		const event = await gateway.parseWebhook({ method: 'POST', path: config.webhookPath, headers: signed(reordered), body: paidBody });
		expect(event).toMatchObject({
			reference: request.reference,
			status: 'paid',
			paidAmountRupiah: 1_110_000,
			providerTransactionId: '18917720251110094037705',
		});
	});

	test('the signature covers the body, the path, the token and the time', async () => {
		const gateway = new SingapayPaymentGateway(config, fetch, now);
		const tampered = { ...paidBody, data: { ...paidBody.data, transaction: { ...paidBody.data.transaction, amount: { value: '1.00', currency: 'IDR' } } } };
		await expect(
			gateway.parseWebhook({ method: 'POST', path: config.webhookPath, headers: signed(paidBody), body: tampered }),
		).rejects.toBeInstanceOf(GatewayWebhookUnauthorizedError);
		const otherPath = new SingapayPaymentGateway({ ...config, webhookPath: '/elsewhere' }, fetch, now);
		await expect(
			otherPath.parseWebhook({ method: 'POST', path: config.webhookPath, headers: signed(paidBody), body: paidBody }),
		).rejects.toBeInstanceOf(GatewayWebhookUnauthorizedError);
		const stale = signed(paidBody, clock - 6 * 60 * 1000);
		await expect(gateway.parseWebhook({ method: 'POST', path: config.webhookPath, headers: stale, body: paidBody })).rejects.toBeInstanceOf(
			GatewayWebhookUnauthorizedError,
		);
		const wrongToken = signed(paidBody);
		wrongToken.set('authorization', 'Bearer other-token');
		await expect(gateway.parseWebhook({ method: 'POST', path: config.webhookPath, headers: wrongToken, body: paidBody })).rejects.toBeInstanceOf(
			GatewayWebhookUnauthorizedError,
		);
	});

	test('a verified event of another product (VA, disbursement) is ignored', async () => {
		const gateway = new SingapayPaymentGateway(config, fetch, now);
		const vaBody = { status: 200, success: true, data: { transaction_id: 1, va_number: '123', status: 'paid' } };
		expect(await gateway.parseWebhook({ method: 'POST', path: config.webhookPath, headers: signed(vaBody), body: vaBody })).toBeNull();
	});
});

describe('fake adapter', () => {
	test('the fake webhook needs the HMAC of the body', async () => {
		const gateway = new FakePaymentGateway('local-secret-0123456789');
		const body = { reference: request.reference, status: 'paid' as const, amount: 1000 };
		await expect(gateway.parseWebhook({ method: 'POST', path: '/', headers: headers({}), body })).rejects.toBeInstanceOf(
			GatewayWebhookUnauthorizedError,
		);
		const event = await gateway.parseWebhook({ method: 'POST', path: '/', headers: headers({ 'x-fake-signature': gateway.sign(body) }), body });
		expect(event).toMatchObject({ status: 'paid', paidAmountRupiah: 1000 });
	});
});

/* -------------------------------- service -------------------------------- */

const ORG = 'org-1';
const INVOICE = '0190a1b2-0000-7000-8000-00000000d001';
const ctx = { organizationId: ORG, actorUserId: 'finance' };

let invoice: TInvoiceSelect;
let rows: TPaymentSelect[];
let allocations: { paymentId: string; payableType: string; payableId: string; amount: number }[];
let receipts: TReceiptSelect[];
let receiptCalls: { amount: number; capToOutstanding?: boolean; tx?: unknown }[];
let documents: string[];
let events: string[];
let checkouts: TCheckoutRequest[];
let failCheckout: boolean;
let gateway: IPaymentGateway;
let active: TGatewaySelect | null;
let service: GatewayCheckoutService;

function makeService() {
	const payments: IPaymentRepository = {
		findById: async (_org, id) => rows.find((row) => row.id === id) ?? null,
		list: async () => ({ data: rows, meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 } }),
		countOpen: async () => 0,
		async insert(data) {
			const row = {
				...data,
				id: crypto.randomUUID(),
				providerReference: null,
				paymentUrl: null,
				paidAt: null,
				paidAmount: null,
				paymentChannel: null,
				providerTransactionId: null,
				receiptId: null,
				settlementNote: null,
				lastEvent: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
			} as TPaymentSelect;
			rows.push(row);
			return row;
		},
		async update(_org, id, patch) {
			const row = rows.find((item) => item.id === id);
			return row ? Object.assign(row, patch) : null;
		},
		async syncAllocations(_org, paymentId, wanted) {
			for (const row of wanted) allocations.push({ paymentId, ...row });
			return [] as never;
		},
		listAllocations: async (_org, paymentId) => allocations.filter((row) => row.paymentId === paymentId) as never,
		listCheckoutsOf: async (_org, _type, payableId) =>
			rows.filter((row) => row.channel === 'gateway' && allocations.some((a) => a.paymentId === row.id && a.payableId === payableId)),
		async findReusableCheckout(_org, _type, payableId, provider, amount, openUntil) {
			return (
				rows.find(
					(row) =>
						row.channel === 'gateway' &&
						row.provider === provider &&
						row.amount === amount &&
						row.status === 'pending' &&
						row.paymentUrl != null &&
						row.expiresAt != null &&
						row.expiresAt > openUntil &&
						allocations.some((a) => a.paymentId === row.id && a.payableId === payableId),
				) ?? null
			);
		},
		async withLocked(id, work) {
			const row = rows.find((item) => item.id === id);
			return row ? work(row, 'tx') : null;
		},
	};
	const invoices: IInvoicePaymentPort = {
		findById: async (_org, id) => (id === invoice.id ? invoice : null),
		async addReceipt(data, options = {}) {
			receiptCalls.push({ amount: data.amount, capToOutstanding: options.capToOutstanding, tx: options.tx });
			if (invoice.status !== 'issued' && invoice.status !== 'partially_paid') return null;
			const amount = options.capToOutstanding ? Math.min(data.amount, invoice.outstandingTotal) : data.amount;
			const receipt = { ...data, amount, id: crypto.randomUUID(), status: 'posted' } as TReceiptSelect;
			receipts.push(receipt);
			invoice.paidTotal += amount;
			invoice.outstandingTotal -= amount;
			invoice.status = invoice.outstandingTotal === 0 ? 'paid' : 'partially_paid';
			return receipt;
		},
		async publishReceiptRecorded(receipt) {
			events.push(`receipt.recorded:${receipt.id}`);
		},
	};
	// The gateway configuration is a row with a decrypted adapter: the service
	// never reads the environment or the ciphertext itself.
	const gateways = {
		findDefault: async () => active,
		findActiveByProvider: async (_org: string | null, provider: string) =>
			active && active.provider === provider ? active : null,
		adapterOf: () => gateway,
	} as never;
	let sequence = 0;
	return new GatewayCheckoutService(
		payments,
		gateways,
		invoices,
		{ next: async () => `KW-202611-${String(++sequence).padStart(5, '0')}` },
		{
			register: async (input: { code: string }) => {
				documents.push(input.code);
				return {} as never;
			},
		} as never,
	);
}

const SECRET = 'local-secret-0123456789';
const fake = new FakePaymentGateway(SECRET);

function webhook(body: Record<string, unknown>, provider: 'fake' | 'xendit' = 'fake') {
	return service.handleWebhook({
		provider,
		method: 'POST',
		path: '/webhooks/fake',
		headers: headers({ 'x-fake-signature': fake.sign(body) }),
		body,
	});
}

beforeEach(() => {
	invoice = {
		id: INVOICE,
		organizationId: ORG,
		code: 'INV-202611-00001',
		title: 'CCTV',
		status: 'issued',
		grandTotal: 111_000_037,
		paidTotal: 0,
		outstandingTotal: 111_000_037,
		currencyCode: 'IDR',
		customerSnapshot: { name: 'PT Pelanggan', email: 'billing@pelanggan.test', phone: null, whatsapp: '0812' },
	} as unknown as TInvoiceSelect;
	rows = [];
	allocations = [];
	receipts = [];
	receiptCalls = [];
	documents = [];
	events = [];
	checkouts = [];
	failCheckout = false;
	gateway = {
		provider: 'fake',
		async createCheckout(input) {
			if (failCheckout) throw new GatewayProviderError();
			checkouts.push(input);
			return fake.createCheckout(input);
		},
		parseWebhook: (input) => fake.parseWebhook(input),
	};
	active = { id: 'gw-1', provider: 'fake', code: 'FAKE', mode: 'sandbox', config: null } as unknown as TGatewaySelect;
	service = makeService();
});

describe('opening a checkout', () => {
	test('refused when no default gateway is configured', async () => {
		active = null;
		expect(await service.status(ORG)).toEqual({ enabled: false, provider: null });
		await expect(service.open(ctx, INVOICE)).rejects.toBeInstanceOf(GatewayNotConfiguredError);
	});

	test('only for an issued or partly paid invoice with something to pay', async () => {
		invoice.status = 'draft';
		await expect(service.open(ctx, INVOICE)).rejects.toBeInstanceOf(InvoiceNotPayableError);
		invoice.status = 'paid';
		await expect(service.open(ctx, INVOICE)).rejects.toBeInstanceOf(InvoiceNotPayableError);
	});

	test('charges the outstanding amount in whole rupiah (rounded up) and keeps the provider answer', async () => {
		const row = await service.open(ctx, INVOICE);
		expect(checkouts[0]).toMatchObject({ reference: row.id, amountRupiah: 1_110_001, description: 'INV-202611-00001 - CCTV' });
		expect(checkouts[0]!.customer).toEqual({ name: 'PT Pelanggan', email: 'billing@pelanggan.test', phone: '0812' });
		expect(row).toMatchObject({
			amount: 111_000_100,
			status: 'pending',
			channel: 'gateway',
			provider: 'fake',
			providerReference: `fake-${row.id}`,
			requestedBy: 'finance',
		});
		expect(row.paymentUrl).toContain(row.id);
		expect('lastEvent' in row).toBe(false);
		// The checkout is a payment row allocated to the invoice it pays.
		expect(allocations).toEqual([{ paymentId: row.id, payableType: 'sale_invoice', payableId: INVOICE, amount: 111_000_100 }]);
	});

	test('reuses a pending checkout of the same amount, opens a new one after a partial payment', async () => {
		const first = await service.open(ctx, INVOICE);
		expect((await service.open(ctx, INVOICE)).id).toBe(first.id);
		expect(checkouts).toHaveLength(1);
		invoice.outstandingTotal = 50_000_000;
		const second = await service.open(ctx, INVOICE);
		expect(second.id).not.toBe(first.id);
		expect(second.amount).toBe(50_000_000);
	});

	test('a provider refusal marks the row failed and surfaces the error', async () => {
		failCheckout = true;
		await expect(service.open(ctx, INVOICE)).rejects.toBeInstanceOf(GatewayProviderError);
		expect(rows[0]).toMatchObject({ status: 'failed', settlementNote: 'The provider did not open the checkout.' });
	});
});

describe('webhooks', () => {
	test('a paid event posts one receipt capped at the outstanding amount, in the row transaction', async () => {
		const row = await service.open(ctx, INVOICE);
		expect(await webhook({ reference: row.id, status: 'paid', amount: 1_110_001, channel: 'BCA' })).toBe('applied');
		expect(receiptCalls).toEqual([{ amount: 111_000_100, capToOutstanding: true, tx: 'tx' }]);
		expect(receipts[0]).toMatchObject({
			amount: 111_000_037,
			method: 'bank_transfer',
			receivedBy: null,
			code: 'KW-202611-00002',
			paymentId: row.id,
		});
		expect(receipts[0]!.notes).toContain('fake gateway (BCA)');
		expect(documents).toEqual(['KW-202611-00002']);
		// M04: the online payment reaches n8n like a manual receipt.
		expect(events).toEqual([`receipt.recorded:${receipts[0]!.id}`]);
		expect(invoice.status).toBe('paid');
		// 63 minor units of rounding is below one rupiah: no note.
		expect(rows[0]).toMatchObject({ status: 'paid', receiptId: receipts[0]!.id, paidAmount: 111_000_100, paymentChannel: 'BCA', settlementNote: null });
	});

	test('a replayed paid event changes nothing', async () => {
		const row = await service.open(ctx, INVOICE);
		await webhook({ reference: row.id, status: 'paid', amount: 1_110_001 });
		expect(await webhook({ reference: row.id, status: 'paid', amount: 1_110_001 })).toBe('duplicate');
		expect(await webhook({ reference: row.id, status: 'expired' })).toBe('duplicate');
		expect(receipts).toHaveLength(1);
		expect(events).toHaveLength(1);
	});

	test('money that can no longer be applied is kept paid, without a receipt, with a note', async () => {
		const row = await service.open(ctx, INVOICE);
		invoice.status = 'void';
		expect(await webhook({ reference: row.id, status: 'paid', amount: 1_110_001 })).toBe('unapplied');
		expect(receipts).toHaveLength(0);
		expect(rows[0]!.status).toBe('paid');
		expect(rows[0]!.receiptId).toBeNull();
		expect(rows[0]!.settlementNote).toContain('refund or apply by hand');
		expect(await webhook({ reference: row.id, status: 'paid', amount: 1_110_001 })).toBe('duplicate');
	});

	test('a paid event after expiry still counts', async () => {
		const row = await service.open(ctx, INVOICE);
		expect(await webhook({ reference: row.id, status: 'expired' })).toBe('updated');
		expect(rows[0]!.status).toBe('expired');
		expect(await webhook({ reference: row.id, status: 'paid', amount: 1_110_001 })).toBe('applied');
		expect(receipts).toHaveLength(1);
	});

	test('an overpayment above one rupiah is noted', async () => {
		const row = await service.open(ctx, INVOICE);
		invoice.outstandingTotal = 100_000_000;
		expect(await webhook({ reference: row.id, status: 'paid', amount: 1_110_001 })).toBe('applied');
		expect(receipts[0]!.amount).toBe(100_000_000);
		expect(rows[0]!.settlementNote).toBe('Paid 11000100 minor units above the outstanding amount.');
	});

	test('unknown references, another provider and unknown providers', async () => {
		expect(await webhook({ reference: 'not-a-uuid', status: 'paid' })).toBe('unknown');
		expect(await webhook({ reference: crypto.randomUUID(), status: 'paid' })).toBe('unknown');
		const row = await service.open(ctx, INVOICE);
		rows[0]!.provider = 'xendit';
		expect(await webhook({ reference: row.id, status: 'paid', amount: 1 })).toBe('unknown');
		await expect(webhook({ reference: row.id, status: 'paid' }, 'xendit')).rejects.toBeInstanceOf(GatewayProviderUnknownError);
		expect(receipts).toHaveLength(0);
	});

	test('a forged webhook is refused before anything is read', async () => {
		const row = await service.open(ctx, INVOICE);
		await expect(
			service.handleWebhook({
				provider: 'fake',
				method: 'POST',
				path: '/webhooks/fake',
				headers: headers({ 'x-fake-signature': 'forged' }),
				body: { reference: row.id, status: 'paid' },
			}),
		).rejects.toBeInstanceOf(GatewayWebhookUnauthorizedError);
		expect(rows[0]!.status).toBe('pending');
	});
});