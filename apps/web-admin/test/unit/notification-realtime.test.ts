import { describe, expect, test } from 'bun:test';

import {
	notificationKeys,
	notificationRealtimeHandlers,
} from '../../src/lib/notification-api';
import { queryClient } from '../../src/lib/query-client';

/**
 * The `unread_count` frame is the only one written straight into the cache
 * (the others invalidate). A wrong key here would leave a stale badge with no
 * error anywhere, so it is pinned.
 */
describe('notification realtime handlers', () => {
	test('notification.unread_count writes the server count into the badge cache', () => {
		notificationRealtimeHandlers['notification.unread_count']!({
			type: 'notification.unread_count',
			status: 'success',
			sentAt: Date.now(),
			data: { count: 7 },
		});
		expect(queryClient.getQueryData(notificationKeys.unreadCount)).toBe(7);
	});

	test('a malformed frame is ignored instead of clearing the badge', () => {
		queryClient.setQueryData(notificationKeys.unreadCount, 4);
		notificationRealtimeHandlers['notification.unread_count']!({
			type: 'notification.unread_count',
			status: 'error',
			sentAt: Date.now(),
			data: null,
		});
		expect(queryClient.getQueryData(notificationKeys.unreadCount)).toBe(4);
	});
});
