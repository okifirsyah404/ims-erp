/**
 * Client for the single realtime socket (`GET /ws`, ADR-0016 decision 4).
 *
 * @remarks
 * One socket per authenticated shell, for every realtime feature: frames are
 * routed by `type` through the handler registry, so a new feature adds a
 * handler and never a second socket, auth path, or reconnect loop.
 *
 * Reconnects with exponential backoff. `onerror` is deliberately not wired:
 * a browser error event is always followed by `close`, and reconnecting from
 * both would double every retry.
 */

/** Delivery result of the frame itself, mirroring the backend envelope. */
export type TRealtimeStatus = 'success' | 'error';

export type TRealtimeFrame<TData = unknown> = {
	type: string;
	status: TRealtimeStatus;
	/** Unix milliseconds, matching the database convention. */
	sentAt: number;
	data: TData;
};

export type TConnectionStatus = 'connecting' | 'open' | 'closed';

export type TRealtimeHandler = (frame: TRealtimeFrame) => void;

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * Backoff for retry `attempt` (1-based): 1s, 2s, 4s … capped at 30s.
 *
 * @remarks
 * Capped, not jittered: a single-instance deployment reconnects a handful of
 * browsers, and a deterministic delay is what the test can assert.
 */
export function reconnectDelayMs(attempt: number): number {
	return Math.min(INITIAL_RETRY_MS * 2 ** Math.max(0, attempt - 1), MAX_RETRY_MS);
}

/** `http://host:3001` → `ws://host:3001/ws` (and `https` → `wss`). */
export function realtimeUrl(apiUrl: string): string {
	const url = new URL('/ws', apiUrl);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.toString();
}

export type TRealtimeClientOptions = {
	url: string;
	/** Exact `type` → handler. An unknown frame is ignored, not fatal. */
	handlers: Record<string, TRealtimeHandler>;
	onStatus?: (status: TConnectionStatus) => void;
	/** Runs after every successful (re)connect, e.g. to refetch missed data. */
	onOpen?: () => void;
};

export type TRealtimeClient = {
	connect: () => void;
	close: () => void;
};

/** Builds a reconnecting client. Nothing connects until {@link TRealtimeClient.connect}. */
export function createRealtimeClient(
	options: TRealtimeClientOptions,
): TRealtimeClient {
	let socket: WebSocket | null = null;
	let attempt = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let closed = false;

	const setStatus = (status: TConnectionStatus) => options.onStatus?.(status);

	function scheduleReconnect() {
		if (closed) return;
		attempt += 1;
		timer = setTimeout(open, reconnectDelayMs(attempt));
	}

	function open() {
		if (closed) return;
		timer = undefined;
		setStatus('connecting');
		socket = new WebSocket(options.url);

		socket.onopen = () => {
			attempt = 0;
			setStatus('open');
			options.onOpen?.();
		};

		socket.onmessage = (event) => {
			let frame: TRealtimeFrame;
			try {
				frame = JSON.parse(String(event.data)) as TRealtimeFrame;
			} catch {
				return; // a malformed frame is not worth dropping the socket
			}
			if (typeof frame?.type !== 'string') return;
			options.handlers[frame.type]?.(frame);
		};

		socket.onclose = () => {
			socket = null;
			setStatus('closed');
			scheduleReconnect();
		};
	}

	return {
		connect() {
			closed = false;
			attempt = 0;
			open();
		},
		close() {
			closed = true;
			if (timer !== undefined) clearTimeout(timer);
			timer = undefined;
			socket?.close();
			socket = null;
			setStatus('closed');
		},
	};
}
