/**
 * `/notifications` HTTP surface: session-only guard, caller-scoped reads, 404
 * for another user's row, and the envelope shapes Phase 7 will consume.
 *
 * @remarks
 * The Elysia pipeline (session guard + controller + real service) is exercised
 * through `app.handle()`; only the Better Auth seam and the repository are
 * doubles, matching `test/authorization/*`.
 */
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';
import type { AnyElysia } from 'elysia';
import { container } from 'tsyringe';
import type { IPushNotificationRepository } from '../../src/app/notification/contracts/notification.repository.interface';
import { PUSH_NOTIFICATION_REPOSITORY_TOKEN } from '../../src/app/notification/constants/di';
import { NotificationService } from '../../src/app/notification/services/notification.service';
import { NOTIFICATION_SERVICE_TOKEN } from '../../src/app/notification/constants/di';
import {
	InProcessRealtimeHub,
	REALTIME_HUB_TOKEN,
} from '../../src/providers/realtime/realtime.hub';
import type { TPushNotificationSelect } from '../../drizzle/schemas/notification.schema';

// Top-level so bun hoists it above the imports: the guard reads the session
// from this seam, and a mock installed later never reaches the loaded module.
mock.module('@providers/better-auth/auth', () => ({
	auth: {
		api: {
			async getSession({ headers }: { headers: Headers }) {
				const userId = headers.get('x-test-session');
				if (!userId) return null;
				return {
					user: { id: userId, email: `${userId}@test.local`, name: userId },
					session: { userId, activeOrganizationId: null },
				};
			},
		},
	},
}));

// The login gate reads the database (ADR-0018). This suite has no database, so
// the gate is stubbed open, exactly as `test/authorization/test-app.ts` does.
// The gate's own rule is covered by test/unit/login-gate.test.ts.
mock.module('@providers/better-auth/options/session.auth', () => ({
	isWebAdminSessionAllowed: async () => true,
	sessionAutoActivateOrganizationHook: async () => undefined,
	loadMembershipsForGate: async () => [],
	assertWebAdminAllowed: async () => undefined,
}));

const CALLER = 'user-member';
const OTHER = 'user-sales';
const READ_ID = '0190a1b2-0000-7000-8000-0000000000aa';
const UNREAD_ID = '0190a1b2-0000-7000-8000-0000000000bb';
const OTHER_ID = '0190a1b2-0000-7000-8000-0000000000cc';

let rows: TPushNotificationSelect[] = [];

function row(
	id: string,
	userId: string,
	status: 'sent' | 'read',
	createdAt: string,
): TPushNotificationSelect {
	const at = new Date(createdAt);
	return {
		id,
		notificationTemplateId: 'tpl-1',
		userId,
		templateCode: 'org.member_added',
		title: 'You joined Entragate',
		body: 'Admin added you as member.',
		tags: ['Entragate'],
		variables: { organizationName: 'Entragate' },
		metadata: null,
		channel: 'in_app',
		status,
		sentAt: at,
		readAt: status === 'read' ? at : null,
		sourceType: 'organization_member',
		sourceId: null,
		createdAt: at,
		updatedAt: at,
		deletedAt: null,
	};
}

const repository: IPushNotificationRepository = {
	async insert() {
		throw new Error('not used by the HTTP surface');
	},
	async findTemplateByCode() {
		return null;
	},
	async findByIdForUser(id, userId) {
		return (
			rows.find((entry) => entry.id === id && entry.userId === userId) ?? null
		);
	},
	async listForUser({ userId, page, limit, unreadOnly }) {
		const matching = rows
			.filter((entry) => entry.userId === userId)
			.filter((entry) => (unreadOnly ? entry.status !== 'read' : true))
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		return {
			data: matching.slice((page - 1) * limit, page * limit),
			meta: {
				page,
				limit,
				total: matching.length,
				totalPages: Math.ceil(matching.length / limit) || 1,
			},
		};
	},
	async countUnread(userId) {
		return rows.filter((entry) => entry.userId === userId && entry.status !== 'read')
			.length;
	},
	async markRead(id, userId) {
		const entry = rows.find(
			(candidate) => candidate.id === id && candidate.userId === userId,
		);
		if (!entry) return null;
		entry.status = 'read';
		entry.readAt = new Date();
		return entry;
	},
	async markAllRead(userId) {
		let changed = 0;
		for (const entry of rows) {
			if (entry.userId !== userId || entry.status === 'read') continue;
			entry.status = 'read';
			entry.readAt = new Date();
			changed += 1;
		}
		return changed;
	},
	async pruneRead() {
		return 0;
	},
};

let app: AnyElysia;
/** The controller's `plugin()` factory, captured from the dynamic import. */
let buildPlugin: () => AnyElysia;

