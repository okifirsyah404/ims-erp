import { createHash } from 'node:crypto';
import { CATALOG_SERVICE_TOKEN } from '@app/catalog/constants/di';
import type { TOrderLine } from '@app/catalog/contracts/catalog.contract';
import type { CatalogService } from '@app/catalog/services/catalog.service';
import { GATEWAY_PAYMENT_SERVICE_TOKEN } from '@app/payment/constants/di';
import type { GatewayPaymentService, TGatewayPaymentView } from '@app/payment/services/gateway-payment.service';
import { CUSTOMER_SALES_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { TCustomerInvoice } from '@app/sales/contracts/customer-sales.contract';
import type { CustomerSalesService } from '@app/sales/services/customer-sales.service';
import type { TQuotationDetail, TQuotationView } from '@app/sales/services/quotation.service';
import type { TSalesOrderDetail } from '@app/sales/services/sales-order.service';
import { PORTAL_ACCOUNT_SERVICE_TOKEN } from '@app/user/constants/di';
import type { PortalAccountService } from '@app/user/services/portal-account.service';
import type { PortalContext } from '@authorization/portal-auth';
import type { TInvoiceSelect, TSalesOrderSelect } from '@drizzle/schemas/sales.schema';
import { inject, injectable } from 'tsyringe';
import type { TCheckoutQuote, TOnlineOrderState, TPortalCheckout, TPortalPlaceOrder } from '../contracts/portal.contract';
import { PortalCheckoutChangedError, PortalNotFoundError, PortalRoleForbiddenError } from '../errors/portal.errors';

type TPortalRole = PortalContext['role'];

/** Who may do what in the portal (ERP-0070): viewers only read. */
const MAY_ORDER: ReadonlySet<TPortalRole> = new Set(['owner', 'approver']);
const MAY_ACCEPT: ReadonlySet<TPortalRole> = new Set(['owner', 'approver']);
const MAY_PAY: ReadonlySet<TPortalRole> = new Set(['owner', 'finance']);

/** Standard VAT for the checkout estimate (basis points); the SPH keeps its own rate. */
const CHECKOUT_VAT_BPS = 1100;
/** How long a checkout quote stays valid for `placeOrder`. */
const QUOTE_TTL_MS = 30 * 60 * 1000;

/** Whole rupiah (the website's and portal's `Money`). */
const rupiah = (minor: number) => Math.round(minor / 100);


/**
 * Online ordering, quotations, orders, invoices and payment for the signed-in
 * customer (ERP-0070). Owns no data: Catalog prices the cart, Sales keeps
 * the SPH / order / invoice, Payment opens the gateway checkout. Every call
 * is scoped to `portal.customerId` and gated by the caller's portal role.
 */
@injectable()
export class PortalSalesService {
	constructor(
		@inject(CATALOG_SERVICE_TOKEN) private readonly catalog: Pick<CatalogService, 'orderLines'>,
		@inject(CUSTOMER_SALES_SERVICE_TOKEN)
		private readonly sales: Pick<
			CustomerSalesService,
			| 'requestOrder'
			| 'listQuotations'
			| 'getQuotation'
			| 'acceptQuotation'
			| 'requestRevision'
			| 'listOrders'
			| 'getOrder'
			| 'listInvoices'
			| 'getInvoice'
			| 'paidForOrder'
		>,
		@inject(GATEWAY_PAYMENT_SERVICE_TOKEN) private readonly gateway: Pick<GatewayPaymentService, 'status' | 'open'>,
		@inject(PORTAL_ACCOUNT_SERVICE_TOKEN) private readonly accounts: Pick<PortalAccountService, 'members'>,
	) {}

	private require(portal: PortalContext, roles: ReadonlySet<TPortalRole>): void {
		if (!roles.has(portal.role)) throw new PortalRoleForbiddenError();
	}

	/* Checkout --------------------------------------------------------------- */

	/** Prices the cart (list price, standard VAT); `quoteId` fingerprints prices and availability. */
	async quote(input: TPortalCheckout): Promise<TCheckoutQuote> {
		const lines = await this.catalog.orderLines(input.items);
		return this.estimate(lines);
	}

	private estimate(lines: TOrderLine[]): TCheckoutQuote {
		const priced = lines.map((line) => {
			const unitPrice = line.unitPrice === null ? 0 : rupiah(line.unitPrice);
			return { productSlug: line.productSlug, quantity: line.quantity, unitPrice, lineTotal: line.orderable ? unitPrice * line.quantity : 0, available: line.orderable };
		});
		const subtotal = priced.reduce((sum, line) => sum + line.lineTotal, 0);
		const tax = Math.round((subtotal * CHECKOUT_VAT_BPS) / 10_000);
		const fingerprint = createHash('sha256')
			.update(JSON.stringify(priced.map((line) => [line.productSlug, line.quantity, line.unitPrice, line.available])))
			.digest('base64url')
			.slice(0, 32);
		return {
			lines: priced,
			subtotal,
			discount: 0,
			shipping: 0,
			installation: 0,
			tax,
			total: subtotal + tax,
			quoteId: `Q-${fingerprint}`,
			expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
		};
	}

	/**
	 * Places the order as a draft SPH for sales to review (owner flow
	 * 2026-11-14): nothing is paid now; the customer pays the invoice later.
	 *
	 * @throws {PortalCheckoutChangedError} A line is not orderable or prices changed since the quote
	 */
	async placeOrder(portal: PortalContext, input: TPortalPlaceOrder, source: 'portal' | 'website') {
		this.require(portal, MAY_ORDER);
		const lines = await this.catalog.orderLines(input.items);
		const estimate = this.estimate(lines);
		if (estimate.quoteId !== input.quoteId || lines.some((line) => !line.orderable)) throw new PortalCheckoutChangedError();
		const quotation = await this.sales.requestOrder({
			customerId: portal.customerId,
			contactId: portal.contactId,
			requestedBy: portal.user.name,
			source,
			lines: lines.map((line) => ({ itemId: line.itemId!, quantity: line.quantity })),
			note: input.notes ?? input.shipping?.notes ?? null,
			poNumber: input.poNumber ?? null,
		});
		return { orderNumber: quotation.code, total: rupiah(quotation.grandTotal), paymentStatus: 'pending_approval' as const };
	}

	/**
	 * Status of an online order by its SPH number (the website's payment-status
	 * poll): nothing is payable at checkout, so it stays `pending_approval`
	 * until the SPH is lost (`cancelled`).
	 */
	async orderStatus(portal: PortalContext, orderNumber: string): Promise<{ quotation: TQuotationView; state: TOnlineOrderState }> {
		const quotation = (await this.sales.listQuotations(portal.customerId)).find((row) => row.code === orderNumber);
		if (!quotation) throw new PortalNotFoundError();
		return { quotation, state: quotation.status === 'lost' ? 'cancelled' : 'pending_approval' };
	}

	/** SPHs waiting for the customer's answer (`sent`, not expired). */
	async awaitingQuotations(portal: PortalContext): Promise<TQuotationDetail[]> {
		const rows = (await this.sales.listQuotations(portal.customerId)).filter((row) => row.status === 'sent' && !row.expired);
		return Promise.all(rows.map((row) => this.sales.getQuotation(portal.customerId, row.id)));
	}

	/** Navigation counters: SPHs waiting for an answer and orders still running. */
	async counts(portal: PortalContext): Promise<{ quotationsAwaiting: number; activeOrders: number }> {
		const [quotations, orders] = await Promise.all([this.sales.listQuotations(portal.customerId), this.sales.listOrders(portal.customerId)]);
		return {
			quotationsAwaiting: quotations.filter((row) => row.status === 'sent' && !row.expired).length,
			activeOrders: orders.filter((order) => order.status === 'confirmed' || order.status === 'in_progress').length,
		};
	}

	/* Quotations ------------------------------------------------------------- */

	/** The customer's SPHs with their details (line count, salesperson). */
	async listQuotations(portal: PortalContext): Promise<TQuotationDetail[]> {
		const rows = await this.sales.listQuotations(portal.customerId);
		return Promise.all(rows.map((row) => this.sales.getQuotation(portal.customerId, row.id)));
	}

	getQuotation(portal: PortalContext, id: string): Promise<TQuotationDetail> {
		return this.sales.getQuotation(portal.customerId, id);
	}

	/** Members who may accept an SPH: active owners and approvers. */
	async approvers(portal: PortalContext): Promise<{ id: string; label: string }[]> {
		const members = await this.accounts.members(portal);
		return members
			.filter((member) => member.status === 'active' && MAY_ACCEPT.has(member.role))
			.map((member) => ({ id: member.id, label: member.user.name }));
	}

	/** Accepts a sent SPH as the caller (an owner or approver); creates the sales order. */
	async acceptQuotation(portal: PortalContext, id: string, input: { poNumber?: string; approverId: string }): Promise<TSalesOrderSelect> {
		this.require(portal, MAY_ACCEPT);
		// The approver is the signed-in member; nobody accepts in another member's name.
		if (input.approverId !== portal.identityId) throw new PortalRoleForbiddenError();
		return this.sales.acceptQuotation(portal.customerId, id, { poNumber: input.poNumber ?? null, acceptedBy: portal.user.name });
	}

	async requestRevision(portal: PortalContext, id: string, input: { topics: string[]; message: string }): Promise<void> {
		this.require(portal, MAY_ACCEPT);
		return this.sales.requestRevision(portal.customerId, id, input);
	}

	/* Orders and invoices ---------------------------------------------------- */

	listOrders(portal: PortalContext): Promise<TSalesOrderSelect[]> {
		return this.sales.listOrders(portal.customerId);
	}

	/** One order with the amount already paid on its invoices (minor units). */
	async getOrder(portal: PortalContext, id: string): Promise<{ order: TSalesOrderDetail; paidMinor: number }> {
		const order = await this.sales.getOrder(portal.customerId, id);
		return { order, paidMinor: await this.sales.paidForOrder(portal.customerId, order.id) };
	}

	listInvoices(portal: PortalContext): Promise<TInvoiceSelect[]> {
		return this.sales.listInvoices(portal.customerId);
	}

	getInvoice(portal: PortalContext, id: string): Promise<TCustomerInvoice> {
		return this.sales.getInvoice(portal.customerId, id);
	}

	/** The active gateway, if any (the portal shows one "online payment" method). */
	gatewayStatus(): { enabled: boolean; provider: string | null } {
		return this.gateway.status();
	}

	/**
	 * Opens (or reuses) the gateway checkout of one of the customer's invoices
	 * for its outstanding amount. Owners and finance members only.
	 */
	async payInvoice(portal: PortalContext, invoiceId: string, methodId: string): Promise<TGatewayPaymentView> {
		this.require(portal, MAY_PAY);
		const { provider } = this.gateway.status();
		if (!provider || methodId !== provider) throw new PortalNotFoundError();
		const invoice = await this.sales.getInvoice(portal.customerId, invoiceId);
		return this.gateway.open({ organizationId: invoice.organizationId, actorUserId: portal.userId }, invoice.id);
	}
}
