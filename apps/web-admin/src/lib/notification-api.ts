import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { API_URL } from './api-url';
import { queryClient } from './query-client';
import type { TRealtimeFrame } from './realtime/realtime-client';

/**
 * The caller's notification inbox (ERP-0047 Phase 7).
 *
 * @remarks
 * Mirrors the backend's `TNotificationView`: the wire shape, not the row.
 * Server data is owned by TanStack Query (D9); the realtime client only
 * invalidates these keys, so there is no second copy of the list in a store.
 */

/** Channels the backend can carry; only `in_app` is produced today. */
export type TNotificationChannel = 'email' | 'whatsapp' | 'in_app' | 'webhook';

export type TNotificationStatus =
	| 'queued'
	| 'sending'
	| 'sent'
	| 'delivered'
	| 'read'
	| 'failed'
	| 'cancelled';

export type TNotification = {
	id: string;
	templateCode: string;
	title: string;
	body: string | null;
	tags: string[];
	variables: Record<string, string> | null;
	metadata: Record<string, unknown> | null;
	channel: TNotificationChannel;
	status: TNotificationStatus;
	sentAt: string | null;
	readAt: string | null;
	sourceType: string | null;
	sourceId: string | null;
	createdAt: string;
};

/** How many rows the bell shows; the popover is a preview, not a paged list. */
const LIST_LIMIT = 20;

export const notificationKeys = {
	list: ['notifications', 'list'] as const,
	unreadCount: ['notifications', 'unread-count'] as const,
};

function failureMessage(envelope: TApiResponse<unknown>): string {
	return (
		envelope.errors?.[0]?.message ?? envelope.message ?? 'Notification request failed'
	);
}

async function fetchNotifications(): Promise<TNotification[]> {
	const response = await fetch(
		`${API_URL}/notifications?page=1&limit=${LIST_LIMIT}`,
		{ credentials: 'include' },
	);
	const envelope = (await response.json()) as TApiPaginatedResponse<TNotification>;
	if (!response.ok) throw new Error(failureMessage(envelope));
	return envelope.data;
}

async function fetchUnreadCount(): Promise<number> {
	const response = await fetch(`${API_URL}/notifications/unread-count`, {
		credentials: 'include',
	});
	const envelope = (await response.json()) as TApiResponse<{ count: number }>;
	if (!response.ok || !envelope.data) throw new Error(failureMessage(envelope));
	return envelope.data.count;
}

/** Inbox, newest first. */
export const notificationsQueryOptions = queryOptions({
	queryKey: notificationKeys.list,
	queryFn: fetchNotifications,
	staleTime: 30_000,
});

/** Badge count, cheap enough to refetch on every realtime event. */
export const unreadCountQueryOptions = queryOptions({
	queryKey: notificationKeys.unreadCount,
	queryFn: fetchUnreadCount,
	staleTime: 30_000,
});

/** Marks one notification read. Returns the updated row. */
export async function markNotificationRead(id: string): Promise<TNotification> {
	const response = await fetch(`${API_URL}/notifications/${id}/read`, {
		method: 'PATCH',
		credentials: 'include',
	});
	const envelope = (await response.json()) as TApiResponse<TNotification>;
	if (!response.ok || !envelope.data) throw new Error(failureMessage(envelope));
	return envelope.data;
}

/** Marks every unread notification of the caller read. */
export async function markAllNotificationsRead(): Promise<number> {
	const response = await fetch(`${API_URL}/notifications/read-all`, {
		method: 'POST',
		credentials: 'include',
	});
	const envelope = (await response.json()) as TApiResponse<{ changed: number }>;
	if (!response.ok || !envelope.data) throw new Error(failureMessage(envelope));
	return envelope.data.changed;
}

/** Refetches the inbox and the badge (mark-read, and every socket event). */
export function refreshNotifications(): Promise<void> {
	return Promise.all([
		queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
		queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount }),
	]).then(() => undefined);
}

/**
 * Socket handlers for this feature, registered by the shared realtime client.
 *
 * @remarks
 * `notification.created` could patch the cache directly, but the worker
 * writes the row and the badge is derived from the server's own count: an
 * invalidation is one cheap request and keeps the two views consistent.
 * `notification.unread_count` is the exception — it already carries the
 * number, so it is written straight into the cache.
 */
export const notificationRealtimeHandlers: Record<
	string,
	(frame: TRealtimeFrame) => void
> = {
	'notification.created': () => {
		void refreshNotifications();
	},
	'notification.updated': () => {
		void refreshNotifications();
	},
	'notification.unread_count': (frame) => {
		const data = frame.data as { count?: number } | null;
		if (typeof data?.count === 'number') {
			queryClient.setQueryData(notificationKeys.unreadCount, data.count);
		}
	},
};
