/**
 * Domain errors surfaced by the notification service.
 *
 * @remarks
 * A notification that belongs to another user is reported as **not found**,
 * never forbidden: the caller must not learn that the id exists (D13 context —
 * the surface is app-scope and cross-user access is indistinguishable from a
 * missing row).
 */
import { AppError } from '@http/errors';

/** No notification with that id belongs to the caller. */
export class NotificationNotFoundError extends AppError {
	constructor() {
		super(404, 'notification.notFound', 'Notification not found');
	}
}
