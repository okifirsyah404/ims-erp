import type { BetterAuthOptions } from 'better-auth';
import { betterAuthLogger } from '../logger.auth.js';

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
    // TODO: replace with a real mailer (Resend/Nodemailer/…). For now the
    // reset URL is logged so the flow can be exercised in development.
    sendResetPassword: async ({ user, url }) => {
      betterAuthLogger.log(
        `Sending reset password email to ${user.email} with URL: ${url}`,
      );
    },
  };
