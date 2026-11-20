import { describe, expect, test } from 'bun:test';
import type { TNotificationSelect } from '../../src/app/notification/contracts/notification.repository.interface';
import type {
	INotificationRepository,
	TNotificationInsert,
} from '../../src/app/notification/contracts/notification.repository.interface';
import {
	notificationJobId,
} from '../../src/app/notification/queues/notification.queue';
import {
	processNotificationPruneJob,
	processNotificationSendJob,
	renderNotificationText,
} from '../../src/app/notification/queues/notification.worker';
import type { TRealtimeMessage } from '../../src/providers/realtime/realtime.message';
import type { IRealtimeHub } from '../../src/providers/realtime/realtime.hub';
import type { TNotificationTemplateSelect } from '../../drizzle/schemas/notification.schema';

const TEMPLATE: TNotificationTemplateSelect = {
	id: 'tpl-1',
	code: 'org.member_added',
	name: 'Organization member added',
	channel: 'in_app',
	subjectTemplate: 'You joined {{organizationName}}',
	bodyTemplate: '{{actorName}} added you as {{role}}.',
	variables: ['organizationName', 'actorName', 'role'],
	isActive: true,
	createdAt: new Date('2026-11-13T00:00:00Z'),
	updatedAt: new Date('2026-11-13T00:00:00Z'),
	deletedAt: null,
};

function storedRow(entry: TNotificationInsert): TNotificationSelect {
	const now = new Date();
	return {
		id: 'n-1',
		notificationTemplateId: entry.notificationTemplateId,
		userId: entry.userId,
		templateCode: entry.templateCode,
		title: entry.title,
		body: entry.body,
		tags: entry.tags,
		variables: entry.variables,
		metadata: entry.metadata,
		channel: entry.channel,
		status: entry.status,
		sentAt: entry.sentAt,
		readAt: null,
		sourceType: entry.sourceType,
		sourceId: entry.sourceId,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
	};
}

function fakeRepository(template: TNotificationTemplateSelect | null = TEMPLATE) {
	const inserts: TNotificationInsert[] = [];
	const prunedCutoffs: Date[] = [];

	const repository = {
		async findTemplateByCode() {
			return template;
		},
		async insert(entry: TNotificationInsert) {
			inserts.push(entry);
			return storedRow(entry);
		},
		async pruneRead(cutoff: Date) {
			prunedCutoffs.push(cutoff);
			return 2;
		},
	} as unknown as INotificationRepository;

	return { repository, inserts, prunedCutoffs };
}

function fakeHub() {
	const published: { userId: string; message: TRealtimeMessage }[] = [];
	const hub = {
		publish(userId: string, message: TRealtimeMessage) {
			published.push({ userId, message });
			return 1;
		},
		register() {},
		unregister() {},
		connectionCount() {
			return 0;
		},
	} as unknown as IRealtimeHub;
	return { hub, published };
}

const SEND_DATA = {
	userId: 'user-1',
	templateCode: 'org.member_added' as const,
	variables: { organizationName: 'Entragate', actorName: 'Admin', role: 'member' },
	tags: ['Entragate'],
	sourceType: 'organization_member',
	sourceId: 'member-1',
	metadata: null,
};

describe('renderNotificationText', () => {
	test('fills placeholders and tolerates spacing', () => {
		expect(
			renderNotificationText('Hi {{ name }}, welcome to {{org}}.', {
				name: 'Budi',
				org: 'Entragate',
			}),
		).toBe('Hi Budi, welcome to Entragate.');
	});

	test('missing variable becomes an empty string, not a stray brace', () => {
		expect(renderNotificationText('Role: {{role}}.', {})).toBe('Role: .');
	});

	test('a null template renders empty', () => {
		expect(renderNotificationText(null, {})).toBe('');
	});
});

describe('notificationJobId', () => {
	test('is deterministic for the same event and contains no colon', () => {
		const first = notificationJobId({
			templateCode: 'org.member_added',
			userId: 'user-1',
			sourceId: 'member-1',
		});
		const second = notificationJobId({
			templateCode: 'org.member_added',
			userId: 'user-1',
			sourceId: 'member-1',
		});

		expect(first).toBe(second);
		expect(first).toBe('notification-org.member_added-user-1-member-1');
		expect(first).not.toContain(':');
	});

	test('a dedupe key tells events of one source apart (ERP-0092: messages of a ticket)', () => {
		const first = notificationJobId({ templateCode: 'portal.ticket_replied', userId: 'user-1', sourceId: 'ticket-1', dedupeKey: 'message-1' });
		const second = notificationJobId({ templateCode: 'portal.ticket_replied', userId: 'user-1', sourceId: 'ticket-1', dedupeKey: 'message-2' });
		expect(first).toBe('notification-portal.ticket_replied-user-1-message-1');
		expect(second).not.toBe(first);
	});

	test('without a source id, hashes the variables so replays dedupe', () => {
		const variables = { organizationName: 'Entragate', role: 'member' };
		const first = notificationJobId({
			templateCode: 'org.member_added',
			userId: 'user-1',
			variables,
		});
		const second = notificationJobId({
			templateCode: 'org.member_added',
			userId: 'user-1',
			variables: { role: 'member', organizationName: 'Entragate' },
		});
		const other = notificationJobId({
			templateCode: 'org.member_added',
			userId: 'user-1',
			variables: { organizationName: 'Other', role: 'member' },
		});

		expect(first).toBe(second);
		expect(first).not.toBe(other);
	});
});

describe('processNotificationSendJob', () => {
	test('inserts the row as sent and publishes the rendered view', async () => {
		const { repository, inserts } = fakeRepository();
		const { hub, published } = fakeHub();

		const outcome = await processNotificationSendJob(repository, hub, SEND_DATA);

		expect(outcome).toEqual({ status: 'sent', notificationId: 'n-1' });
		expect(inserts).toHaveLength(1);
		expect(inserts[0]).toMatchObject({
			userId: 'user-1',
			notificationTemplateId: 'tpl-1',
			templateCode: 'org.member_added',
			title: 'You joined Entragate',
			body: 'Admin added you as member.',
			tags: ['Entragate'],
			status: 'sent',
			sourceId: 'member-1',
		});
		expect(inserts[0]?.sentAt).toBeInstanceOf(Date);

		expect(published).toHaveLength(1);
		expect(published[0]?.userId).toBe('user-1');
		expect(published[0]?.message.type).toBe('notification.created');
		expect(published[0]?.message.status).toBe('success');
		expect(published[0]?.message.data).toMatchObject({
			id: 'n-1',
			status: 'sent',
			title: 'You joined Entragate',
			tags: ['Entragate'],
		});
	});

	test('a missing template skips the job instead of failing it', async () => {
		const { repository, inserts } = fakeRepository(null);
		const { hub, published } = fakeHub();

		const outcome = await processNotificationSendJob(repository, hub, SEND_DATA);

		expect(outcome).toEqual({ status: 'skipped', reason: 'template-unavailable' });
		expect(inserts).toHaveLength(0);
		expect(published).toHaveLength(0);
	});
});

describe('processNotificationPruneJob', () => {
	test('prunes read rows older than the retention window', async () => {
		const { repository, prunedCutoffs } = fakeRepository();
		const before = Date.now();

		const outcome = await processNotificationPruneJob(repository, 90);

		expect(outcome).toEqual({ removed: 2 });
		expect(prunedCutoffs).toHaveLength(1);
		const cutoff = prunedCutoffs[0]!.getTime();
		const expected = before - 90 * 24 * 60 * 60 * 1_000;
		expect(Math.abs(cutoff - expected)).toBeLessThan(5_000);
	});
});
