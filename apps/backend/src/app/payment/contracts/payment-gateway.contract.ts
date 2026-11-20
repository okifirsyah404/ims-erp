import { z } from 'zod';
import { GATEWAY_PROVIDERS, type GatewayProvider, type PaymentMethod } from '@drizzle/schemas/payment.schema';

/**
 * Payment gateway port (ERP-0020, ADR-0021; configuration in
 * `payment.gateways` since ADR-0024 Q18).
 *
 * @remarks
 * Provider neutral: Xendit and SingaPay (and a local `fake`) implement
 * {@link IPaymentGateway} in `adapters/`. Amounts cross the port in **whole
 * rupiah** because that is what gateways charge; the service converts from and
 * to IDR minor units (ADR-0002). A redirect back from the checkout is never
 * trusted; only a verified webhook changes state.
 *
 * Credentials are **not** read from the environment any more: the adapter is
 * built per `payment.gateways` row, with its secret decrypted by
 * `GatewayConfigService` and handed to the constructor. Nothing here logs or
 * returns a secret.
 */

/** What the service asks a provider to open. */
export type TCheckoutRequest = {
	/** Our payment id, the merchant reference at the provider. */
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

/** Checkout states a provider reports (a subset of the ledger statuses). */
export const GATEWAY_EVENT_STATUSES = ['pending', 'paid', 'expired', 'failed'] as const;
export type TGatewayEventStatus = (typeof GATEWAY_EVENT_STATUSES)[number];

/** A verified, provider-neutral webhook event. */
export type TGatewayEvent = {
	/** Our payment id (the merchant reference echoed back). */
	reference: string;
	status: TGatewayEventStatus;
	paidAmountRupiah: number | null;
	paidAt: Date | null;
	/** Provider channel, e.g. BCA, QRIS, OVO. */
	channel: string | null;
	/** Payment method the receipt is recorded with. */
	method: PaymentMethod;
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
	readonly provider: GatewayProvider;
	/** Opens a hosted checkout; throws `GatewayProviderError` on a refusal. */
	createCheckout(request: TCheckoutRequest): Promise<TCheckout>;
	/**
	 * Verifies the webhook came from the provider (throws
	 * `GatewayWebhookUnauthorizedError` otherwise) and maps it. Null = an
	 * authentic event this port does not handle (answered 200, ignored).
	 */
	parseWebhook(request: TWebhookRequest): Promise<TGatewayEvent | null>;
}

/** Builds the adapter of one `payment.gateways` row. */
export type TGatewayFactory = (config: {
	provider: GatewayProvider;
	mode: string;
	config: Record<string, unknown> | null;
	/** Decrypted API secret; never stored in clear text. */
	secret: string;
	/** Decrypted webhook token, when the provider uses one. */
	webhookToken: string | null;
}) => IPaymentGateway;

/* --------------------------------- HTTP --------------------------------- */

export const gatewayProviderParamSchema = z.object({ provider: z.enum(GATEWAY_PROVIDERS) });

/** Outcome of a webhook, returned to the provider (no business data). */
export type TWebhookOutcome = 'applied' | 'unapplied' | 'updated' | 'duplicate' | 'ignored' | 'unknown';

/** Body the `webhook` module passes to the payment module (ADR-0024 Q38). */
export type TWebhookDelivery = {
	provider: GatewayProvider;
	headers: Headers;
	body: unknown;
	path: string;
	method: string;
};
