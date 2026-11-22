import type { BetterAuthOptions } from 'better-auth';

type BetterAuthChangeEmailOptions = NonNullable<
	NonNullable<BetterAuthOptions['user']>['changeEmail']
>;

/**
 * Self-service email change (`POST /api/auth/change-email`, ERP-0109).
 *
 * @remarks
 * Better Auth refuses every change-email call unless `enabled` is set, which
 * left the web-admin email form permanently failing before this option
 * existed. The new address is always verified first: a link goes to the new
 * inbox through `emailVerification.sendVerificationEmail`, and the stored
 * email only changes when that link is opened. There is deliberately no
 * confirmation step on the old address (`sendChangeEmailConfirmation` unset,
 * owner decision 2026-11-21) and no unverified shortcut
 * (`updateEmailWithoutVerification` unset).
 */
export const betterAuthChangeEmailOptions: BetterAuthChangeEmailOptions = {
	enabled: true,
};
