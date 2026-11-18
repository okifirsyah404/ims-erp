import { z } from 'zod';
import { OUTBOX_STATUSES, type TOutboxInsert, type TOutboxSelect } from '@drizzle/schemas/automation.schema';
import type { TPaginationResult } from '@ims-erp/common';

/**
 * ERP events to n8n (M04, decisions of 2026-11-07): the outbox, its
 * delivery port and its persistence port.
 */

/** Topics the ERP publishes (stage 1: lead.created; stage 2: the rest). */
export const OUTBOX_TOPICS = [
	'lead.created',
	'invoice.issued',
	'receipt.recorded',
	'license.due',
	'service_ticket.updated',
	'whatsapp.handoff',
	// ERP-0068: purchase return approvals, shipping and cancellations.
	'purchase_return.updated',
	// ERP-0065: sales return approvals, receipts and cancellations.
	'sales_return.updated',
] as const;
export type OutboxTopic = (typeof OUTBOX_TOPICS)[number];

export const outboxListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(OUTBOX_STATUSES).optional(),
	topic: z.enum(OUTBOX_TOPICS).optional(),
});
export type TOutboxListQuery = z.output<typeof outboxListQuerySchema>;
export const idParamSchema = z.object({ id: z.uuid() });

/** One event as POSTed to n8n. */
export type TOutboxEnvelope = {
	id: string;
	topic: string;
	occurredAt: string;
	aggregate: { type: string | null; id: string | null };
	data: Record<string, unknown>;
};

/** Outcome of one delivery attempt. */
export type TDeliveryResult =
	| { kind: 'delivered'; status: number }
	| { kind: 'rejected'; status: number; error: string }
	| { kind: 'unreachable'; error: string }
	| { kind: 'notConfigured' };

/** Port to the n8n webhook (HTTP POST with an HMAC signature). */
export interface IWebhookClient {
	/** Both the URL and the secret are set in server config. */
	readonly configured: boolean;
	deliver(envelope: TOutboxEnvelope): Promise<TDeliveryResult>;
}

/** Port to the background queue that delivers (and retries) events. */
export interface IOutboxDispatcher {
	enqueue(outboxId: string): Promise<void>;
}

/** Persistence port of `automation.outbox_messages`. */
export interface IOutboxRepository {
	/** `null` when a row with the same `dedupeKey` already exists. */
	create(data: Omit<TOutboxInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<TOutboxSelect | null>;
	findById(id: string): Promise<TOutboxSelect | null>;
	paginate(query: TOutboxListQuery): Promise<TPaginationResult<TOutboxSelect>>;
	/** Counts the attempt and stores its outcome; `null` when the event is already published (conditional update). */
	recordAttempt(
		id: string,
		outcome: { status: TOutboxSelect['status']; responseStatus: number | null; errorMessage: string | null },
	): Promise<TOutboxSelect | null>;
	countByStatus(): Promise<Record<string, number>>;
}
