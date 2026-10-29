import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import type { BetterAuthOptions } from 'better-auth';
import { appConfig } from '../../../config/providers/config.js';
import { drizzleDB } from '../../../drizzle/db.js';
import { betterAuthEmailAndPasswordOptions } from './options/email-and-password.auth.js';
import { betterAuthEmailVerificationOptions } from './options/email-verification.auth.js';
import { betterAuthPlugins } from './plugin.auth.js';

export const betterAuthOptions = {
	baseURL: appConfig.app.url!,
	secret: appConfig.app.secret,
	database: drizzleAdapter(drizzleDB, {
		provider: 'pg',
		schemaName: 'auth',
		usePlural: true,
	}) as BetterAuthOptions['database'],
	user: {
		additionalFields: {
			bio: {
				type: 'string' as const,
				required: false,
			},
		},
	},
	emailAndPassword: betterAuthEmailAndPasswordOptions,
	emailVerification: betterAuthEmailVerificationOptions,
	plugins: betterAuthPlugins,
};
