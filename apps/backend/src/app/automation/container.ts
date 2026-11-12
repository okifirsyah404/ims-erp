import type { DependencyContainer } from 'tsyringe';
import { N8nWebhookClient } from './adapters/n8n-webhook';
import { OUTBOX_DISPATCHER_TOKEN, OUTBOX_REPOSITORY_TOKEN, OUTBOX_SERVICE_TOKEN, WEBHOOK_CLIENT_TOKEN } from './constants/di';
import { BullOutboxDispatcher } from './queues/outbox.queue';
import { OutboxRepository } from './repositories/outbox.repository';
import { OutboxService } from './services/outbox.service';

export * from './constants/di';

/**
 * Registers the automation module (M04: the outbox of ERP events to n8n).
 * Registered before the modules that publish events.
 *
 * @param container - The tsyringe container to populate
 */
export function registerAutomation(container: DependencyContainer): void {
	container.register(OUTBOX_REPOSITORY_TOKEN, { useClass: OutboxRepository });
	container.register(WEBHOOK_CLIENT_TOKEN, { useValue: new N8nWebhookClient() });
	container.register(OUTBOX_DISPATCHER_TOKEN, { useValue: new BullOutboxDispatcher() });
	container.register(OUTBOX_SERVICE_TOKEN, { useClass: OutboxService });
}
