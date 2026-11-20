/**
 * Customer portal ordering and sales (ERP-0070).
 *
 * Owner decisions 2026-11-14 / user decisions 2026-11-19: an online order
 * (portal or website) becomes a draft SPH owned by the customer's account
 * manager, else the configured default salesperson; the customer accepts a
 * sent SPH (owner or approver, in their own name) and that creates the sales
 * order; owners and finance members pay invoices through the gateway;
 * viewers only read. Every record is scoped to the session's customer.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TOrderLine } from '../../src/app/catalog/contracts/catalog.contract';
import { PortalCheckoutChangedError, PortalNotFoundError, PortalRoleForbiddenError } from '../../src/app/portal/errors/portal.errors';
import { PortalSalesService } from '../../src/app/portal/services/portal-sales.service';
import {
	OnlineOrderNotConfiguredError,
	QuotationNotAwaitingCustomerError,
	QuotationNotFoundError,
} from '../../src/app/sales/errors/quotation.errors';
import { InvoiceNotFoundError } from '../../src/app/sales/errors/invoice.errors';
import { SalesOrderNotFoundError } from '../../src/app/sales/errors/sales-order.errors';
import { CustomerSalesService } from '../../src/app/sales/services/customer-sales.service';
import type { PortalContext } from '../../src/authorization/portal-auth';

const CUST_A = '0190a1b2-0000-7000-8000-0000000000a1';
const CUST_B = '0190a1b2-0000-7000-8000-0000000000b2';

type TQuote = { id: string; code: string; customerId: string; status: string; createdBy: string; grandTotal: number; customerSnapshot: { name: string } };

let quotes: TQuote[];
let created: { actor: string; body: Record<string, unknown> }[];
let orders: { actor: string; body: Record<string, unknown> }[];
let notified: { userIds: string[]; templateCode: string }[];
let users: Record<string, { id: string; role: string | null; banned?: boolean; deletedAt?: Date | null }>;
let customers: Record<string, { id: string; name: string; ownerUserId: string | null }>;
let defaultOwner: string | null;

function customerSales(): CustomerSalesService {
	return new CustomerSalesService(
		{
			async create(ctx, body) {
				created.push({ actor: ctx.actorUserId, body: body as never });
				const quote: TQuote = {
					id: crypto.randomUUID(),
					code: `000${quotes.length + 1}/QT`,
					customerId: body.customerId,
					status: 'draft',
					createdBy: ctx.actorUserId,
					grandTotal: 1_000_000,
					customerSnapshot: { name: customers[body.customerId]!.name },
				};
				quotes.push(quote);
				return quote as never;
			},
			listForCustomer: async (customerId: string) => quotes.filter((q) => q.customerId === customerId && q.status !== 'superseded') as never,
			getForCustomer: async (customerId: string, id: string) => {
				const quote = quotes.find((q) => q.id === id);
				if (!quote || quote.customerId !== customerId || quote.status === 'superseded') throw new QuotationNotFoundError();
				return quote as never;
			},
		},
		{
			async create(ctx, body) {
				orders.push({ actor: ctx.actorUserId, body: body as never });
				return { id: crypto.randomUUID(), code: '0001/SO' } as never;
			},
			listForCustomer: async () => [],
			getForCustomer: async (customerId: string, id: string) => {
				if (customerId !== CUST_A || id !== 'so-a') throw new SalesOrderNotFoundError();
				return { id, customerId } as never;
			},
		},
		{
			listIssuedForCustomer: async (customerId: string) =>
				customerId === CUST_A ? ([{ id: 'inv-a', organizationId: 'org-1', salesOrderId: 'so-a', paidTotal: 5_000_00 }] as never) : [],
			findIssuedForCustomer: async (customerId: string, id: string) =>
				customerId === CUST_A && id === 'inv-a' ? ({ id, organizationId: 'org-1' } as never) : null,
			listItems: async () => [],
			listReceipts: async () => [],
		},
		{ getActiveCustomer: async (id) => (customers[id] ?? null) as never },
		{ getSettingValue: async () => defaultOwner },
		{ getUser: async (id) => (users[id] ?? null) as never },
		{
			async notify(input: { userIds: string[]; templateCode: string }) {
				notified.push({ userIds: input.userIds, templateCode: input.templateCode });
			},
		} as never,
	);
}

beforeEach(() => {
	quotes = [];
	created = [];
	orders = [];
	notified = [];
	users = {
		'sales-1': { id: 'sales-1', role: 'user' },
		'sales-2': { id: 'sales-2', role: null },
		'cust-user': { id: 'cust-user', role: 'customer' },
		'gone': { id: 'gone', role: 'user', banned: true },
	};
	customers = {
		[CUST_A]: { id: CUST_A, name: 'PT Alfa', ownerUserId: 'sales-1' },
		[CUST_B]: { id: CUST_B, name: 'Dewi', ownerUserId: 'cust-user' },
	};
	defaultOwner = 'sales-2';
});

const order = (customerId: string) => ({
	customerId,
	contactId: null,
	requestedBy: 'Budi',
	source: 'portal' as const,
	lines: [{ itemId: crypto.randomUUID(), quantity: 2 }],
	note: 'Kirim pagi',
	poNumber: 'PO-1',
});

describe('online order → draft SPH (owner of the SPH)', () => {
	test("the customer's account manager owns the SPH and is notified", async () => {
		const quote = await customerSales().requestOrder(order(CUST_A));
		expect(created[0]!.actor).toBe('sales-1');
		expect(created[0]!.body).toMatchObject({ customerId: CUST_A, title: 'Pesanan online', vatEnabled: true });
		expect(String(created[0]!.body.notes)).toContain('PO-1');
		expect(quote.status).toBe('draft');
		expect(notified).toEqual([{ userIds: ['sales-1'], templateCode: 'sales.online_order_received' }]);
	});

	test('a portal login recorded as owner (self sign-up) never owns it: the default salesperson does', async () => {
		await customerSales().requestOrder(order(CUST_B));
		expect(created[0]!.actor).toBe('sales-2');
	});

	test('a banned account manager falls back to the default', async () => {
		customers[CUST_A]!.ownerUserId = 'gone';
		await customerSales().requestOrder(order(CUST_A));
		expect(created[0]!.actor).toBe('sales-2');
	});

	test('no usable owner at all is 503, and nothing is created', async () => {
		customers[CUST_A]!.ownerUserId = null;
		defaultOwner = null;
		await expect(customerSales().requestOrder(order(CUST_A))).rejects.toBeInstanceOf(OnlineOrderNotConfiguredError);
		expect(created).toEqual([]);
	});
});

describe('customer answers on an SPH', () => {
	test("another customer's SPH is 404; a superseded revision is hidden", async () => {
		const service = customerSales();
		const quote = await service.requestOrder(order(CUST_A));
		await expect(service.getQuotation(CUST_B, quote.id)).rejects.toBeInstanceOf(QuotationNotFoundError);
		quotes[0]!.status = 'superseded';
		expect(await service.listQuotations(CUST_A)).toEqual([]);
		await expect(service.getQuotation(CUST_A, quote.id)).rejects.toBeInstanceOf(QuotationNotFoundError);
	});

	test('only a sent SPH can be accepted or revised', async () => {
		const service = customerSales();
		const quote = await service.requestOrder(order(CUST_A));
		await expect(service.acceptQuotation(CUST_A, quote.id, { poNumber: null, acceptedBy: 'Budi' })).rejects.toBeInstanceOf(
			QuotationNotAwaitingCustomerError,
		);
		await expect(service.requestRevision(CUST_A, quote.id, { topics: [], message: 'x' })).rejects.toBeInstanceOf(
			QuotationNotAwaitingCustomerError,
		);
		expect(orders).toEqual([]);
	});

	test('accepting a sent SPH creates the order as its salesperson and notifies them', async () => {
		const service = customerSales();
		const quote = await service.requestOrder(order(CUST_A));
		quotes[0]!.status = 'sent';
		notified = [];
		await service.acceptQuotation(CUST_A, quote.id, { poNumber: 'PO-9', acceptedBy: 'Budi' });
		expect(orders[0]!.actor).toBe('sales-1');
		expect(orders[0]!.body).toMatchObject({ quotationId: quote.id, customerPoNumber: 'PO-9' });
		expect(notified).toEqual([{ userIds: ['sales-1'], templateCode: 'sales.quotation_accepted' }]);
	});

	test("another customer's order and invoice are 404; paid totals count only the customer's own invoices", async () => {
		const service = customerSales();
		expect((await service.getOrder(CUST_A, 'so-a')).id).toBe('so-a');
		await expect(service.getOrder(CUST_B, 'so-a')).rejects.toBeInstanceOf(SalesOrderNotFoundError);
		expect((await service.getInvoice(CUST_A, 'inv-a')).organizationId).toBe('org-1');
		await expect(service.getInvoice(CUST_B, 'inv-a')).rejects.toBeInstanceOf(InvoiceNotFoundError);
		expect(await service.paidForOrder(CUST_A, 'so-a')).toBe(5_000_00);
		expect(await service.paidForOrder(CUST_B, 'so-a')).toBe(0);
	});

	test('a revision request notifies the salesperson', async () => {
		const service = customerSales();
		const quote = await service.requestOrder(order(CUST_A));
		quotes[0]!.status = 'sent';
		notified = [];
		await service.requestRevision(CUST_A, quote.id, { topics: ['price'], message: 'Bisa diskon?' });
		expect(notified).toEqual([{ userIds: ['sales-1'], templateCode: 'sales.quotation_revision_requested' }]);
	});
});

/* ------------------------------------------------------------------------ *
 * Portal side: checkout and roles
 * ------------------------------------------------------------------------ */

