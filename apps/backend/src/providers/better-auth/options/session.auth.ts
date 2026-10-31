import type { BetterAuthOptions } from 'better-auth';
import { drizzleDB } from '../../../../drizzle/db';
import { members } from '../../../../drizzle/schemas/auth.schema';
import { asc, eq } from 'drizzle-orm';

/**
 * Auto-activates the user's first organization membership on session
 * creation.
 *
 * @remarks
 * The ERP guard resolves the organization context from the session's
 * `activeOrganizationId` (falling back to the `x-organization-id` header).
 * Without this hook a fresh login has NO active organization, so every
 * first-party `/organizations*` route (and the sidebar's permission checks)
 * 403s until the user manually switches — the dashboard's identity and
 * organization panels appear empty. The deployment runs a single
 * organization (ADR-0001), so "first membership" is always the right pick;
 * users with no membership keep `null` and correctly get 403 from org routes.
 *
 * Runs in `session.create.before`: returning `{ data }` overrides the session
 * row before it is persisted. Sessions already created keep their stored
 * value — existing browser sessions need one re-login (or one manual switch)
 * after deploying this.
 */
export const sessionAutoActivateOrganizationHook: NonNullable<
	NonNullable<
		NonNullable<BetterAuthOptions['databaseHooks']>['session']
	>['create']
>['before'] = async (session) => {
	if (session.activeOrganizationId) return;
	const [membership] = await drizzleDB
		.select({ organizationId: members.organizationId })
		.from(members)
		.where(eq(members.userId, session.userId))
		.orderBy(asc(members.createdAt))
		.limit(1);
	if (!membership) return;
	return {
		data: { ...session, activeOrganizationId: membership.organizationId },
	};
};
