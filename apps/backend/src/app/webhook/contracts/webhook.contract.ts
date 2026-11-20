/**
 * The provider-neutral webhook envelope (ADR-0024 Q38).
 *
 * @remarks
 * The `webhook` module captures the raw body and the headers, hands the
 * delivery to the owning module, and maps the outcome to HTTP. It never
 * verifies a secret, never reads a table and never decides a business result.
 */
export type TWebhookOutcome = 'accepted' | 'duplicate' | 'rejected' | 'ignored';

export type TWebhookDelivery = {
	/** The provider as it appears in the URL, e.g. `xendit`, `whatsapp`. */
	provider: string;
	method: string;
	path: string;
	headers: Headers;
	/** The body as received: raw text when the provider signs it. */
	rawBody: unknown;
};

/** The handler the owning module publishes for one provider. */
export type TWebhookHandler = (delivery: TWebhookDelivery) => Promise<TWebhookOutcome>;

/** Providers this deployment accepts, and the module that owns each. */
export const WEBHOOK_PROVIDERS = ['xendit', 'singapay', 'whatsapp'] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];