const ITEM = '0190a1b2-0000-7000-8000-00000000f001';
let catalogLines: (lines: { productSlug: string; quantity: number }[]) => TOrderLine[];
let requested: unknown[];
let opened: { organizationId: string; invoiceId: string }[];

const portal = (role: PortalContext['role']): PortalContext => ({
	userId: 'u-1',
	identityId: 'identity-1',
	customerId: CUST_A,
	contactId: null,
	role,
	user: { id: 'u-1', name: 'Budi', email: 'budi@alfa.co.id' },
	sessionToken: 's',
});

function portalSales(): PortalSalesService {
	return new PortalSalesService(
		{ orderLines: async (lines) => catalogLines(lines) },
		{
			requestOrder: async (input) => {
				requested.push(input);
				return { code: '0001/QT', grandTotal: 222_000_00 } as never;
			},
			listQuotations: async () => [],
			getQuotation: async () => ({}) as never,
			acceptQuotation: async () => ({ id: 'so', code: '0001/SO' }) as never,
			requestRevision: async () => undefined,
			listOrders: async () => [],
			getOrder: async () => ({}) as never,
			listInvoices: async () => [],
			getInvoice: async (customerId: string, id: string) => {
				if (customerId !== CUST_A) throw new InvoiceNotFoundError();
				return { id, organizationId: 'org-9' } as never;
			},
			paidForOrder: async () => 0,
		},
		{
			status: () => ({ enabled: true, provider: 'fake' }),
			open: async (ctx, invoiceId) => {
				opened.push({ organizationId: ctx.organizationId, invoiceId });
				return { id: 'gp-1', providerReference: 'fake-1', paymentUrl: 'https://checkout.example/1' } as never;
			},
		},
		{ members: async () => [] },
	);
}

