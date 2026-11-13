/**
 * The one frame shape every realtime feature sends (ADR-0016 decision 4).
 *
 * @remarks
 * The socket is shared by every feature, so a frame must be self-describing:
 * `type` names the event (`notification.created`, later `chat.message`) and
 * the client routes on its prefix. A new realtime feature adds a `type` and a
 * client handler — never a second socket, auth path, or reconnect loop.
 *
 * `status` is the delivery result of the frame itself, which is a different
 * thing from `data.status` (the domain status of the row inside `data`, e.g.
 * `sent` / `read`).
 */

/** Delivery result of the frame itself — never a domain status. */
export type TRealtimeStatus = 'success' | 'error';

export type TRealtimeMessage<TData = unknown> = {
	type: string;
	status: TRealtimeStatus;
	/** Unix milliseconds, matching the database convention. */
	sentAt: number;
	data: TData;
};

/**
 * Builds a frame, stamping `sentAt` at send time.
 *
 * @param type Event name, `<feature>.<event>`.
 * @param data Event payload.
 * @param status Frame result; `error` frames carry the message in `data`.
 */
export function realtimeMessage<TData>(
	type: string,
	data: TData,
	status: TRealtimeStatus = 'success',
): TRealtimeMessage<TData> {
	return { type, status, sentAt: Date.now(), data };
}
