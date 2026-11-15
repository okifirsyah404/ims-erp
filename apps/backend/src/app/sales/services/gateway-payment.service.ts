import { inject, injectable } from 'tsyringe';
import type { TTx } from '@drizzle/types';
import type { TGatewayPaymentSelect, TGatewayProvider } from '@drizzle/schemas/sales.schema';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document';
import type { DocumentService } from '@app/document';
import { businessDateOf } from '@utils/business-date.util';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import type { TReceiptSelect } from '@drizzle/schemas/sales.schema';
import { receiptRecordedEvent } from '../utils/invoice-events';
import {
	GATEWAY_PAYMENT_REPOSITORY_TOKEN,
	INVOICE_REPOSITORY_TOKEN,
	PAYMENT_GATEWAY_REGISTRY_TOKEN,
} from '../constants/ar-di';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';
import type {
	IGatewayPaymentRepository,
	IPaymentGatewayRegistry,
	TWebhookOutcome,
	TWebhookRequest,
} from '../contracts/payment-gateway.contract';
import { InvoiceNotFoundError, InvoiceNotPayableError } from '../errors/invoice.errors';
import { GatewayNotConfiguredError, GatewayProviderUnknownError } from '../errors/payment-gateway.errors';
import { minorToChargeRupiah } from '../utils/gateway-signature';

/** A pending checkout is reused only while it stays open at least this long. */
export const REUSE_MARGIN_MS = 15 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROVIDER_LABEL: Record<TGatewayProvider, string> = {
	xendit: 'Xendit',
	singapay: 'SingaPay',
	fake: 'fake gateway',
};

const UNAPPLIED_NOTE =
	'Paid online, but the invoice could no longer take a payment (void or already settled): refund or apply by hand.';

/** A gateway payment as the API shows it: the raw webhook body stays server-side. */
export type TGatewayPaymentView = Omit<TGatewayPaymentSelect, 'lastEvent' | 'deletedAt'>;

function view(row: TGatewayPaymentSelect): TGatewayPaymentView {
	const { lastEvent: _event, deletedAt: _deleted, ...rest } = row;
	return rest;
}

export type TGatewayActionContext = { organizationId: string; actorUserId: string };

/**
 * Online payment of sales invoices (ERP-0020, ADR-0021).
 *
 * @remarks
 * `open` asks the configured provider for a hosted checkout of the invoice's
 * outstanding amount (whole rupiah, rounded up) and reuses a pending one of
 * the same amount. `handleWebhook` is the only path that changes state: the
 * provider adapter verifies the request, then — with the checkout row locked —
 * a paid event posts one receipt (kwitansi) against the invoice, capped at its
 * outstanding amount, registers it as a document and links it to the row, all
 * in one transaction. A replay finds `receipt_id` and does nothing; money that
 * can no longer be applied is kept as `paid` without a receipt and a note.
 */
@injectable()
export class GatewayPaymentService {
	constructor(
		@inject(GATEWAY_PAYMENT_REPOSITORY_TOKEN)
		private readonly repo: IGatewayPaymentRepository,
		@inject(PAYMENT_GATEWAY_REGISTRY_TOKEN)
		private readonly gateways: IPaymentGatewayRegistry,
		@inject(INVOICE_REPOSITORY_TOKEN)
		private readonly invoices: Pick<TInvoiceRepository, 'findById' | 'addReceipt'>,
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly numbering: Pick<CodeNumberService, 'next'>,
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register'>,
		/** M04: an online payment is a received payment for n8n too (`receipt.recorded`). */
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
	) {}

	/** Whether new checkouts can be opened, and with which provider. */
	status(): { enabled: boolean; provider: TGatewayProvider | null } {
		const gateway = this.gateways.active();
		return { enabled: gateway != null, provider: gateway?.provider ?? null };
	}

	async list(organizationId: string, invoiceId: string): Promise<TGatewayPaymentView[]> {
		if (!(await this.invoices.findById(organizationId, invoiceId))) throw new InvoiceNotFoundError();
		return (await this.repo.listByInvoice(organizationId, invoiceId)).map(view);
	}

	async open(ctx: TGatewayActionContext, invoiceId: string): Promise<TGatewayPaymentView> {
		const gateway = this.gateways.active();
		if (!gateway) throw new GatewayNotConfiguredError();
		const invoice = await this.invoices.findById(ctx.organizationId, invoiceId);
		if (!invoice) throw new InvoiceNotFoundError();
		if ((invoice.status !== 'issued' && invoice.status !== 'partially_paid') || invoice.outstandingTotal <= 0)
			throw new InvoiceNotPayableError();

		const amountRupiah = minorToChargeRupiah(invoice.outstandingTotal);
		const amount = amountRupiah * 100;
		const now = Date.now();
		const reusable = await this.repo.findReusable(
			ctx.organizationId,
			invoiceId,
			gateway.provider,
			amount,
			new Date(now + REUSE_MARGIN_MS),
		);
		if (reusable) return view(reusable);

		const { expiryHours, successRedirectUrl } = this.gateways.checkout;
		const expiresAt = new Date(now + expiryHours * 3_600_000);
		const row = await this.repo.insert({
			organizationId: ctx.organizationId,
			salesInvoiceId: invoiceId,
			provider: gateway.provider,
			amount,
			currencyCode: invoice.currencyCode,
			expiresAt,
			requestedBy: ctx.actorUserId,
		});
		const customer = invoice.customerSnapshot;
		try {
			const checkout = await gateway.createCheckout({
				reference: row.id,
				amountRupiah,
				description: [invoice.code ?? 'Invoice', invoice.title].filter(Boolean).join(' - '),
				expiresAt,
				customer: {
					name: customer?.name ?? null,
					email: customer?.email ?? null,
					phone: customer?.phone ?? customer?.whatsapp ?? null,
				},
				successRedirectUrl: successRedirectUrl ?? null,
			});
			return view(
				await this.repo.update(row.id, {
					providerReference: checkout.providerReference,
					paymentUrl: checkout.paymentUrl,
					expiresAt: checkout.expiresAt ?? expiresAt,
				}),
			);
		} catch (error) {
			await this.repo.update(row.id, {
				status: 'failed',
				settlementNote: 'The provider did not open the checkout.',
			});
			throw error;
		}
	}

