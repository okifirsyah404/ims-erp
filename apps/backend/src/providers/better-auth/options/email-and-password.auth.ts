import type { BetterAuthOptions } from 'better-auth';
import { dispatchMail } from '@providers/mailer/mailer.queue';
import { renderResetPasswordEmail } from '@providers/mailer/mailer.templates';

type BetterAuthEmailAndPasswordOptions = NonNullable<
  BetterAuthOptions['emailAndPassword']
>;

export const betterAuthEmailAndPasswordOptions: BetterAuthEmailAndPasswordOptions =
  {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Reset tokens live 1 hour; the reset link URL points at the web-admin
    // /reset-password route which extracts the token and calls resetPassword.
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      // Fire-and-forget: the queue outage must never fail the reset flow.
      // Delivery errors are retried by BullMQ and surface as job failures.
      try {
        await dispatchMail({
          to: user.email,
          ...renderResetPasswordEmail({ name: user.name, url }),
        });
      } catch (error) {
        console.error(
          '[reset-password] enqueue failed for user',
          user.id,
          error,
        );
      }
    },
  };
