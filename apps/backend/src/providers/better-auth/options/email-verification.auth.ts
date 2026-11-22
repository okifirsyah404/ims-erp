import type { BetterAuthOptions } from 'better-auth';
import { dispatchMail } from '@providers/mailer/mailer.queue';
import { renderVerificationEmail } from '@providers/mailer/mailer.templates';
import { emailVerificationPolicy } from './email-verification-policy.auth';

type BetterAuthEmailVerificationOptions = NonNullable<
  BetterAuthOptions['emailVerification']
>;

/**
 * Email verification (sign-up, the web-admin "send verification email"
 * button on `/accounts`, and the new-address link of a change-email). Link
 * lifetime and sign-in behaviour live in {@link emailVerificationPolicy}.
 */
export const betterAuthEmailVerificationOptions: BetterAuthEmailVerificationOptions =
  {
    ...emailVerificationPolicy,
    sendVerificationEmail: async ({ user, url }) => {
      // Fire-and-forget: the queue outage must never fail sign-up. Delivery
      // errors are retried by BullMQ and surface as job failures, not here.
      try {
        await dispatchMail({
          to: user.email,
          ...(await renderVerificationEmail({ name: user.name, url })),
        });
      } catch (error) {
        console.error(
          '[email-verification] enqueue failed for user',
          user.id,
          error,
        );
      }
    },
  };
