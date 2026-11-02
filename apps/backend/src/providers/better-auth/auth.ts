import { betterAuth } from 'better-auth';
import { betterAuthHooks } from './ac/auth-hooks';
import { betterAuthOptions } from './auth.options.js';
import { betterAuthSocialProviders } from './options/social-providers.auth.js';

export const auth = betterAuth({
  ...betterAuthOptions,
  socialProviders: betterAuthSocialProviders,
  hooks: betterAuthHooks(),
});
