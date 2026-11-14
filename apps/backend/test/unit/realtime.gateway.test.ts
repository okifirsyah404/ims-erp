/**
 * `/ws` transport contract: the upgrade is refused without a session, opens
 * with one, and a hub publish reaches the connected client with the exact
 * envelope.
 *
 * @remarks
 * A real `Bun.serve` is used (`listen(0)` + the Bun WebSocket client) because
 * the upgrade path cannot be exercised through `app.handle()`: `Bun`'s
 * `server.upgrade` only exists on a listening server. The Better Auth seam is
 * mocked, matching `test/authorization/test-app.ts`.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import type { AnyElysia } from 'elysia';
import { container } from 'tsyringe';
import { realtimeMessage } from '../../src/providers/realtime/realtime.message';
import {
	InProcessRealtimeHub,
	type IRealtimeHub,
	REALTIME_HUB_TOKEN,
} from '../../src/providers/realtime/realtime.hub';

const VALID_COOKIE = 'better-auth.session_token=valid';

mock.module('@providers/better-auth/auth', () => ({
	auth: {
		api: {
			async getSession({ headers }: { headers: Headers }) {
				if (!headers.get('cookie')?.includes('session_token=valid')) {
					return null;
				}
				return {
					user: { id: 'user-1', email: 'user-1@test.local', name: 'user-1' },
					session: { userId: 'user-1', activeOrganizationId: null },
				};
			},
		},
	},
}));

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

/** Opens a socket and resolves with the outcome, never rejecting. */
function open(cookie?: string): Promise<{ ok: boolean; socket?: WebSocket }> {
	return new Promise((resolve) => {
		const socket = new WebSocket(baseUrl, {
			headers: cookie ? { cookie } : undefined,
		} as never);
		socket.addEventListener('open', () => resolve({ ok: true, socket }));
		socket.addEventListener('error', () => resolve({ ok: false }));
		setTimeout(() => resolve({ ok: false }), 2000);
	});
}

describe('realtime gateway', () => {
	test('refuses the upgrade without a session cookie', async () => {
		const result = await open();

		expect(result.ok).toBe(false);
		expect(hub.connectionCount()).toBe(0);
	});

	test('opens with a session and registers the socket for that user', async () => {
		const result = await open(VALID_COOKIE);
		expect(result.ok).toBe(true);
		expect(hub.connectionCount('user-1')).toBe(1);
		result.socket?.close();
		await Bun.sleep(100);
	});

	test('a hub publish reaches the client with the envelope', async () => {
		const result = await open(VALID_COOKIE);
		expect(result.ok).toBe(true);

		const received = new Promise<string>((resolve) => {
			result.socket?.addEventListener('message', (event) =>
				resolve(String(event.data)),
			);
		});

		hub.publish(
			'user-1',
			realtimeMessage('notification.created', { id: 'n-1' }),
		);

		const frame = JSON.parse(await received);
		expect(frame).toMatchObject({
			type: 'notification.created',
			status: 'success',
			data: { id: 'n-1' },
		});
		expect(typeof frame.sentAt).toBe('number');

		result.socket?.close();
	});
});
