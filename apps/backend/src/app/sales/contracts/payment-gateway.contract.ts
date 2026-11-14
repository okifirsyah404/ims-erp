import { z } from 'zod';
import type {
	ReceiptMethod,
	TGatewayPaymentInsert,
	TGatewayPaymentSelect,
	TGatewayPaymentStatus,
	TGatewayProvider,
} from '@drizzle/schemas/sales.schema';
import { GATEWAY_PROVIDERS } from '@drizzle/schemas/sales.schema';

/**
 * Payment gateway port (ERP-0020, ADR-0019).
 *
 * @remarks
 * Provider neutral: Xendit and SingaPay (and a local `fake`) implement
 * {@link IPaymentGateway} in `adapters/`. Amounts cross the port in **whole
 * rupiah** because that is what gateways charge; the service converts from and
 * to IDR minor units (ADR-0002). A redirect back from the checkout is never
 * trusted; only a verified webhook changes state.
 */

/** What the service asks a provider to open. */
export type TCheckoutRequest = {
	/** Our gateway payment id, the merchant reference at the provider. */
	reference: string;
	amountRupiah: number;
	description: string;
	expiresAt: Date;
	customer: { name: string | null; email: string | null; phone: string | null };
	successRedirectUrl: string | null;
};

/** The provider's answer: its id of the checkout and the page to open. */
export type TCheckout = {
	providerReference: string;
	paymentUrl: string;
	expiresAt: Date | null;
};

/** A verified, provider-neutral webhook event. */
export type TGatewayEvent = {
	/** Our gateway payment id (the merchant reference echoed back). */
	reference: string;
	status: TGatewayPaymentStatus;
	paidAmountRupiah: number | null;
	paidAt: Date | null;
	/** Provider channel, e.g. BCA, QRIS, OVO. */
	channel: string | null;
	/** Receipt method the payment is recorded with. */
	method: ReceiptMethod;
	providerTransactionId: string | null;
	/** The verified body, kept on the row for audit. */
	raw: unknown;
};

/** The parts of the HTTP request a provider signs. */
export type TWebhookRequest = {
	method: string;
	/** Path + query as received. */
	path: string;
	headers: Headers;
	body: unknown;
};

export interface IPaymentGateway {
	readonly provider: TGatewayProvider;
	/** Opens a hosted checkout; throws `GatewayProviderError` on a refusal. */
	createCheckout(request: TCheckoutRequest): Promise<TCheckout>;
	/**
	 * Verifies the webhook came from the provider (throws
	 * `GatewayWebhookUnauthorizedError` otherwise) and maps it. Null = an
	 * authentic event this port does not handle (answered 200, ignored).
	 */
	parseWebhook(request: TWebhookRequest): Promise<TGatewayEvent | null>;
}

/** Providers with credentials; `active` opens new checkouts. */
export interface IPaymentGatewayRegistry {
	/** Checkout settings shared by every provider. */
	readonly checkout: { expiryHours: number; successRedirectUrl: string | null };
	active(): IPaymentGateway | null;
	get(provider: TGatewayProvider): IPaymentGateway | null;
}

/* ------------------------------ repository ------------------------------ */

export type TGatewayPaymentData = Omit<
	TGatewayPaymentInsert,
	'id' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export interface IGatewayPaymentRepository {
	listByInvoice(organizationId: string, invoiceId: string): Promise<TGatewayPaymentSelect[]>;
	/** A pending checkout of this invoice, provider and amount still open after `openUntil`. */
	findReusable(
		organizationId: string,
		invoiceId: string,
		provider: TGatewayProvider,
		amount: number,
		openUntil: Date,
	): Promise<TGatewayPaymentSelect | null>;
	insert(data: TGatewayPaymentData): Promise<TGatewayPaymentSelect>;
	update(id: string, patch: Partial<TGatewayPaymentInsert>, tx?: unknown): Promise<TGatewayPaymentSelect>;
	/** Runs `work` with the row locked (`FOR UPDATE`) in one transaction; null when missing. */
	withLocked<T>(id: string, work: (row: TGatewayPaymentSelect, tx: unknown) => Promise<T>): Promise<T | null>;
}

/* --------------------------------- HTTP --------------------------------- */

export const gatewayProviderParamSchema = z.object({ provider: z.enum(GATEWAY_PROVIDERS) });

/** Outcome of a webhook, returned to the provider (no business data). */
export type TWebhookOutcome = 'applied' | 'unapplied' | 'updated' | 'duplicate' | 'ignored' | 'unknown';
