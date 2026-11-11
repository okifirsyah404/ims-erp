import {
	renderAppInvitationEmail,
	renderOrganizationInvitationEmail,
} from '@providers/mailer/mailer.templates';
import { dispatchMail } from '@providers/mailer/mailer.queue';
import { pinoLogger } from '@providers/logger/logger';
import { DateTime } from 'luxon';
import type {
	IInvitationMailer,
	TInviteEmailPayload,
} from '../contracts/invitation-mailer.gateway.interface';

/**
 * Queue-backed mailer port implementation. Selects the template by
 * invitation kind: `type: 'app'` renders the app-invitation email, `type:
 * 'org'` the organization-invitation email (organization/role/expiry).
 *
 * Renders through `@ims-erp/react-email` and enqueues on the shared mail
 * queue. When no transport is configured (`isMailEnabled() === false`) the
 * payload is logged and dropped by the queue, mirroring dev/test behavior —
 * including the raw claim token for recoverability (locked decision D11).
 */
export class QueueInvitationMailer implements IInvitationMailer {
	async sendInvite(payload: TInviteEmailPayload): Promise<void> {
		const { url: appUrl, webUrl, name: appName } = (
			await import('@config/providers/config')
		).appConfig.app;
		// The claim page lives in the admin web app, not on the API — point
		// the link there (falls back to APP_URL for single-origin deploys).
		const claimUrl = `${webUrl ?? appUrl ?? ''}/invite/${payload.token}`;
		const expiresAt = DateTime.fromJSDate(payload.expiresAt)
			.setZone('utc')
			.toLocaleString(DateTime.DATETIME_MED);

		try {
			const rendered =
				payload.type === 'org'
					? await renderOrganizationInvitationEmail({
							name: payload.name,
							url: claimUrl,
							organizationName: payload.organizationName ?? appName ?? 'ERP',
							roleName: payload.roleName ?? 'member',
							expiresAt,
						})
					: await renderAppInvitationEmail({
							name: payload.name,
							url: claimUrl,
						});

			await dispatchMail({ to: payload.to, ...rendered });
		} catch (error) {
			pinoLogger.warn(
				{ err: error, to: payload.to, claimUrl, token: payload.token },
				'[invitation-mailer] enqueue failed — link recoverable from this log',
			);
		}
	}
}
