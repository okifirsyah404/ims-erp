/**
 * The provider-neutral webhook envelope (ADR-0024 Q38).
 *
 * @remarks
 * The `webhook` module captures the raw body, keeps the headers and hands the
 * delivery to the owning module, which verifies it with its own secret and
 * returns one of the outcomes below. The `webhook` module maps the outcome to
 * HTTP and never decides a business result.
 */
export type TWebhookOutcome = 'accepted' | 'duplicate' | 'rejected' | 'ignored';

export type TWebhookDelivery = {
	/** The provider as it appears in the URL, e.g. `whatsapp`, `xendit`. */
	provider: string;
	method: string;
	path: string;
	headers: Headers;
	/** The body as received: raw text when the provider signs it. */
	rawBody: unknown;
};