beforeEach(() => {
	requested = [];
	opened = [];
	catalogLines = (lines) =>
		lines.map((line) =>
			line.productSlug === 'reader'
				? { ...line, orderable: true, itemId: ITEM, requestItemId: null, name: 'Reader', unitPrice: 100_000_00 }
				: { ...line, orderable: false, itemId: null, requestItemId: null, name: 'Gate', unitPrice: null },
		);
});

describe('portal checkout', () => {
	test('the quote prices orderable lines at list price plus standard VAT; others are unavailable', async () => {
		const quote = await portalSales().quote({ items: [{ productSlug: 'reader', quantity: 2 }, { productSlug: 'gate', quantity: 1 }] });
		expect(quote.lines.map((line) => [line.productSlug, line.available, line.lineTotal])).toEqual([
			['reader', true, 200_000],
			['gate', false, 0],
		]);
		expect(quote).toMatchObject({ subtotal: 200_000, tax: 22_000, total: 222_000 });
		expect(quote.quoteId).toMatch(/^Q-/);
	});

	test('placing the order with the reviewed quote creates the draft SPH; nothing is charged', async () => {
		const service = portalSales();
		const items = [{ productSlug: 'reader', quantity: 2 }];
		const { quoteId } = await service.quote({ items });
		const placed = await service.placeOrder(portal('approver'), { items, quoteId, notes: 'Pagi' }, 'website');
		expect(placed).toEqual({ orderNumber: '0001/QT', total: 222_000, paymentStatus: 'pending_approval' });
		expect(requested[0]).toMatchObject({ customerId: CUST_A, source: 'website', lines: [{ itemId: ITEM, quantity: 2 }], note: 'Pagi' });
	});

	test('ERP-0078: a published product without an online price joins the same draft SPH as "price on request"', async () => {
		catalogLines = (lines) =>
			lines.map((line) =>
				line.productSlug === 'reader'
					? { ...line, orderable: true, itemId: ITEM, requestItemId: null, name: 'Reader', unitPrice: 100_000_00 }
					: { ...line, orderable: false, itemId: null, requestItemId: 'item-gate', name: 'Gate', unitPrice: null },
			);
		const service = portalSales();
		const items = [{ productSlug: 'reader', quantity: 1 }, { productSlug: 'gate', quantity: 2 }];
		const quote = await service.quote({ items });
		expect(quote.lines.map((line) => [line.productSlug, line.available, line.priceOnRequest ?? false, line.lineTotal])).toEqual([
			['reader', true, false, 100_000],
			['gate', true, true, 0],
		]);
		await service.placeOrder(portal('owner'), { items, quoteId: quote.quoteId }, 'website');
		expect((requested[0] as { lines: unknown[] }).lines).toEqual([
			{ itemId: ITEM, quantity: 1 },
			{ itemId: 'item-gate', quantity: 2, priceOnRequest: true },
		]);
	});

	test('a changed price, a stale quote or an unorderable line is 409', async () => {
		const service = portalSales();
		const items = [{ productSlug: 'reader', quantity: 1 }];
		const { quoteId } = await service.quote({ items });
		await expect(service.placeOrder(portal('owner'), { items, quoteId: 'Q-stale' }, 'portal')).rejects.toBeInstanceOf(PortalCheckoutChangedError);
		catalogLines = (lines) => lines.map((line) => ({ ...line, orderable: true, itemId: ITEM, requestItemId: null, name: 'Reader', unitPrice: 120_000_00 }));
		await expect(service.placeOrder(portal('owner'), { items, quoteId }, 'portal')).rejects.toBeInstanceOf(PortalCheckoutChangedError);
		catalogLines = (lines) => lines.map((line) => ({ ...line, orderable: false, itemId: null, requestItemId: null, name: 'Gate', unitPrice: null }));
		const mixed = [{ productSlug: 'gate', quantity: 1 }];
		const second = await service.quote({ items: mixed });
		await expect(service.placeOrder(portal('owner'), { items: mixed, quoteId: second.quoteId }, 'portal')).rejects.toBeInstanceOf(
			PortalCheckoutChangedError,
		);
		expect(requested).toEqual([]);
	});

	test('viewers and finance members cannot order', async () => {
		const service = portalSales();
		const items = [{ productSlug: 'reader', quantity: 1 }];
		const { quoteId } = await service.quote({ items });
		for (const role of ['viewer', 'finance'] as const) {
			await expect(service.placeOrder(portal(role), { items, quoteId }, 'portal')).rejects.toBeInstanceOf(PortalRoleForbiddenError);
		}
	});
});

