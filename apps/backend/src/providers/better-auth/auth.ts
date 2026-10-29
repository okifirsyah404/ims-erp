import { betterAuth } from 'better-auth';
import { betterAuthHooks } from './ac/auth-hooks';
import { betterAuthOptions } from './auth.options.js';

export const auth = betterAuth({
  ...betterAuthOptions,
  hooks: betterAuthHooks(),
});
