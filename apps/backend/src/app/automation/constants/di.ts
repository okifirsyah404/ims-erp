/**
 * Injection tokens for the automation module (M04: ERP events to n8n, the
 * WhatsApp assistant).
 */
import type { InjectionToken } from 'tsyringe';
import type { ExportedWhatsappWebhookService } from '../services/exported-whatsapp-webhook.service';
import type { IOutboxDispatcher, IOutboxRepository, IWebhookClient } from '../contracts/outbox.contract';
import type {
	IAssistantModel,
	IFaqRepository,
	IInboundDispatcher,
	IWhatsappGateway,
	IWhatsappRepository,
	TWhatsappSettings,
} from '../contracts/whatsapp.contract';
import type { AssistantService } from '../services/assistant.service';
import type { FaqService } from '../services/faq.service';
import type { OutboxService } from '../services/outbox.service';
import type { WhatsappService } from '../services/whatsapp.service';

export const OUTBOX_REPOSITORY_TOKEN: InjectionToken<IOutboxRepository> = Symbol('OUTBOX_REPOSITORY_TOKEN');
export const WEBHOOK_CLIENT_TOKEN: InjectionToken<IWebhookClient> = Symbol('WEBHOOK_CLIENT_TOKEN');
export const OUTBOX_DISPATCHER_TOKEN: InjectionToken<IOutboxDispatcher> = Symbol('OUTBOX_DISPATCHER_TOKEN');

/** Token resolving to the {@link OutboxService} — the contract modules publish events through. */
export const OUTBOX_SERVICE_TOKEN: InjectionToken<OutboxService> = Symbol('OUTBOX_SERVICE_TOKEN');

export const WHATSAPP_REPOSITORY_TOKEN: InjectionToken<IWhatsappRepository> = Symbol('WHATSAPP_REPOSITORY_TOKEN');
export const FAQ_REPOSITORY_TOKEN: InjectionToken<IFaqRepository> = Symbol('FAQ_REPOSITORY_TOKEN');
export const WHATSAPP_GATEWAY_TOKEN: InjectionToken<IWhatsappGateway> = Symbol('WHATSAPP_GATEWAY_TOKEN');
export const ASSISTANT_MODEL_TOKEN: InjectionToken<IAssistantModel> = Symbol('ASSISTANT_MODEL_TOKEN');
export const INBOUND_DISPATCHER_TOKEN: InjectionToken<IInboundDispatcher> = Symbol('INBOUND_DISPATCHER_TOKEN');
export const WHATSAPP_SERVICE_TOKEN: InjectionToken<WhatsappService> = Symbol('WHATSAPP_SERVICE_TOKEN');
export const ASSISTANT_SERVICE_TOKEN: InjectionToken<AssistantService> = Symbol('ASSISTANT_SERVICE_TOKEN');
export const FAQ_SERVICE_TOKEN: InjectionToken<FaqService> = Symbol('FAQ_SERVICE_TOKEN');
export const WHATSAPP_SETTINGS_TOKEN: InjectionToken<TWhatsappSettings> = Symbol('WHATSAPP_SETTINGS_TOKEN');

/** Published to the `webhook` module: verified, deduped WhatsApp deliveries. */
export const EXPORTED_WHATSAPP_WEBHOOK_SERVICE_TOKEN: InjectionToken<ExportedWhatsappWebhookService> =
	Symbol('EXPORTED_WHATSAPP_WEBHOOK_SERVICE');
