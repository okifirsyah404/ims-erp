import { inject, injectable } from 'tsyringe';
import type { TPaymentSelect } from '@drizzle/schemas/payment.schema';
import type { TReceiptSelect } from '@drizzle/schemas/sale.schema';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { DocumentService } from '@app/document/services/document.service';
import { INVOICE_PAYMENT_PORT_TOKEN, InvoiceNotFoundError, InvoiceNotPayableError } from '@app/sale';
import type { IInvoicePaymentPort } from '@app/sale';
import { businessDateOf } from '@utils/business-date.util';
import { GATEWAY_CONFIG_SERVICE_TOKEN, PAYMENT_NUMBERING_SERVICE_TOKEN, PAYMENT_REPOSITORY_TOKEN } from '../constants/di';
import type { IPaymentRepository } from '../contracts/payment.repository.interface';
import type { TWebhookDelivery, TWebhookOutcome } from '../contracts/payment-gateway.contract';
import { GatewayNotConfiguredError, GatewayProviderUnknownError } from '../errors/payment-gateway.errors';
import type { GatewayConfigService } from './gateway-config.service';
import type { PaymentNumberingService } from './payment-numbering.service';
import { minorToChargeRupiah } from '../utils/gateway-signature';

/** A pending checkout is reused only while it stays open at least this long. */
export const REUSE_MARGIN_MS = 15 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROVIDER_LABEL: Record<string, string> = {
	xendit: 'Xendit',
	singapay: 'SingaPay',
	fake: 'fake gateway',
};

const UNAPPLIED_NOTE =
	'Paid online, but the invoice could no longer take a payment (void or already settled): refund or apply by hand.';

/** A checkout as the API shows it: the raw webhook body stays server-side. */
export type TCheckoutView = Omit<TPaymentSelect, 'lastEvent' | 'deletedAt'>;

const view = (row: TPaymentSelect): TCheckoutView => {
	const { lastEvent: _event, deletedAt: _deleted, ...rest } = row;
	return rest;
};

export type TGatewayActionContext = { organizationId: string; actorUserId: string };

/**
 * Online payment of sale invoices (ERP-0020, ADR-0021; ADR-0024 Q18).
 *
 * @remarks
 * A checkout is a `payment.payments` row with `channel = 'gateway'`, allocated
 * to the invoice it pays. `open` asks the organization's default gateway for a
 * hosted checkout of the outstanding amount (whole rupiah, rounded up) and
 * reuses a pending one of the same amount. `handleWebhook` is the only path
 * that changes state: the adapter verifies the request against the gateway row,
 * then - with the payment row locked - a paid event records one receipt
 * (kwitansi) against the invoice, capped at its outstanding amount, registers
 * it as a document and links it to the row, all in one transaction. A replay
 * finds `receiptId` and does nothing; money that can no longer be applied is
 * kept as `paid` without a receipt and a note.
 */
