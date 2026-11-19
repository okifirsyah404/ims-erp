import { COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { CompanyService } from '@app/company/services/company.service';
import { CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { CustomerService } from '@app/crm/services/customer.service';
import { EXPORTED_NOTIFICATION_SERVICE_TOKEN } from '@app/notification/constants/di';
import type { ExportedNotificationService } from '@app/notification/services/exported-notification.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import type { TInvoiceSelect, TSalesOrderSelect } from '@drizzle/schemas/sales.schema';
import { inject, injectable } from 'tsyringe';
import { INVOICE_REPOSITORY_TOKEN } from '../constants/ar-di';
import { QUOTATION_SERVICE_TOKEN, SALES_ORDER_SERVICE_TOKEN } from '../constants/di';
import {
	ONLINE_ORDER_COPY,
	ONLINE_ORDER_OWNER_SETTING,
	type TCustomerInvoice,
	type TOnlineOrderInput,
} from '../contracts/customer-sales.contract';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';
import { InvoiceNotFoundError } from '../errors/invoice.errors';
import {
	OnlineOrderNotConfiguredError,
	QuotationCustomerUnavailableError,
	QuotationNotAwaitingCustomerError,
} from '../errors/quotation.errors';
import type { QuotationService, TQuotationDetail, TQuotationView } from './quotation.service';
import type { SalesOrderService, TSalesOrderDetail } from './sales-order.service';

const rupiah = (minor: number) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(minor / 100))}`;

/**
 * Sales as a customer sees it (ERP-0070): online orders, their SPHs, sales
 * orders and issued invoices, always scoped to one customer id.
 *
 * @remarks
 * Owner decisions 2026-11-14 / user decisions 2026-11-19: an online order
 * (portal or website) becomes a **draft SPH** owned by the customer's
 * account manager (a staff user), falling back to the company setting
 * {@link ONLINE_ORDER_OWNER_SETTING}; sales reviews, approves and sends it as
 * usual; the customer accepts a `sent` SPH and that creates the sales order.
 * The SPH and the order are recorded with the salesperson as the actor
 * (`created_by` = the salesperson who owns the deal); the customer's own act
 * is written into the notes. Invoices stay organization-scoped in Sales, but
 * a customer reads its issued invoices in every organization. Reads use the
 * owning services' customer-scoped methods; another customer's record
 * answers 404.
 */
@injectable()
export class CustomerSalesService {
	constructor(
		@inject(QUOTATION_SERVICE_TOKEN)
		private readonly quotations: Pick<QuotationService, 'create' | 'listForCustomer' | 'getForCustomer'>,
		@inject(SALES_ORDER_SERVICE_TOKEN)
		private readonly orders: Pick<SalesOrderService, 'create' | 'listForCustomer' | 'getForCustomer'>,
		@inject(INVOICE_REPOSITORY_TOKEN)
		private readonly invoices: Pick<TInvoiceRepository, 'listIssuedForCustomer' | 'findIssuedForCustomer' | 'listItems' | 'listReceipts'>,
		@inject(CUSTOMER_SERVICE_TOKEN)
		private readonly customers: Pick<CustomerService, 'getActiveCustomer'>,
		@inject(COMPANY_SERVICE_TOKEN)
		private readonly company: Pick<CompanyService, 'getSettingValue'>,
		@inject(USER_SERVICE_TOKEN)
		private readonly users: Pick<UserService, 'getUser'>,
		@inject(EXPORTED_NOTIFICATION_SERVICE_TOKEN)
		private readonly notifications: Pick<ExportedNotificationService, 'notify'>,
	) {}

	/**
	 * An active **staff** user id, or `null`. A portal login (global role
	 * `customer`, ADR-0024) never owns an SPH: an individual who signed up is
	 * recorded as the owner of their own CRM customer, which must not make
	 * them the salesperson.
	 */
	private async activeStaff(userId: string | null | undefined): Promise<string | null> {
		if (!userId) return null;
		const user = await this.users.getUser(userId).catch(() => null);
		if (!user || user.banned || user.deletedAt) return null;
		const roles = (user.role ?? '').split(',').map((role) => role.trim());
		return roles.includes('customer') ? null : user.id;
	}

	/** The configured default salesperson of online orders, if active staff. */
	private async defaultOwner(): Promise<string | null> {
		return this.activeStaff(await this.company.getSettingValue(ONLINE_ORDER_OWNER_SETTING.group, ONLINE_ORDER_OWNER_SETTING.key));
	}

	/**
	 * The salesperson answering for a deal: the given user when still active
	 * staff, else the default.
	 *
	 * @throws {OnlineOrderNotConfiguredError} Neither is active staff
	 */
	private async ownerOr(userId: string | null): Promise<string> {
		const owner = (await this.activeStaff(userId)) ?? (await this.defaultOwner());
		if (!owner) throw new OnlineOrderNotConfiguredError();
		return owner;
	}

	/**
	 * An online order becomes a draft SPH of the customer's salesperson, who
	 * is notified. Prices are the items' selling prices; VAT is the standard
	 * per-document rate.
	 */
	async requestOrder(input: TOnlineOrderInput): Promise<TQuotationView> {
		const customer = await this.customers.getActiveCustomer(input.customerId);
		if (!customer) throw new QuotationCustomerUnavailableError();
		const owner = await this.ownerOr(customer.ownerUserId);
		const notes = [
			ONLINE_ORDER_COPY.requestedBy(ONLINE_ORDER_COPY.channel[input.source], input.requestedBy),
			input.poNumber ? ONLINE_ORDER_COPY.poNumber(input.poNumber) : null,
			input.note ? ONLINE_ORDER_COPY.note(input.note) : null,
		]
			.filter(Boolean)
			.join('\n');
		const created = await this.quotations.create(
			{ actorUserId: owner, canViewAll: true, canViewDeals: true },
			{
				customerId: customer.id,
				customerContactId: input.contactId,
				leadId: null,
				title: ONLINE_ORDER_COPY.title,
				heading: null,
				attention: null,
				paymentTerms: null,
				paymentSchedule: null,
				guarantee: null,
				quotationDate: null,
				validUntil: null,
				vatEnabled: true,
				vatRateBps: null,
				notes,
				terms: null,
				lines: input.lines.map((line) => ({
					itemId: line.itemId,
					name: null,
					specification: null,
					unit: null,
					quantity: String(line.quantity),
					unitPrice: null,
					discountAmount: 0,
				})),
			},
		);
		await this.notifications.notify({
			userIds: [owner],
			templateCode: 'sales.online_order_received',
			variables: { quotationNumber: created.code, customerName: customer.name, amount: rupiah(created.grandTotal) },
			tags: [created.code],
			sourceType: 'quotation',
			sourceId: created.id,
		});
		return this.quotations.getForCustomer(customer.id, created.id);
	}

	/** The customer's SPHs, newest first, without replaced revisions. */
	listQuotations(customerId: string): Promise<TQuotationView[]> {
		return this.quotations.listForCustomer(customerId);
	}

	/** One SPH of the customer. @throws {QuotationNotFoundError} Unknown, superseded or another customer's */
	getQuotation(customerId: string, id: string): Promise<TQuotationDetail> {
		return this.quotations.getForCustomer(customerId, id);
	}

	/**
	 * The customer accepts a sent SPH: its sales order is created by the
	 * SPH's salesperson (the SPH becomes Deal) and they are notified. An
	 * expired SPH may still be accepted (owner decision 2026-11-04).
	 *
	 * @throws {QuotationNotAwaitingCustomerError} The SPH is not `sent`
	 */
	async acceptQuotation(customerId: string, id: string, input: { poNumber: string | null; acceptedBy: string }): Promise<TSalesOrderSelect> {
		const quotation = await this.quotations.getForCustomer(customerId, id);
		if (quotation.status !== 'sent') throw new QuotationNotAwaitingCustomerError();
		const owner = await this.ownerOr(quotation.createdBy);
		const order = await this.orders.create(
			{ actorUserId: owner, canViewAll: true, canUseAnyQuotation: true },
			{
				quotationId: quotation.id,
				customerPoNumber: input.poNumber,
				orderDate: null,
				deliveryDate: null,
				notes: ONLINE_ORDER_COPY.acceptedBy(input.acceptedBy),
			},
		);
		await this.notifications.notify({
			userIds: [owner],
			templateCode: 'sales.quotation_accepted',
			variables: { quotationNumber: quotation.code, customerName: quotation.customerSnapshot.name, orderNumber: order.code },
			tags: [quotation.code, order.code],
			sourceType: 'quotation',
			sourceId: quotation.id,
		});
		return order;
	}

	/**
	 * The customer asks for changes to a sent SPH: the salesperson is
	 * notified with the topics and message (sales opens the revision).
	 *
	 * @throws {QuotationNotAwaitingCustomerError} The SPH is not `sent`
	 */
	async requestRevision(customerId: string, id: string, input: { topics: string[]; message: string }): Promise<void> {
		const quotation = await this.quotations.getForCustomer(customerId, id);
		if (quotation.status !== 'sent') throw new QuotationNotAwaitingCustomerError();
		const owner = await this.ownerOr(quotation.createdBy);
		const message = [input.topics.length ? `[${input.topics.join(', ')}]` : null, input.message].filter(Boolean).join(' ');
		await this.notifications.notify({
			userIds: [owner],
			templateCode: 'sales.quotation_revision_requested',
			variables: { quotationNumber: quotation.code, customerName: quotation.customerSnapshot.name, message: message.slice(0, 500) },
			tags: [quotation.code],
			sourceType: 'quotation',
			sourceId: quotation.id,
		});
	}

	/** The customer's sales orders, newest first. */
	listOrders(customerId: string): Promise<TSalesOrderSelect[]> {
		return this.orders.listForCustomer(customerId);
	}

	/** One sales order of the customer. @throws {SalesOrderNotFoundError} Unknown or another customer's */
	getOrder(customerId: string, id: string): Promise<TSalesOrderDetail> {
		return this.orders.getForCustomer(customerId, id);
	}

	/** The customer's issued invoices in every organization, newest first. */
	listInvoices(customerId: string): Promise<TInvoiceSelect[]> {
		return this.invoices.listIssuedForCustomer(customerId, 500);
	}

	/** Amount paid (minor units) on the customer's issued invoices of one sales order. */
	async paidForOrder(customerId: string, salesOrderId: string): Promise<number> {
		const invoices = await this.invoices.listIssuedForCustomer(customerId, 500);
		return invoices.filter((invoice) => invoice.salesOrderId === salesOrderId).reduce((sum, invoice) => sum + invoice.paidTotal, 0);
	}

	/** One issued invoice of the customer with its lines and receipts. @throws {InvoiceNotFoundError} */
	async getInvoice(customerId: string, id: string): Promise<TCustomerInvoice> {
		const invoice = await this.invoices.findIssuedForCustomer(customerId, id);
		if (!invoice) throw new InvoiceNotFoundError();
		const [items, receipts] = await Promise.all([
			this.invoices.listItems(invoice.organizationId, invoice.id),
			this.invoices.listReceipts(invoice.organizationId, invoice.id),
		]);
		return { ...invoice, items, receipts };
	}
}
