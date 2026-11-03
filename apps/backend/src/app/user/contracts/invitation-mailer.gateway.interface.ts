/**
 * Shape of the invite email input handed to the mailer port.
 */
export type TInviteEmailPayload = {
	to: string;
	name: string | null;
	/** Raw single-use token; only ever lives in the email body/link. */
	token: string;
	organizationName: string | null;
	roleName: string | null;
	expiresAt: Date;
};

/**
 * Outbound mailer port. Logger-backed in development; SMTP drops in later
 * without touching callers. Must never throw into the invitation flow —
 * implementations report failures via `deliveryFailed` handling upstream.
 */
export interface IInvitationMailer {
	sendInvite(payload: TInviteEmailPayload): Promise<void>;
}
