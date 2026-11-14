import { useEffect } from 'react';
import { API_URL } from '../api-url';
import {
	notificationRealtimeHandlers,
	refreshNotifications,
} from '../notification-api';
import { createRealtimeClient, realtimeUrl } from './realtime-client';
import { useRealtimeStore } from './realtime-store';

/**
 * Mounts the single realtime socket for the authenticated shell.
 *
 * @remarks
 * Called once by `MainLayout`, so exactly one socket exists per session and it
 * dies with the shell (sign-out unmounts the layout). `onOpen` refetches the
 * inbox: frames sent while the socket was down are not replayed, so a
 * reconnect has to reconcile with the server instead of assuming it missed
 * nothing.
 */
export function useRealtime(): void {
	const setStatus = useRealtimeStore((state) => state.setStatus);

	useEffect(() => {
		const client = createRealtimeClient({
			url: realtimeUrl(API_URL),
			handlers: notificationRealtimeHandlers,
			onStatus: setStatus,
			onOpen: refreshNotifications,
		});
		client.connect();
		return () => client.close();
	}, [setStatus]);
}
