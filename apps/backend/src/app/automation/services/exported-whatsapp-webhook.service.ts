import { inject, injectable } from 'tsyringe';
import { WHATSAPP_SERVICE_TOKEN } from '../constants/di';
import type { TWebhookDelivery, TWebhookOutcome } from '../contracts/webhook.contract';
import type { WhatsappService } from './whatsapp.service';

/**
 * Automation's published webhook contract for the `webhook` module (ADR-0024
 * Q38).
 *
 * @remarks
 * The `webhook` module owns `/webhooks/whatsapp`: it captures the raw body,
 * answers fast and maps the outcome to HTTP. Verification stays here, where
 * the provider secret lives. This facade may depend on the full service
 * because `webhook` is a leaf (nothing depends on it).
 */
@injectable()
export class ExportedWhatsappWebhookService {
	constructor(@inject(WHATSAPP_SERVICE_TOKEN) private readonly whatsapp: WhatsappService) {}

	/** Verifies and accepts one inbound message; duplicates are ignored. */
	async handle(delivery: TWebhookDelivery): Promise<TWebhookOutcome> {
		const rawBody = typeof delivery.rawBody === 'string' ? delivery.rawBody : JSON.stringify(delivery.rawBody ?? {});
		try {
			const result = await this.whatsapp.receive(rawBody, delivery.headers.get('x-webhook-hmac'));
			return result.accepted ? 'accepted' : 'ignored';
		} catch {
			// A bad signature or an unconfigured secret: the webhook module answers 401.
			return 'rejected';
		}
	}
}
