/**
 * Public entry point of the webhook module (ADR-0024 Q38).
 *
 * @remarks
 * No persistence: it captures raw provider calls and hands them to the owning
 * module through that module's exported webhook service. Primary URL
 * `/webhooks/<provider>`; the legacy `/payments/gateway/<provider>/webhook`
 * and `/integrations/whatsapp/webhook` paths stay as aliases (Q34).
 */
import Elysia from 'elysia';

import { WebhookController } from './controllers/webhook.controller';

export { registerWebhook } from './container';
export type { TWebhookDelivery, TWebhookOutcome } from './contracts/webhook.contract';

/** Elysia instance mounting the webhook controller and its aliases. */
export function webhookModule() {
	return new Elysia({ name: 'webhook' })
		.use(WebhookController.plugin())
		// Legacy paths the providers are configured with today (Q34).
		.use(WebhookController.plugin('/payments/gateway'))
		.use(WebhookController.plugin('/integrations/whatsapp'));
}
