import type { BetterAuthOptions } from 'better-auth';
import { dispatchMail } from '@providers/mailer/mailer.queue';
import { renderVerificationEmail } from '@providers/mailer/mailer.templates';

type BetterAuthEmailVerificationOptions = NonNullable<
  BetterAuthOptions['emailVerification']
>;

export const betterAuthEmailVerificationOptions: BetterAuthEmailVerificationOptions =
  {
    sendVerificationEmail: async ({ user, url }) => {
      // Fire-and-forget: the queue outage must never fail sign-up. Delivery
      // errors are retried by BullMQ and surface as job failures, not here.
      try {
        await dispatchMail({
          to: user.email,
          ...renderVerificationEmail({ name: user.name, url }),
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
