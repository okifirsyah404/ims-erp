import { betterAuth } from 'better-auth';
import { betterAuthOptions } from './auth.options.js';

export const auth = betterAuth({
  ...betterAuthOptions,
  hooks: {},
});
