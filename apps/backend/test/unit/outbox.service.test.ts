/**
 * ERP events to n8n (M04 4b): publish records the event and queues it (a
 * queue outage never fails the caller), delivery outcomes are logged,
 * retryable vs final failures, the manual send, an unconfigured webhook,
 * and the adapter's HMAC signature and headers.
 */
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TOutboxSelect } from '@drizzle/schemas/automation.schema';
import { N8nWebhookClient, signature } from '../../src/app/automation/adapters/n8n-webhook';
import type { TDeliveryResult } from '../../src/app/automation/contracts/outbox.contract';
import { OutboxService } from '../../src/app/automation/services/outbox.service';

let rows: TOutboxSelect[];
let queued: string[];
let queueDown: boolean;
let next: TDeliveryResult;
let delivered: string[];

function service(configured = true) {
	return new OutboxService(
		{
			create: async (data) => {
				const row = { ...data, id: crypto.randomUUID(), attempts: 0, createdAt: new Date('2026-11-07T01:00:00Z') } as TOutboxSelect;
				rows.push(row);
				return row;
			},
			findById: async (id) => rows.find((row) => row.id === id) ?? null,
			paginate: async () => ({ meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 }, data: rows }),
			recordAttempt: async (id, outcome) => {
				const row = rows.find((item) => item.id === id)!;
				return Object.assign(row, outcome, { attempts: row.attempts + 1 });
			},
			countByStatus: async () => ({}),
		},
		{
			configured,
			deliver: async (envelope) => {
				delivered.push(envelope.id);
				return next;
			},
		},
		{
			enqueue: async (id) => {
				if (queueDown) throw new Error('Redis down');
				queued.push(id);
			},
		},
	);
}

beforeEach(() => {
	rows = [];
	queued = [];
	queueDown = false;
	delivered = [];
	next = { kind: 'delivered', status: 200 };
});

describe('outbox', () => {
	test('publish records the event (its id is the event id) and queues it', async () => {
		const message = await service().publish('lead.created', { type: 'lead', id: 'L1' }, { name: 'Budi' });
		expect(message).toMatchObject({ topic: 'lead.created', status: 'pending', aggregateId: 'L1', payload: { name: 'Budi' } });
		expect(queued).toEqual([message!.id]);
	});

	test('a queue outage never fails the caller; the event waits for a manual send', async () => {
		queueDown = true;
		const message = await service().publish('lead.created', { type: 'lead', id: 'L1' }, {});
		expect(message?.status).toBe('pending');
		const sent = await service().retry(message!.id);
		expect(sent).toMatchObject({ status: 'published', responseStatus: 200, attempts: 1 });
	});

	test('outcomes: published once, retryable failures, final rejections, not configured', async () => {
		const message = (await service().publish('lead.created', { type: 'lead', id: 'L1' }, {}))!;
		next = { kind: 'unreachable', error: 'TimeoutError: …' };
		expect(await service().deliver(message.id)).toMatchObject({ retryable: true, message: { status: 'failed' } });
		next = { kind: 'rejected', status: 503, error: 'busy' };
		expect((await service().deliver(message.id)).retryable).toBe(true);
		next = { kind: 'rejected', status: 401, error: 'bad signature' };
		expect(await service().deliver(message.id)).toMatchObject({ retryable: false, message: { status: 'failed', responseStatus: 401 } });
		next = { kind: 'delivered', status: 200 };
		expect((await service().deliver(message.id)).message.status).toBe('published');
		// Delivered events are never sent twice.
		await service().deliver(message.id);
		expect(delivered).toHaveLength(4);
		const other = (await service(false).publish('lead.created', { type: 'lead', id: 'L2' }, {}))!;
		next = { kind: 'notConfigured' };
		expect(await service(false).deliver(other.id)).toMatchObject({ retryable: false, message: { status: 'pending', errorMessage: 'The n8n webhook is not configured' } });
	});
});

describe('n8n webhook adapter', () => {
	const envelope = { id: 'evt-1', topic: 'lead.created', occurredAt: '2026-11-07T01:00:00.000Z', aggregate: { type: 'lead', id: 'L1' }, data: { name: 'Budi' } };

	test('signs timestamp.body with the shared secret and sends the event headers', async () => {
		let seen: { url: string; init: RequestInit } | null = null;
		const client = new N8nWebhookClient({ url: 'https://n8n.local/webhook/erp', secret: 'secret-of-16-chars!' }, (async (url: string, init: RequestInit) => {
			seen = { url, init };
			return new Response('ok', { status: 200 });
		}) as never);
		expect(await client.deliver(envelope)).toEqual({ kind: 'delivered', status: 200 });
		const headers = seen!.init.headers as Record<string, string>;
		const body = seen!.init.body as string;
		expect(headers['X-Erp-Event-Id']).toBe('evt-1');
		expect(headers['X-Erp-Event-Type']).toBe('lead.created');
		const expected = `sha256=${createHmac('sha256', 'secret-of-16-chars!').update(`${headers['X-Erp-Timestamp']}.${body}`).digest('hex')}`;
		expect(headers['X-Erp-Signature']).toBe(expected);
		expect(signature('k', '1', 'b')).toMatch(/^sha256=[0-9a-f]{64}$/);
	});

	test('a rejection keeps the status, a network error never leaks the URL, no config sends nothing', async () => {
		const rejecting = new N8nWebhookClient({ url: 'https://n8n.local/x?token=abc', secret: 'secret-of-16-chars!' }, (async () =>
			new Response('nope', { status: 403 })) as never);
		expect(await rejecting.deliver(envelope)).toEqual({ kind: 'rejected', status: 403, error: 'nope' });
		const down = new N8nWebhookClient({ url: 'https://n8n.local/x?token=abc', secret: 'secret-of-16-chars!' }, (async () => {
			throw new TypeError('fetch failed https://n8n.local/x?token=abc');
		}) as never);
		const result = await down.deliver(envelope);
		expect(result.kind).toBe('unreachable');
		expect(JSON.stringify(result)).not.toContain('token');
		const none = new N8nWebhookClient({ url: null, secret: null });
		expect(none.configured).toBe(false);
		expect(await none.deliver(envelope)).toEqual({ kind: 'notConfigured' });
	});
});
