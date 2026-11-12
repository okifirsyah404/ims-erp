/**
 * Injection tokens for the automation module (M04: ERP events to n8n).
 */
import type { InjectionToken } from 'tsyringe';
import type { IOutboxDispatcher, IOutboxRepository, IWebhookClient } from '../contracts/outbox.contract';
import type { OutboxService } from '../services/outbox.service';

export const OUTBOX_REPOSITORY_TOKEN: InjectionToken<IOutboxRepository> = Symbol('OUTBOX_REPOSITORY_TOKEN');
export const WEBHOOK_CLIENT_TOKEN: InjectionToken<IWebhookClient> = Symbol('WEBHOOK_CLIENT_TOKEN');
export const OUTBOX_DISPATCHER_TOKEN: InjectionToken<IOutboxDispatcher> = Symbol('OUTBOX_DISPATCHER_TOKEN');

/** Token resolving to the {@link OutboxService} — the contract modules publish events through. */
export const OUTBOX_SERVICE_TOKEN: InjectionToken<OutboxService> = Symbol('OUTBOX_SERVICE_TOKEN');
