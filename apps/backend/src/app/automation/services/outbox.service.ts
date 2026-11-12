import type { TOutboxSelect } from '@drizzle/schemas/automation.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { pinoLogger } from '@providers/logger/logger';
import { inject, injectable } from 'tsyringe';
import { OUTBOX_DISPATCHER_TOKEN, OUTBOX_REPOSITORY_TOKEN, WEBHOOK_CLIENT_TOKEN } from '../constants/di';
import type { IOutboxDispatcher, IOutboxRepository, IWebhookClient, OutboxTopic, TOutboxListQuery } from '../contracts/outbox.contract';
import { OutboxNotFoundError } from '../errors/automation.errors';

export type TDeliveryOutcome = { message: TOutboxSelect; retryable: boolean };

/**
 * ERP events to n8n (M04, decisions of 2026-11-07).
 *
 * @remarks
 * `publish` writes the event (the row id is the event id n8n dedupes on) and
 * hands it to the background queue, which delivers and retries it; a queue
 * outage never fails the business action — the event stays `pending` and can
 * be sent by hand. Every attempt is logged on the row: `published`,
 * `failed` (with the HTTP status or the reason), or `pending` when no
 * webhook is configured yet.
 */
@injectable()
export class OutboxService {
	constructor(
		@inject(OUTBOX_REPOSITORY_TOKEN) private readonly repository: IOutboxRepository,
		@inject(WEBHOOK_CLIENT_TOKEN) private readonly webhook: IWebhookClient,
		@inject(OUTBOX_DISPATCHER_TOKEN) private readonly dispatcher: IOutboxDispatcher,
	) {}

	/**
	 * Records an event and queues its delivery. Never throws into the caller's
	 * flow. With `dedupeKey`, an event already recorded under that key is not
	 * recorded again (returns `null`).
	 */
	async publish(
		topic: OutboxTopic,
		aggregate: { type: string; id: string },
		data: Record<string, unknown>,
		options: { dedupeKey?: string } = {},
	): Promise<TOutboxSelect | null> {
		try {
			const message = await this.repository.create({
				topic,
				aggregateType: aggregate.type,
				aggregateId: aggregate.id,
				payload: data,
				status: 'pending',
				dedupeKey: options.dedupeKey ?? null,
			});
			if (!message) return null;
			await this.dispatcher.enqueue(message.id).catch((error: unknown) => {
				pinoLogger.warn({ err: error, outboxId: message.id }, 'outbox enqueue failed; the event waits for a manual send');
			});
			return message;
		} catch (error) {
			pinoLogger.error({ err: error, topic }, 'outbox publish failed');
			return null;
		}
	}

	/** One delivery attempt; the queue retries when `retryable`. */
	async deliver(id: string): Promise<TDeliveryOutcome> {
		const message = await this.repository.findById(id);
		if (!message) throw new OutboxNotFoundError();
		if (message.status === 'published') return { message, retryable: false };
		const result = await this.webhook.deliver({
			id: message.id,
			topic: message.topic,
			occurredAt: message.createdAt.toISOString(),
			aggregate: { type: message.aggregateType, id: message.aggregateId },
			data: message.payload,
		});
		const outcome =
			result.kind === 'delivered'
				? { status: 'published' as const, responseStatus: result.status, errorMessage: null }
				: result.kind === 'notConfigured'
					? { status: 'pending' as const, responseStatus: null, errorMessage: 'The n8n webhook is not configured' }
					: { status: 'failed' as const, responseStatus: result.kind === 'rejected' ? result.status : null, errorMessage: result.error };
		const updated = (await this.repository.recordAttempt(id, outcome)) ?? message;
		// Client errors (4xx except 408/429) will not heal by retrying.
		const retryable =
			result.kind === 'unreachable' ||
			(result.kind === 'rejected' && (result.status >= 500 || result.status === 408 || result.status === 429));
		return { message: updated, retryable };
	}

	/** Manual send from the log screen. */
	async retry(id: string): Promise<TOutboxSelect> {
		return (await this.deliver(id)).message;
	}

	list(query: TOutboxListQuery): Promise<TPaginationResult<TOutboxSelect>> {
		return this.repository.paginate(query);
	}

	/** Counts per status, and whether the n8n webhook is configured at all. */
	async summary(): Promise<{ counts: Record<string, number>; configured: boolean }> {
		return { counts: await this.repository.countByStatus(), configured: this.webhook.configured };
	}
}
