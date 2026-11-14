import { dispatchMail } from '@providers/mailer/mailer.queue';
import { renderPortalInvitationEmail, renderResetPasswordEmail } from '@providers/mailer/mailer.templates';
import type { IPortalMailer } from '../contracts/portal-account.contract';

/**
 * Queue-backed {@link IPortalMailer} (ERP-0022). Both emails point at the
 * customer portal's `/reset-password?token=…` page; the link is never logged
 * here (the shared mail queue logs and drops mail only when no transport is
 * configured, as in development).
 */
export class QueuePortalMailer implements IPortalMailer {
	async sendInvitation(input: { to: string; name: string; url: string }): Promise<void> {
		await dispatchMail({ to: input.to, ...(await renderPortalInvitationEmail({ name: input.name, url: input.url })) });
	}

	async sendPasswordReset(input: { to: string; name: string; url: string }): Promise<void> {
		await dispatchMail({ to: input.to, ...(await renderResetPasswordEmail({ name: input.name, url: input.url })) });
	}
}
