import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { ok, okPaginated } from '@http/response';
import {
	notificationIdParamsSchema,
	notificationQuerySchema,
} from '../contracts/notification.contract';
import { NOTIFICATION_SERVICE_TOKEN } from '../constants/di';
import type { NotificationService } from '../services/notification.service';

/**
 * The caller's own inbox over HTTP.
 *
 * @remarks
 * App-scope, so the plugin rides `sessionGuard` only — no `erp` macro and no
 * `x-organization-id` (D13). A user reads their notifications from every
 * organization they belong to, and a fresh login has no active organization
 * yet, which `erpGuard` would reject with 403.
 *
 * The caller's id always comes from the guard-resolved session, never from a
 * path or body field. There is no endpoint that reads another user's inbox, so
 * ownership cannot be widened by a request.
 *
 * @throws 400 When the query or the id is malformed
 * @throws 401 When unauthenticated
 * @throws 404 When the id is not the caller's (never 403 — see the module doc)
 */
export class NotificationController {
	/**
	 * Builds the Elysia plugin mounting the four inbox routes.
	 *
	 * @returns An Elysia instance with `/pushNotifications` mounted
	 */
	static plugin() {
		const service = container.resolve<NotificationService>(
			NOTIFICATION_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'notifications',
			prefix: '/notifications',
			tags: ['Notification'],
			guards: 'session',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await service.list(
							erp.session.user.id,
							notificationQuerySchema.parse(query),
						),
					),
				{
					erpSession: { session: true },
					detail: {
						description:
							"The caller's notifications, newest first. `unreadOnly=true` excludes rows already read.",
					},
				},
			)
			// Declared before `/:id/...`: a static segment must win over a
			// parameter, and Elysia's router only guarantees that when the
			// static route is registered first.
			.get(
				'/unread-count',
				async ({ erp }) => ok({ count: await service.unreadCount(erp.session.user.id) }),
				{ erpSession: { session: true } },
			)
			.patch(
				'/:id/read',
				async ({ params, erp }) =>
					ok(await service.markRead(params.id, erp.session.user.id)),
				{ erpSession: { session: true }, params: notificationIdParamsSchema },
			)
			.post(
				'/read-all',
				async ({ erp }) => {
					const changed = await service.markAllRead(erp.session.user.id);
					return ok({ changed });
				},
				{ erpSession: { session: true } },
			);
	}
}
