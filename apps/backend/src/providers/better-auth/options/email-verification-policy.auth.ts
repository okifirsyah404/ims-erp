/** Verification links live one hour (seconds, Better Auth unit). */
export const EMAIL_VERIFICATION_EXPIRES_IN_SECONDS = 3600;

/**
 * Side-effect-free part of the email-verification options (ERP-0111), kept
 * apart from the sender so it can be unit-tested without the mail queue.
 *
 * @remarks
 * `autoSignInAfterVerification` stays off: the web-admin flow starts from an
 * already signed-in user, and a link opened in another browser must not mint
 * a session there. Verification is not required to sign in
 * (`emailAndPassword.requireEmailVerification` unset, owner decision
 * 2026-11-21).
 */
export const emailVerificationPolicy = {
	expiresIn: EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
	autoSignInAfterVerification: false,
} as const;