	async handleWebhook(provider: TGatewayProvider, request: TWebhookRequest): Promise<TWebhookOutcome> {
		const gateway = this.gateways.get(provider);
		if (!gateway) throw new GatewayProviderUnknownError();
		const event = await gateway.parseWebhook(request);
		if (!event) return 'ignored';
		if (!UUID.test(event.reference)) return 'unknown';

		let recorded: TReceiptSelect | null = null;
		const outcome = await this.repo.withLocked(event.reference, async (row, tx): Promise<TWebhookOutcome> => {
			if (row.provider !== provider) return 'unknown';
			if (row.receiptId) return 'duplicate';

			if (event.status !== 'paid') {
				if (row.status !== 'pending' || event.status === 'pending') return 'ignored';
				await this.repo.update(row.id, { status: event.status, lastEvent: event.raw }, tx);
				return 'updated';
			}
			// Paid once already, kept unapplied: nothing more to do.
			if (row.status === 'paid') return 'duplicate';

			const paidAmount = event.paidAmountRupiah != null ? Math.round(event.paidAmountRupiah * 100) : row.amount;
			const paidAt = event.paidAt ?? new Date();
			const paid = {
				status: 'paid' as const,
				paidAt,
				paidAmount,
				paymentChannel: event.channel,
				providerTransactionId: event.providerTransactionId?.slice(0, 100) ?? null,
				lastEvent: event.raw,
			};

			// Always set when the checkout is opened; nullable only per ADR-0014.
			const organizationId = row.organizationId;
			const invoice = organizationId ? await this.invoices.findById(organizationId, row.salesInvoiceId, tx) : null;
			if (
				!organizationId ||
				!invoice ||
				(invoice.status !== 'issued' && invoice.status !== 'partially_paid') ||
				invoice.outstandingTotal <= 0 ||
				paidAmount <= 0
			) {
				await this.repo.update(row.id, { ...paid, settlementNote: UNAPPLIED_NOTE }, tx);
				return 'unapplied';
			}

			const receivedDate = businessDateOf(paidAt);
			const code = await this.numbering.next('receipt', {
				date: new Date(`${receivedDate}T12:00:00+07:00`),
				tx: tx as TTx,
			});
			const label = PROVIDER_LABEL[provider];
			const receipt = await this.invoices.addReceipt(
				{
					salesInvoiceId: row.salesInvoiceId,
					organizationId,
					code,
					receivedDate,
					amount: paidAmount,
					currencyCode: row.currencyCode,
					method: event.method,
					reference: (event.providerTransactionId ?? row.providerReference ?? row.id).slice(0, 100),
					notes: `Online payment via ${label}${event.channel ? ` (${event.channel})` : ''}, checkout ${row.id}`,
					receivedBy: null,
				},
				{ tx, capToOutstanding: true },
			);
			if (!receipt) {
				await this.repo.update(row.id, { ...paid, settlementNote: UNAPPLIED_NOTE }, tx);
				return 'unapplied';
			}
			// ERP-0044: a receipt (kwitansi) is an issued document.
			await this.documents.register(
				{
					code: receipt.code,
					documentType: 'receipt',
					module: 'sales',
					sourceType: 'receipt',
					sourceId: receipt.id,
					organizationId,
					issuedOn: receivedDate,
					issuedByUserId: null,
				},
				tx as TTx,
			);
			// Rounding to whole rupiah can overpay by less than 1 rupiah; more is noted.
			const excess = paidAmount - receipt.amount;
			await this.repo.update(
				row.id,
				{
					...paid,
					receiptId: receipt.id,
					settlementNote: excess >= 100 ? `Paid ${excess} minor units above the outstanding amount.` : null,
				},
				tx,
			);
			recorded = receipt;
			return 'applied';
		});
		// After the commit, like a manual receipt: once per applied payment, never on a replay.
		if (outcome === 'applied' && recorded) {
			const receipt: TReceiptSelect = recorded;
			const invoice = await this.invoices.findById(receipt.organizationId, receipt.salesInvoiceId);
			if (invoice) {
				await this.outbox.publish('receipt.recorded', { type: 'receipt', id: receipt.id }, receiptRecordedEvent(receipt, invoice));
			}
		}
		return outcome ?? 'unknown';
	}
}
