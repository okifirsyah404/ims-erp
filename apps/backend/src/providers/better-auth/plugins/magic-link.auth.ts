import { magicLink } from 'better-auth/plugins/magic-link';
import { betterAuthLogger } from '../logger.auth.js';

export const betterAuthMagicLinkPlugin = magicLink({
  sendMagicLink: async ({ email, token, url, metadata }, ctx) => {
    betterAuthLogger.log(
      `Sending magic link to ${email} with token: ${token}, url: ${url}, metadata: ${JSON.stringify(
        metadata,
      )}`,
    );
  },
});
