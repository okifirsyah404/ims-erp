import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import type { BetterAuthOptions } from 'better-auth';
import { avatarUserCreateHook } from '../../app/user/queues/avatar.queue';
import { appConfig } from '../../../config/providers/config.js';
import { drizzleDB } from '../../../drizzle/db.js';
import {
	accounts,
	apikeys,
	invitations,
	members,
	organizations,
	passkeys,
	sessions,
	users,
	verifications,
} from '../../../drizzle/schemas/auth.schema';
import { betterAuthEmailAndPasswordOptions } from './options/email-and-password.auth.js';
import { betterAuthEmailVerificationOptions } from './options/email-verification.auth.js';
import { betterAuthSecondaryStorage } from './options/secondary-storage.auth.js';
import { betterAuthTrustedOrigins } from './options/social-providers.auth.js';
import { sessionAutoActivateOrganizationHook } from './options/session.auth.js';
import { betterAuthPlugins } from './plugin.auth.js';

export const betterAuthOptions = {
	baseURL: appConfig.app.url!,
	secret: appConfig.app.secret,
	database: drizzleAdapter(drizzleDB, {
		provider: 'pg',
		schemaName: 'auth',
		usePlural: true,
		// Explicitly list auth tables: drizzle() is configured with relations
		// only, so db._.fullSchema misses tables without relations (apikeys),
		// which makes Better Auth's runtime schema check report a false
		// "missing table" error at startup. Keys must match the expected DB
		// table names (plural, since usePlural is set).
		schema: {
			users,
			sessions,
			accounts,
			verifications,
			organizations,
			members,
			invitations,
			passkeys,
			apikeys,
		},
	}) as BetterAuthOptions['database'],
	user: {
		additionalFields: {
			bio: {
				type: 'string' as const,
				required: false,
			},
			// Soft-delete marker owned by the user module's repository (sets the
			// column directly via Drizzle). `input: false` keeps it out of every
			// Better Auth API surface; ban columns remain the Better Auth-owned
			// status mechanism. NOTE: codegen emits a `timestamp` column, not the
			// project's unix-ms custom type - deliberate deviation, Better Auth
			// owns this file's shape.
			deletedAt: {
				type: 'date' as const,
				required: false,
				input: false,
				defaultValue: null,
			},
		},
	},
	emailAndPassword: betterAuthEmailAndPasswordOptions,
	emailVerification: betterAuthEmailVerificationOptions,
	databaseHooks: {
		user: {
			// Fire-and-forget avatar generation on every user creation
			// (sign-up, OAuth, admin-created). Never fails user creation.
			create: { after: avatarUserCreateHook() },
		},
		session: {
			// Auto-activate the user's first organization membership on login
			// (see the hook's docstring) so fresh sessions resolve an ERP
			// organization context immediately.
			create: { before: sessionAutoActivateOrganizationHook },
		},
	},
	plugins: betterAuthPlugins,
	trustedOrigins: betterAuthTrustedOrigins,
	// Sessions live in Redis (secondary storage); the database is NOT used for
	// session persistence (Redis-only per architecture decision). The 5-minute
	// cookie cache avoids a storage round-trip on every request.
	secondaryStorage: betterAuthSecondaryStorage,
	session: {
		storeSessionInDatabase: false,
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // seconds
		},
	},
};
