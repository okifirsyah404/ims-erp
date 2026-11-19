/**
 * End-to-end smoke test for ERP-0047 (Phase 8): a producer call reaches an
 * authenticated browser socket with the exact frame the client routes on.
 *
 * @remarks
 * The chain under test is the real one — `ExportedNotificationService.notify`
 * → dispatcher → `processNotificationSendJob` → repository insert →
 * `IRealtimeHub.publish` → Elysia `/ws` → Bun WebSocket client. Only the two
 * edges are doubled: the Better Auth session seam (mocked, as everywhere in
 * `test/`) and the repository (in-memory, so no Postgres). The socket itself is
 * a real `Bun.serve` on `listen(0)`, because `server.upgrade` does not exist
 * otherwise.
 *
 * The dispatcher is a plain function rather than the BullMQ queue: the queue's
 * only job is to carry this payload across a process boundary, and Redis is not
 * part of what this test is pinning.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import type { AnyElysia } from 'elysia';
import { container } from 'tsyringe';
import type {
	IPushNotificationRepository,
	TPushNotificationInsert,
} from '../../src/app/notification/contracts/notification.repository.interface';
import type { TPushNotificationSelect } from '../../src/app/notification/contracts/notification.repository.interface';
import type { NotificationSendJobData } from '../../src/app/notification/queues/notification.queue';
import type { TPushNotificationTemplateSelect } from '../../drizzle/schemas/notification.schema';
import {
	InProcessRealtimeHub,
	type IRealtimeHub,
	REALTIME_HUB_TOKEN,
} from '../../src/providers/realtime/realtime.hub';

const SMOKE_USER_ID = 'user-smoke';
const VALID_COOKIE = 'better-auth.session_token=valid';

mock.module('@providers/better-auth/auth', () => ({
	auth: {
		api: {
			async getSession({ headers }: { headers: Headers }) {
				if (!headers.get('cookie')?.includes('session_token=valid')) {
					return null;
				}
				return {
					user: { id: SMOKE_USER_ID, email: 'smoke@test.local', name: 'smoke' },
					session: { userId: SMOKE_USER_ID, activeOrganizationId: null },
				};
			},
		},
	},
}));

const TEMPLATE: TPushNotificationTemplateSelect = {
	id: 'tpl-smoke',
	code: 'org.member_added',
	name: 'Member added',
	channel: 'in_app',
	subjectTemplate: 'You joined {{organizationName}}',
	bodyTemplate: 'You were added to {{organizationName}} as {{role}}.',
	variables: ['organizationName', 'role'],
	isActive: true,
	createdAt: new Date('2026-11-13T00:00:00Z'),
	updatedAt: new Date('2026-11-13T00:00:00Z'),
	deletedAt: null,
};

/** In-memory inbox: enough of the contract for the worker's send path. */
function fakeRepository() {
	const inserted: TPushNotificationInsert[] = [];

	const repository = {
		async findTemplateByCode(code: string) {
			return code === TEMPLATE.code ? TEMPLATE : null;
		},
		async insert(entry: TPushNotificationInsert) {
			inserted.push(entry);
			const now = new Date();
			return {
				id: 'n-smoke-1',
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
			} satisfies TPushNotificationSelect;
		},
	} as unknown as IPushNotificationRepository;

	return { repository, inserted };
}

let app: AnyElysia;
let hub: IRealtimeHub;
let baseUrl: string;

beforeAll(async () => {
	const { realtimeGateway } = await import(
		'../../src/providers/realtime/realtime.gateway'
	);
	const { Elysia } = await import('elysia');
	hub = new InProcessRealtimeHub();
	container.registerInstance(REALTIME_HUB_TOKEN, hub);
	app = new Elysia().use(realtimeGateway());
	app.listen(0);
	baseUrl = `ws://localhost:${app.server?.port}/ws`;
});

afterAll(() => {
	app?.stop(true);
});

/** Opens an authenticated socket; rejects (via timeout) when it never opens. */
function openSocket(): Promise<WebSocket> {
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(baseUrl, {
			headers: { cookie: VALID_COOKIE },
		} as never);
		socket.addEventListener('open', () => resolve(socket));
		socket.addEventListener('error', () =>
			reject(new Error('socket refused')),
		);
		setTimeout(() => reject(new Error('socket did not open')), 2000);
	});
}

/** Resolves with the first frame the server sends. */
function nextFrame(socket: WebSocket): Promise<string> {
	return new Promise((resolve, reject) => {
		socket.addEventListener('message', (event) => resolve(String(event.data)), {
			once: true,
		});
		setTimeout(() => reject(new Error('no frame received')), 2000);
	});
}

describe('notification realtime smoke', () => {
	test('a producer call reaches the recipient socket as a notification.created frame', async () => {
		const { repository, inserted } = fakeRepository();
		const { processNotificationSendJob } = await import(
			'../../src/app/notification/queues/notification.worker'
		);
		const { ExportedNotificationService } = await import(
			'../../src/app/notification/services/exported-notification.service'
		);

		const producer = new ExportedNotificationService(
			async (data: NotificationSendJobData) => {
				await processNotificationSendJob(repository, hub, data);
			},
		);

		const socket = await openSocket();
		const framePromise = nextFrame(socket);

		await producer.notify({
			userIds: [SMOKE_USER_ID],
			templateCode: 'org.member_added',
			variables: { organizationName: 'Entragate', role: 'sales' },
			tags: ['Entragate'],
			sourceType: 'organization_member',
			sourceId: 'member-smoke-1',
		});

		const frame = JSON.parse(await framePromise);
		expect(frame).toMatchObject({
			type: 'notification.created',
			status: 'success',
			data: {
				id: 'n-smoke-1',
				templateCode: 'org.member_added',
				title: 'You joined Entragate',
				body: 'You were added to Entragate as sales.',
				tags: ['Entragate'],
				status: 'sent',
				sourceType: 'organization_member',
				sourceId: 'member-smoke-1',
			},
		});
		expect(typeof frame.sentAt).toBe('number');

		// The frame and the stored row must not disagree: the client renders the
		// row's `templateCode` + `variables`, so both have to survive the trip.
		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({
			userId: SMOKE_USER_ID,
			status: 'sent',
			variables: { organizationName: 'Entragate', role: 'sales' },
		});

		socket.close();
	});

	test('a second producer call for the same recipient delivers again', async () => {
		const { repository } = fakeRepository();
		const { processNotificationSendJob } = await import(
			'../../src/app/notification/queues/notification.worker'
		);
		const { ExportedNotificationService } = await import(
			'../../src/app/notification/services/exported-notification.service'
		);
		const producer = new ExportedNotificationService(
			async (data: NotificationSendJobData) => {
				await processNotificationSendJob(repository, hub, data);
			},
		);

		const socket = await openSocket();
		const first = nextFrame(socket);
		await producer.notify({
			userIds: [SMOKE_USER_ID],
			templateCode: 'org.member_added',
			variables: { organizationName: 'Entragate', role: 'owner' },
			tags: ['Entragate'],
		});
		expect(JSON.parse(await first).data.title).toBe('You joined Entragate');

		const second = nextFrame(socket);
		await producer.notify({
			userIds: [SMOKE_USER_ID],
			templateCode: 'org.member_added',
			variables: { organizationName: 'Kedua', role: 'sales' },
			tags: ['Kedua'],
		});
		expect(JSON.parse(await second).data.title).toBe('You joined Kedua');

		socket.close();
	});
});
