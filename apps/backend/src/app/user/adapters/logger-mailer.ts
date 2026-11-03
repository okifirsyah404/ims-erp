import { pinoLogger } from '@providers/logger/logger';
import type {
	IInvitationMailer,
	TInviteEmailPayload,
} from '../contracts/invitation-mailer.gateway.interface';

/**
 * Logger-backed mailer port implementation. Development stand-in for the
 * future SMTP delivery: invitation emails (including the raw claim token
 * and link) are written to the application log so the flow is testable
 * end-to-end today. The claim link shape mirrors the planned web route:
 * `${appUrl}/invite/${token}`.
 */
export class LoggerInvitationMailer implements IInvitationMailer {
	async sendInvite(payload: TInviteEmailPayload): Promise<void> {
		const { url: appUrl } = (
			await import('@config/providers/config')
		).appConfig.app;
		pinoLogger.info(
			{
				to: payload.to,
				name: payload.name,
				organization: payload.organizationName,
				role: payload.roleName,
				expiresAt: payload.expiresAt.toISOString(),
				claimUrl: `${appUrl ?? ''}/invite/${payload.token}`,
				// Dev convenience: the raw token is only recoverable from logs
				// while SMTP is not configured (locked decision D11).
				token: payload.token,
			},
			'[invitation-mailer] invite email (logger transport)',
		);
	}
}
