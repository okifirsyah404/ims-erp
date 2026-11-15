/**
 * Public entry point of the automation module (M04: ERP events to n8n and
 * the WhatsApp assistant). `src/app/app.ts` mounts `.use(automationModule())`.
 */
import Elysia from 'elysia';

import { FaqController } from './controllers/faq.controller';
import { OutboxController } from './controllers/outbox.controller';
import { WhatsappWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsappController } from './controllers/whatsapp.controller';

export { registerAutomation } from './container';
export { startOutboxWorker } from './queues/outbox.worker';
export { startWhatsappWorker } from './queues/whatsapp.worker';

/** Elysia instance mounting every automation controller, in route order. */
export function automationModule() {
	return new Elysia({ name: 'automation' })
		.use(OutboxController.plugin())
		.use(WhatsappController.plugin())
		.use(FaqController.plugin())
		.use(WhatsappWebhookController.plugin());
}
