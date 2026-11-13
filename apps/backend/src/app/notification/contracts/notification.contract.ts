import { z } from 'zod';
import type {
	NotificationChannel,
	NotificationStatus,
	TNotificationSelect,
} from '@drizzle/schemas/notification.schema';

/**
 * Request/response contracts for the notification REST surface (Phase 4) and
 * the realtime payload the worker publishes.
 *
 * @remarks
 * The wire shape is deliberately separate from the row: dates leave as ISO
 * strings so a WebSocket frame and an HTTP body describe a notification the
 * same way.
 */

/** Inbox listing query. `page`/`limit` are strings on the wire, coerced here. */
export const notificationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	/**
	 * `?unreadOnly=true`. An enum, not `z.coerce.boolean()`: coercion treats
	 * the string `"false"` as `true`.
	 */
	unreadOnly: z
		.enum(['true', 'false'])
		.optional()
		.transform((value) => value === 'true'),
});
export type TNotificationQuery = z.infer<typeof notificationQuerySchema>;

/** Path parameter for the single-notification routes. */
export const notificationIdParamsSchema = z.object({
	// `z.uuid()`, not `z.string().min(1)`: a malformed id would otherwise reach
	// Postgres and surface as a 500 instead of a validation error.
	id: z.uuid(),
});
export type TNotificationIdParams = z.infer<typeof notificationIdParamsSchema>;

/** One notification as the client receives it. */
export type TNotificationView = {
	id: string;
	templateCode: string;
	title: string;
	body: string | null;
	tags: string[];
	variables: Record<string, string> | null;
	metadata: Record<string, unknown> | null;
	channel: NotificationChannel;
	status: NotificationStatus;
	sentAt: string | null;
	readAt: string | null;
	sourceType: string | null;
	sourceId: string | null;
	createdAt: string;
};

/** Maps a stored row onto the wire shape. */
export function toNotificationView(row: TNotificationSelect): TNotificationView {
	return {
		id: row.id,
		templateCode: row.templateCode,
		title: row.title,
		body: row.body,
		tags: row.tags ?? [],
		variables: row.variables ?? null,
		metadata: row.metadata ?? null,
		channel: row.channel,
		status: row.status,
		sentAt: row.sentAt?.toISOString() ?? null,
		readAt: row.readAt?.toISOString() ?? null,
		sourceType: row.sourceType,
		sourceId: row.sourceId,
		createdAt: row.createdAt.toISOString(),
	};
}
