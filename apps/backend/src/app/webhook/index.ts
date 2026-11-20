/**
 * Public entry point of the webhook module (ADR-0024 Q38).
 *
 * @remarks
 * No persistence: it captures raw provider calls and hands them to the owning
 * module through that module's exported webhook service. One URL:
 * `/webhooks/<provider>`.
 */
import Elysia from 'elysia';

import { WebhookController } from './controllers/webhook.controller';

export { registerWebhook } from './container';
export type { TWebhookDelivery, TWebhookOutcome } from './contracts/webhook.contract';

/** Elysia instance mounting the webhook controller. */
export function webhookModule() {
	return new Elysia({ name: 'webhook' })
		.use(WebhookController.plugin());
}
