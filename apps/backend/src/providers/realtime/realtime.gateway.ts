/**
 * The single realtime socket: `GET /ws` (ADR-0016 decision 4).
 *
 * @remarks
 * One socket for the whole application. A new realtime feature adds a `type`
 * to the frame envelope and a client-side handler — it never adds a socket,
 * an auth path, or a reconnect loop.
 *
 * Authentication happens at upgrade time, not on the first message: the
 * Better Auth session cookie is presented with the upgrade request, and a
 * request without a session is refused before any socket exists. There is no
 * unauthenticated socket that could later "log in".
 *
 * Elysia 1.4 registers the socket with `.ws()` directly; `Bun.serve` receives
 * Elysia's own websocket handler through the adapter, so no `websocket()`
 * plugin is mounted here (there is no such export — `elysia/ws` exports the
 * handler object, not a factory).
 */
import { auth } from '@providers/better-auth/auth';
import Elysia from 'elysia';
import { container } from 'tsyringe';
import {
	type IRealtimeHub,
	REALTIME_HUB_TOKEN,
} from './realtime.hub';

/** Thrown when the upgrade request carries no valid session. */
export class RealtimeAuthError extends Error {
	constructor(readonly status: 401, message: string) {
		super(message);
		this.name = 'RealtimeAuthError';
	}
}

/**
 * Builds the gateway plugin.
 *
 * @remarks
 * The hub is resolved at plugin construction, like `erpGuard` resolves its
 * permission resolver: the container is populated by `registerProvider` before
 * `createApp()` runs, and resolving per connection would only repeat the same
 * lookup.
 *
 * `message` is intentionally absent: the client→server direction has no
 * protocol yet. Bun still answers pings, and an unsolicited client frame is
 * ignored rather than fatal. Phase 4/7 add request/response only if a feature
 * needs it.
 */
export function realtimeGateway() {
	const hub = container.resolve<IRealtimeHub>(REALTIME_HUB_TOKEN);

	return new Elysia({ name: 'realtime-gateway' })
		.error({ RealtimeAuthError })
		.onError({ as: 'local' }, ({ code, error, set }) => {
			if (code === 'RealtimeAuthError') {
				set.status = error.status;
				return {
					requestId: crypto.randomUUID(),
					status: error.status,
					message: error.message,
					timestamp: Date.now(),
					data: null,
					errors: [{ message: error.message }],
				};
			}
			return undefined;
		})
		// Runs before the upgrade, so its return value lands on `ws.data`:
		// `open`/`close` need the user id without re-querying Better Auth.
		.resolve({ as: 'local' }, async ({ request }) => {
			const session = await auth.api.getSession({
				headers: request.headers,
			});
			if (!session) {
				throw new RealtimeAuthError(401, 'Authentication required');
			}
			return { realtimeUserId: session.user.id };
		})
		.ws('/ws', {
			open(ws) {
				hub.register(ws.id, ws.data.realtimeUserId, ws);
			},
			close(ws) {
				hub.unregister(ws.id);
			},
		});
}
