/**
 * Better Auth plugin that lets `/sign-in/username` accept an email address
 * as the identifier, so the login form needs a single "email or username"
 * field.
 *
 * A `before` hook (the same extension point the username plugin itself
 * uses) rewrites the body when the identifier contains `@`:
 * the user is looked up by email and `body.username` is replaced with that
 * user's actual username. Everything else — username lookup, password
 * verification, session creation, i18n error messages — stays in Better
 * Auth's `signInUsername` endpoint, so there is no duplicated credential
 * logic and unknown emails still fail with the standard
 * `INVALID_USERNAME_OR_PASSWORD` error (never enumerating accounts).
 *
 * Must be registered AFTER the username plugin (hook order follows plugin
 * order and this hook only rewrites, it never validates usernames itself).
 */
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';

export const betterAuthEmailIdentifierPlugin = {
	id: 'email-identifier',
	hooks: {
		before: [
			{
				matcher(context) {
					return context.path === '/sign-in/username';
				},
				handler: createAuthMiddleware(async (ctx) => {
					const identifier = ctx.body.username;
					if (
						typeof identifier !== 'string' ||
						!identifier.includes('@')
					) {
						// Plain username — nothing to rewrite.
						return;
					}

					// Email lookup is case-insensitive; emails are stored lowercased
					// by Better Auth's email-and-password options.
					const user = await ctx.context.adapter.findOne<{ username: string | null }>({
						model: 'user',
						where: [{ field: 'email', value: identifier.toLowerCase() }],
					});
					if (!user) {
						// Leave the body as-is: the endpoint fails with the standard
						// invalid-credentials error, identical for unknown usernames.
						return;
					}

					// Rewrite to the stored username so the endpoint's own lookup
					// (which applies its normalizer) resolves the account.
					ctx.body.username = user.username ?? identifier;
				}),
			},
		],
	},
} satisfies BetterAuthPlugin;
