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
    sendResetPassword: async ({ user, url }) => {
      betterAuthLogger.log(
        `Sending reset password email to ${user.email} with URL: ${url}`,
      );
    },
  };
