import { appConfig } from '@config/providers/config';
import type { DependencyContainer } from 'tsyringe';
import { ExportedWhatsappWebhookService } from './services/exported-whatsapp-webhook.service';
import { N8nWebhookClient } from './adapters/n8n-webhook';
import { OpenAiCompatibleModel } from './adapters/openai-compatible';
import { WahaClient } from './adapters/waha';
import {
	ASSISTANT_MODEL_TOKEN,
	ASSISTANT_SERVICE_TOKEN,
	FAQ_REPOSITORY_TOKEN,
	FAQ_SERVICE_TOKEN,
	INBOUND_DISPATCHER_TOKEN,
	OUTBOX_DISPATCHER_TOKEN,
	OUTBOX_REPOSITORY_TOKEN,
	OUTBOX_SERVICE_TOKEN,
	WEBHOOK_CLIENT_TOKEN,
	WHATSAPP_GATEWAY_TOKEN,
	WHATSAPP_REPOSITORY_TOKEN,
	EXPORTED_WHATSAPP_WEBHOOK_SERVICE_TOKEN,
	WHATSAPP_SERVICE_TOKEN,
	WHATSAPP_SETTINGS_TOKEN,
} from './constants/di';
import { BullOutboxDispatcher } from './queues/outbox.queue';
import { BullInboundDispatcher } from './queues/whatsapp.queue';
import { FaqRepository } from './repositories/faq.repository';
import { OutboxRepository } from './repositories/outbox.repository';
import { WhatsappRepository } from './repositories/whatsapp.repository';
import { AssistantService } from './services/assistant.service';
import { FaqService } from './services/faq.service';
import { OutboxService } from './services/outbox.service';
import { WhatsappService } from './services/whatsapp.service';

export * from './constants/di';

/**
 * Registers the automation module (M04: the outbox of ERP events to n8n and
 * the WhatsApp assistant).
 * Registered before the modules that publish events.
 *
 * @param container - The tsyringe container to populate
 */
export function registerAutomation(container: DependencyContainer): void {
	container.register(OUTBOX_REPOSITORY_TOKEN, { useClass: OutboxRepository });
	container.register(WEBHOOK_CLIENT_TOKEN, { useValue: new N8nWebhookClient() });
	container.register(OUTBOX_DISPATCHER_TOKEN, { useValue: new BullOutboxDispatcher() });
	container.register(OUTBOX_SERVICE_TOKEN, { useClass: OutboxService });

	container.register(WHATSAPP_REPOSITORY_TOKEN, { useClass: WhatsappRepository });
	container.register(FAQ_REPOSITORY_TOKEN, { useClass: FaqRepository });
	container.register(WHATSAPP_GATEWAY_TOKEN, { useValue: new WahaClient() });
	container.register(ASSISTANT_MODEL_TOKEN, { useValue: new OpenAiCompatibleModel() });
	container.register(INBOUND_DISPATCHER_TOKEN, { useValue: new BullInboundDispatcher() });
	container.register(WHATSAPP_SETTINGS_TOKEN, { useValue: { webhookSecret: appConfig.integrations.wahaWebhookSecret } });
	container.register(WHATSAPP_SERVICE_TOKEN, { useClass: WhatsappService });
	container.register(EXPORTED_WHATSAPP_WEBHOOK_SERVICE_TOKEN, { useClass: ExportedWhatsappWebhookService });
	container.register(ASSISTANT_SERVICE_TOKEN, { useClass: AssistantService });
	container.register(FAQ_SERVICE_TOKEN, { useClass: FaqService });
}