@injectable()
export class GatewayCheckoutService {
	constructor(
		@inject(PAYMENT_REPOSITORY_TOKEN)
		private readonly payments: IPaymentRepository,
		@inject(GATEWAY_CONFIG_SERVICE_TOKEN)
		private readonly gateways: GatewayConfigService,
		/** Sale's contract (ADR-0023): invoices and receipts stay Sale's. */
		@inject(INVOICE_PAYMENT_PORT_TOKEN)
		private readonly invoices: IInvoicePaymentPort,
		@inject(PAYMENT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<PaymentNumberingService, 'next'>,
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register'>,
	) {}

	/** Whether new checkouts can be opened, and with which provider. */
	async status(organizationId: string): Promise<{ enabled: boolean; provider: string | null }> {
		const gateway = await this.gateways.findDefault(organizationId);
		return { enabled: gateway != null, provider: gateway?.provider ?? null };
	}

	async list(organizationId: string, invoiceId: string): Promise<TCheckoutView[]> {
		if (!(await this.invoices.findById(organizationId, invoiceId))) throw new InvoiceNotFoundError();
		return (await this.payments.listCheckoutsOf(organizationId, 'sale_invoice', invoiceId)).map(view);
	}

	/** Opens (or reuses) a hosted checkout of the invoice's outstanding amount. */
	async open(ctx: TGatewayActionContext, invoiceId: string): Promise<TCheckoutView> {
		const row = await this.gateways.findDefault(ctx.organizationId);
		if (!row) throw new GatewayNotConfiguredError();
		const gateway = this.gateways.adapterOf(row);
		const invoice = await this.invoices.findById(ctx.organizationId, invoiceId);
		if (!invoice) throw new InvoiceNotFoundError();
		if ((invoice.status !== 'issued' && invoice.status !== 'partially_paid') || invoice.outstandingTotal <= 0) {
			throw new InvoiceNotPayableError();
		}

		const amountRupiah = minorToChargeRupiah(invoice.outstandingTotal);
		const amount = amountRupiah * 100;
		const now = Date.now();
		const reusable = await this.payments.findReusableCheckout(
			ctx.organizationId,
			'sale_invoice',
			invoiceId,
			row.provider,
			amount,
			new Date(now + REUSE_MARGIN_MS),
		);
		if (reusable) return view(reusable);

		const { expiryHours, successRedirectUrl } = {
			expiryHours: Number((row.config as Record<string, unknown> | null)?.expiryHours ?? 24),
			successRedirectUrl:
				((row.config as Record<string, unknown> | null)?.successRedirectUrl as string | undefined) ?? null,
		};
		const expiresAt = new Date(now + expiryHours * 3_600_000);
		const code = await this.numbering.next('payment', { date: new Date() });
		const created = await this.payments.insert({
			organizationId: ctx.organizationId,
			code,
			paymentType: 'receipt',
			direction: 'in',
			channel: 'gateway',
			gatewayId: row.id,
			provider: row.provider,
			amount,
			currencyCode: invoice.currencyCode,
			expiresAt,
			paymentMethod: 'bank_transfer',
			status: 'pending',
			requestedBy: ctx.actorUserId,
			requestedAt: new Date(),
		});
		await this.payments.syncAllocations(ctx.organizationId, created.id, [
			{ payableType: 'sale_invoice', payableId: invoiceId, amount },
		]);

		const customer = invoice.customerSnapshot;
		try {
			const checkout = await gateway.createCheckout({
				reference: created.id,
				amountRupiah,
				description: [invoice.code ?? 'Invoice', invoice.title].filter(Boolean).join(' - '),
				expiresAt,
				customer: {
					name: customer?.name ?? null,
					email: customer?.email ?? null,
					phone: customer?.phone ?? customer?.whatsapp ?? null,
				},
				successRedirectUrl,
			});
			const updated = await this.payments.update(ctx.organizationId, created.id, {
				providerReference: checkout.providerReference,
				paymentUrl: checkout.paymentUrl,
				expiresAt: checkout.expiresAt ?? expiresAt,
			});
			return view(updated ?? created);
		} catch (error) {
			await this.payments.update(ctx.organizationId, created.id, {
				status: 'failed',
				settlementNote: 'The provider did not open the checkout.',
			});
			throw error;
		}
	}

	/** Verifies and applies one provider notification. */
	async handleWebhook(delivery: TWebhookDelivery): Promise<TWebhookOutcome> {
		const row = await this.gateways.findActiveByProvider(null, delivery.provider);
		if (!row) throw new GatewayProviderUnknownError();
		const gateway = this.gateways.adapterOf(row);
		const event = await gateway.parseWebhook({
			method: delivery.method,
			path: delivery.path,
			headers: delivery.headers,
			body: delivery.body,
		});
		if (!event) return 'ignored';
		if (!UUID.test(event.reference)) return 'unknown';

		let recorded: { receipt: TReceiptSelect; invoiceId: string; organizationId: string } | null = null;
		const outcome = await this.payments.withLocked(event.reference, async (payment, tx): Promise<TWebhookOutcome> => {
			if (payment.provider !== delivery.provider) return 'unknown';
			if (payment.receiptId) return 'duplicate';
			// ADR-0014: the row no longer guarantees its tenant; without one the payment cannot be applied.
			const organizationId = payment.organizationId;
			if (!organizationId) return 'unknown';

			if (event.status !== 'paid') {
				if (payment.status !== 'pending' || event.status === 'pending') return 'ignored';
				await this.payments.update(
					organizationId,
					payment.id,
					{ status: event.status, lastEvent: event.raw as Record<string, unknown> },
					tx as never,
				);
				return 'updated';
			}
			// Paid once already, kept unapplied: nothing more to do.
			if (payment.status === 'paid') return 'duplicate';

			const paidAmount = event.paidAmountRupiah != null ? Math.round(event.paidAmountRupiah * 100) : payment.amount;
			const paidAt = event.paidAt ?? new Date();
			const paid: Partial<TPaymentSelect> = {
				status: 'paid',
				paidAt,
				paidAmount,
				paymentChannel: event.channel,
				providerTransactionId: event.providerTransactionId?.slice(0, 100) ?? null,
				lastEvent: event.raw as Record<string, unknown>,
			};

			const allocations = await this.payments.listAllocations(organizationId, payment.id, tx);
			const invoiceId = allocations.find((allocation) => allocation.payableType === 'sale_invoice')?.payableId;
			const invoice = invoiceId ? await this.invoices.findById(organizationId, invoiceId, tx) : null;
			if (
				!invoiceId ||
				!invoice ||
				(invoice.status !== 'issued' && invoice.status !== 'partially_paid') ||
				invoice.outstandingTotal <= 0 ||
				paidAmount <= 0
			) {
				await this.payments.update(
					organizationId,
					payment.id,
					{ ...paid, settlementNote: UNAPPLIED_NOTE },
					tx as never,
				);
				return 'unapplied';
			}

			const receivedDate = businessDateOf(paidAt);
			const code = await this.numbering.next('receipt', {
				date: new Date(`${receivedDate}T12:00:00+07:00`),
				tx: tx as never,
			});
			const label = PROVIDER_LABEL[delivery.provider] ?? delivery.provider;
			const receipt = await this.invoices.addReceipt(
				{
					invoiceId,
					organizationId,
					code,
					receivedDate,
					amount: paidAmount,
					currencyCode: payment.currencyCode,
					method: event.method,
					reference: (event.providerTransactionId ?? payment.providerReference ?? payment.id).slice(0, 100),
					notes: `Online payment via ${label}${event.channel ? ` (${event.channel})` : ''}, checkout ${payment.id}`,
					receivedBy: null,
					paymentId: payment.id,
				},
				{ tx: tx as never, capToOutstanding: true },
			);
			if (!receipt) {
				await this.payments.update(
					organizationId,
					payment.id,
					{ ...paid, settlementNote: UNAPPLIED_NOTE },
					tx as never,
				);
				return 'unapplied';
			}
			// ERP-0044: a receipt (kwitansi) is an issued document.
			await this.documents.register(
				{
					code: receipt.code,
					documentType: 'receipt',
					module: 'sale',
					sourceType: 'receipt',
					sourceId: receipt.id,
					organizationId,
					issuedOn: receivedDate,
					issuedByUserId: null,
				},
				tx as never,
			);
			// Rounding to whole rupiah can overpay by less than 1 rupiah; more is noted.
			const excess = paidAmount - receipt.amount;
			await this.payments.update(
				organizationId,
				payment.id,
				{
					...paid,
					receiptId: receipt.id,
					settlementNote: excess >= 100 ? `Paid ${excess} minor units above the outstanding amount.` : null,
				},
				tx,
			);
			recorded = { receipt, invoiceId, organizationId };
			return 'applied';
		});
		// After the commit, like a manual receipt: once per applied payment, never on a replay.
		if (outcome === 'applied' && recorded) {
			const applied = recorded as {
				receipt: TReceiptSelect;
				invoiceId: string;
				organizationId: string;
			};
			const invoice = await this.invoices.findById(applied.organizationId, applied.invoiceId);
			if (invoice) await this.invoices.publishReceiptRecorded(applied.receipt, invoice);
		}
		return outcome ?? 'unknown';
	}
}
