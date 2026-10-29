import type { BetterAuthOptions } from 'better-auth';
import { betterAuthLogger } from '../logger.auth.js';

type BetterAuthEmailVerificationOptions = NonNullable<
  BetterAuthOptions['emailVerification']
>;

export const betterAuthEmailVerificationOptions: BetterAuthEmailVerificationOptions =
  {
    sendVerificationEmail: async ({ user, url }) => {
      betterAuthLogger.log(
        `Sending verification email to ${user.email} with URL: ${url}`,
      );
    },
  };
