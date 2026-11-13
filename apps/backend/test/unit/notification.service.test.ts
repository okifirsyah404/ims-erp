/**
 * In-module service: caller-scoped reads, 404 for another user's row, and the
 * frames published to that user's open sockets.
 *
 * @remarks
 * Repository and hub are hand-written doubles (no Redis, no Postgres); the
 * service is the real one, so this covers the ownership rule and the publish
 * order a controller will rely on.
 */
import { describe, expect, test } from 'bun:test';
import type {
	INotificationRepository,
	TNotificationListRequest,
} from '../../src/app/notification/contracts/notification.repository.interface';
import { NotificationService } from '../../src/app/notification/services/notification.service';
import { NotificationNotFoundError } from '../../src/app/notification/errors/notification.errors';
import type { TRealtimeMessage } from '../../src/providers/realtime/realtime.message';
import type { IRealtimeHub } from '../../src/providers/realtime/realtime.hub';
import type { TNotificationSelect } from '../../drizzle/schemas/notification.schema';

function row(overrides: Partial<TNotificationSelect> = {}): TNotificationSelect {
	const now = new Date('2026-11-13T10:00:00Z');
	return {
		id: 'n-1',
		notificationTemplateId: 'tpl-1',
		userId: 'user-1',
		templateCode: 'org.member_added',
		title: 'You joined Entragate',
		body: 'Admin added you as member.',
		tags: ['Entragate'],
		variables: { organizationName: 'Entragate' },
		metadata: null,
		channel: 'in_app',
		status: 'sent',
		sentAt: now,
		readAt: null,
		sourceType: 'organization_member',
		sourceId: 'member-1',
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		...overrides,
	};
}

function build(options: {
	rows?: TNotificationSelect[];
	markReadResult?: TNotificationSelect | null;
	markAllReadResult?: number;
	unread?: number;
} = {}) {
	const listRequests: TNotificationListRequest[] = [];
	const published: { userId: string; message: TRealtimeMessage }[] = [];
	let unreadCalls = 0;

	const repository = {
		async listForUser(request: TNotificationListRequest) {
			listRequests.push(request);
			const rows = options.rows ?? [];
			return {
				data: rows,
				meta: {
					page: request.page,
					limit: request.limit,
					total: rows.length,
					totalPages: 1,
				},
			};
		},
		async countUnread() {
			unreadCalls += 1;
			return options.unread ?? 0;
		},
		async markRead() {
			return options.markReadResult ?? null;
		},
		async markAllRead() {
			return options.markAllReadResult ?? 0;
		},
		async findByIdForUser() {
			return null;
		},
	} as unknown as INotificationRepository;

	const hub = {
		publish(userId: string, message: TRealtimeMessage) {
			published.push({ userId, message });
			return 1;
		},
	} as unknown as IRealtimeHub;

	return {
		service: new NotificationService(repository, hub),
		listRequests,
		published,
		unreadCalls: () => unreadCalls,
	};
}

const QUERY = { page: 1, limit: 20, unreadOnly: false };

describe('NotificationService.list', () => {
	test('scopes the query to the caller and maps rows to the wire shape', async () => {
		const { service, listRequests } = build({ rows: [row()] });

		const page = await service.list('user-1', QUERY);

		expect(listRequests[0]).toMatchObject({ userId: 'user-1', page: 1, limit: 20 });
		expect(page.data[0]).toMatchObject({
			id: 'n-1',
			status: 'sent',
			tags: ['Entragate'],
			// Dates leave as ISO strings so HTTP and WebSocket agree.
			sentAt: '2026-11-13T10:00:00.000Z',
			readAt: null,
		});
	});
});

describe('NotificationService.markRead', () => {
	test('publishes the updated row and the new unread count', async () => {
		const { service, published } = build({
			markReadResult: row({ status: 'read', readAt: new Date('2026-11-13T11:00:00Z') }),
			unread: 3,
		});

		const view = await service.markRead('n-1', 'user-1');

		expect(view.status).toBe('read');
		expect(published.map((entry) => entry.message.type)).toEqual([
			'notification.updated',
			'notification.unread_count',
		]);
		expect(published[0]?.userId).toBe('user-1');
		expect(published[1]?.message.data).toEqual({ count: 3 });
	});

	test("another user's row is a 404 and publishes nothing", async () => {
		const { service, published, unreadCalls } = build({ markReadResult: null });

		await expect(service.markRead('n-1', 'user-2')).rejects.toBeInstanceOf(
			NotificationNotFoundError,
		);
		expect(published).toHaveLength(0);
		expect(unreadCalls()).toBe(0);
	});
});

describe('NotificationService.markAllRead', () => {
	test('returns the changed count and publishes the new unread count', async () => {
		const { service, published } = build({ markAllReadResult: 4, unread: 0 });

		expect(await service.markAllRead('user-1')).toBe(4);
		expect(published).toHaveLength(1);
		expect(published[0]?.message).toMatchObject({
			type: 'notification.unread_count',
			status: 'success',
			data: { count: 0 },
		});
	});
});

describe('NotificationService.assertOwnedBy', () => {
	test('throws 404 when the row is not the caller’s', async () => {
		const { service } = build();

		await expect(service.assertOwnedBy('n-1', 'user-1')).rejects.toBeInstanceOf(
			NotificationNotFoundError,
		);
	});
});