beforeAll(async () => {
	container.register(PUSH_NOTIFICATION_REPOSITORY_TOKEN, { useValue: repository });
	container.register(REALTIME_HUB_TOKEN, {
		useValue: new InProcessRealtimeHub(),
	});
	container.register(NOTIFICATION_SERVICE_TOKEN, {
		useClass: NotificationService,
	});

	// Imported after the auth mock is installed (bun mock.module is
	// hoist-sensitive).
	const { NotificationController } = await import(
		'../../src/app/notification/controllers/notification.controller'
	);
	buildPlugin = NotificationController.plugin;
	app = new Elysia().use(buildPlugin());
});

beforeEach(() => {
	rows = [
		row(UNREAD_ID, CALLER, 'sent', '2026-11-13T10:00:00Z'),
		row(READ_ID, CALLER, 'read', '2026-11-12T10:00:00Z'),
		row(OTHER_ID, OTHER, 'sent', '2026-11-13T11:00:00Z'),
	];
});

function request(
	path: string,
	init: { method?: string; session?: string | null } = {},
) {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (init.session !== null) headers['x-test-session'] = init.session ?? CALLER;
	return app.handle(
		new Request(`http://localhost${path}`, {
			method: init.method ?? 'GET',
			headers,
		}),
	);
}

describe('GET /notifications', () => {
	test('an anonymous call returns the standard 401 envelope', async () => {
		const response = await request('/notifications', { session: null });
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toMatchObject({ status: 401, data: null });
		expect(body.errors[0].message).toBe('Authentication required');
	});

	test("lists only the caller's rows, newest first, in the paginated envelope", async () => {
		const response = await request('/notifications');
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.pagination).toMatchObject({ page: 1, limit: 20, total: 2 });
		expect(body.data.map((entry: { id: string }) => entry.id)).toEqual([
			UNREAD_ID,
			READ_ID,
		]);
		// The wire shape carries ISO dates and the display tags.
		expect(body.data[0]).toMatchObject({
			templateCode: 'org.member_added',
			status: 'sent',
			tags: ['Entragate'],
			sentAt: '2026-11-13T10:00:00.000Z',
		});
	});

	test('unreadOnly=true excludes rows already read', async () => {
		const response = await request('/notifications?unreadOnly=true');
		const body = await response.json();

		expect(body.data.map((entry: { id: string }) => entry.id)).toEqual([
			UNREAD_ID,
		]);
		expect(body.pagination.total).toBe(1);
	});

	test('a malformed page is a 400, not a 500', async () => {
		const response = await request('/notifications?page=0');

		expect(response.status).toBe(400);
	});
});

describe('GET /notifications/unread-count', () => {
	test("counts the caller's unread rows", async () => {
		const response = await request('/notifications/unread-count');
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toEqual({ count: 1 });
	});
});

describe('PATCH /notifications/:id/read', () => {
	test('marks the caller’s row read', async () => {
		const response = await request(`/notifications/${UNREAD_ID}/read`, {
			method: 'PATCH',
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toMatchObject({ id: UNREAD_ID, status: 'read' });
		expect(body.data.readAt).not.toBeNull();
	});

	test("another user's row is 404, never 403", async () => {
		const response = await request(`/notifications/${OTHER_ID}/read`, {
			method: 'PATCH',
		});
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toMatchObject({ status: 404, data: null });
		// This test app mounts no i18n instance, so `translator` passes the
		// catalogue key through (see `translator()`'s documented fallback).
		expect(body.message).toBe('notification.notFound');
	});

	test('a non-uuid id is a 400, so Postgres never sees it', async () => {
		const response = await request('/notifications/not-a-uuid/read', {
			method: 'PATCH',
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		// The offending field NAME and the validator's own message. Stringifying
		// the input instead (`[object Object]`) is what used to reach the client.
		expect(body.errors[0]).toEqual({ field: 'id', message: 'Invalid UUID' });
	});

	test('the same 400 comes back from a listening server (compiled route)', async () => {
		// `.listen()` serves the AOT-compiled route, which is where the
		// validation handler previously threw and produced a 500 HTML page;
		// `app.handle()` alone never reproduced it.
		const listening = new Elysia().use(buildPlugin()).listen(0);
		try {
			const response = await fetch(
				`http://localhost:${listening.server?.port}/notifications/not-a-uuid/read`,
				{ method: 'PATCH', headers: { 'x-test-session': CALLER } },
			);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.errors[0]).toEqual({ field: 'id', message: 'Invalid UUID' });
		} finally {
			listening.stop();
		}
	});
});

describe('POST /notifications/read-all', () => {
	test("marks every unread row of the caller and reports the count", async () => {
		const response = await request('/notifications/read-all', {
			method: 'POST',
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toEqual({ changed: 1 });
		// The other user's row is untouched.
		expect(rows.find((entry) => entry.id === OTHER_ID)?.status).toBe('sent');
	});
});