describe('portal roles on quotations and payment', () => {
	test('an owner or approver accepts only in their own name; viewers and finance cannot', async () => {
		const service = portalSales();
		await expect(service.acceptQuotation(portal('approver'), 'q', { approverId: 'someone-else' })).rejects.toBeInstanceOf(PortalRoleForbiddenError);
		await expect(service.acceptQuotation(portal('viewer'), 'q', { approverId: 'identity-1' })).rejects.toBeInstanceOf(PortalRoleForbiddenError);
		await expect(service.acceptQuotation(portal('finance'), 'q', { approverId: 'identity-1' })).rejects.toBeInstanceOf(PortalRoleForbiddenError);
		expect(await service.acceptQuotation(portal('owner'), 'q', { approverId: 'identity-1' })).toMatchObject({ code: '0001/SO' });
	});

	test("owners and finance pay through the active gateway in the invoice's organization", async () => {
		const service = portalSales();
		await service.payInvoice(portal('finance'), 'inv-1', 'fake');
		expect(opened).toEqual([{ organizationId: 'org-9', invoiceId: 'inv-1' }]);
		await expect(service.payInvoice(portal('approver'), 'inv-1', 'fake')).rejects.toBeInstanceOf(PortalRoleForbiddenError);
		await expect(service.payInvoice(portal('owner'), 'inv-1', 'xendit')).rejects.toBeInstanceOf(PortalNotFoundError);
		const otherCustomer = { ...portal('owner'), customerId: CUST_B };
		await expect(service.payInvoice(otherCustomer, 'inv-1', 'fake')).rejects.toBeInstanceOf(InvoiceNotFoundError);
		expect(opened).toHaveLength(1);
	});
});
