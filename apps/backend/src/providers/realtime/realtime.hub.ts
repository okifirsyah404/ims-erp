/**
 * In-process fanout for the single realtime socket (ADR-0016 decision 5).
 *
 * @remarks
 * The hub maps a user to the sockets currently open for that user (a user may
 * have several tabs), and `publish` writes the frame to each of them. It is
 * deliberately in-process: the BullMQ worker runs in the same Bun process as
 * the HTTP server (`src/index.ts` -> `startWorkers`), so the worker can publish
 * directly without a broker.
 *
 * **Redis pub/sub is the documented next step**, required only when the API
 * runs as more than one instance: each instance would then hold a different
 * subset of the sockets, and `publish` would have to go through Redis so every
 * instance can deliver to its own connections. The interface below is already
 * the right shape for that — only the implementation changes.
 *
 * The hub never throws into a caller: a producer calling `publish` during a
 * closed socket or a dropped connection must not fail a business write.
 */
import type { InjectionToken } from 'tsyringe';
import type { TRealtimeMessage } from './realtime.message';

/**
 * The slice of `ElysiaWS` the hub needs.
 *
 * @remarks
 * Structural, not the concrete class: tests pass a stub, and the hub must not
 * depend on Elysia's websocket adapter types.
 */
export type TRealtimeSocket = {
	/** Sends one already-serialized frame. */
	send(payload: string): unknown;
};

export interface IRealtimeHub {
	/**
	 * Tracks an open socket for a user.
	 *
	 * @param wsId Stable per-connection id (Elysia assigns one).
	 * @param userId The authenticated session's user.
	 * @param socket The connection to write to.
	 */
	register(wsId: string, userId: string, socket: TRealtimeSocket): void;
	/** Forgets a closed connection. Safe for an unknown id. */
	unregister(wsId: string): void;
	/**
	 * Sends a frame to every open socket of one user.
	 *
	 * @returns How many sockets accepted the frame (0 when the user is offline).
	 */
	publish(userId: string, message: TRealtimeMessage): number;
	/** Open connection count for a user; used by tests and health checks. */
	connectionCount(userId?: string): number;
}

export const REALTIME_HUB_TOKEN: InjectionToken<IRealtimeHub> =
	Symbol('REALTIME_HUB');

type TConnection = {
	userId: string;
	socket: TRealtimeSocket;
};

/**
 * Process-local hub.
 *
 * @remarks
 * Two maps, not one: `byWsId` answers "who owns this socket" on close, and
 * `byUserId` answers "where does this user's frame go" on publish. Keeping
 * only one of them would make the other operation a full scan.
 */
export class InProcessRealtimeHub implements IRealtimeHub {
	private readonly byWsId = new Map<string, TConnection>();
	private readonly byUserId = new Map<string, Map<string, TRealtimeSocket>>();

	register(wsId: string, userId: string, socket: TRealtimeSocket): void {
		this.byWsId.set(wsId, { userId, socket });

		const sockets = this.byUserId.get(userId) ?? new Map();
		sockets.set(wsId, socket);
		this.byUserId.set(userId, sockets);
	}

	unregister(wsId: string): void {
		const connection = this.byWsId.get(wsId);
		if (!connection) return;

		this.byWsId.delete(wsId);

		const sockets = this.byUserId.get(connection.userId);
		if (!sockets) return;
		sockets.delete(wsId);
		if (sockets.size === 0) this.byUserId.delete(connection.userId);
	}

	publish(userId: string, message: TRealtimeMessage): number {
		const sockets = this.byUserId.get(userId);
		if (!sockets || sockets.size === 0) return 0;

		// Serialized once, not per socket: the frame is identical for every tab
		// and a user with three tabs should not pay three stringifies.
		const payload = JSON.stringify(message);

		let delivered = 0;
		for (const [wsId, socket] of sockets) {
			try {
				socket.send(payload);
				delivered += 1;
			} catch {
				// A socket that cannot be written to is already gone; the close
				// handler may not have run yet. Drop it here so the next publish
				// does not retry it.
				this.unregister(wsId);
			}
		}

		return delivered;
	}

	connectionCount(userId?: string): number {
		if (userId !== undefined) return this.byUserId.get(userId)?.size ?? 0;
		return this.byWsId.size;
	}
}
