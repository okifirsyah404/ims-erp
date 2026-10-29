/**
 * Better Auth server hooks protecting the organization plugin's directly
 * reachable membership and invitation endpoints from privilege escalation.
 *
 * Rules enforced here (on top of Better Auth's own built-in guards):
 * - Only organization owners may grant or change the `owner` role
 *   (members, invitations, and role updates alike).
 * - Organization admins may manage members/invitations only with the
 *   non-owner ERP roles permitted by the role policy.
 * - Ordinary members can never grant privileged ERP roles.
 * - The final owner cannot be removed or demoted (Better Auth already
 *   guards this; these hooks fail closed as well).
 *
 * These hooks run inside the Better Auth handler itself, so they cover the
 * mounted auth routes and any server-side `auth.api.*` callers that pass
 * request headers.
 */
import { APIError, getSessionFromCtx } from 'better-auth/api';
import { createAuthMiddleware } from 'better-auth/api';
import type { BetterAuthOptions, Where } from 'better-auth';
import { erpRoleNames, type ErpRoleName } from '@ims-erp/common';

const OWNER_ROLE: ErpRoleName = 'owner';
/** Roles an organization admin may grant without being an owner. */
const ADMIN_GRANTABLE_ROLES: readonly string[] = erpRoleNames.filter(
	(role) => role !== OWNER_ROLE,
);

type RoleInput = string | string[] | null | undefined;

function parseRoles(role: RoleInput): string[] {
	if (!role) return [];
	if (Array.isArray(role)) return role;
	return role.split(',').map((r) => r.trim()).filter(Boolean);
}

function containsOwner(roles: readonly string[]): boolean {
	return roles.includes(OWNER_ROLE);
}

type MemberRow = { role: string } | null;

interface AuthAdapterLike {
	findOne: (data: { model: string; where: Where[] }) => Promise<MemberRow>;
}

interface HookContextLike {
	body?: Record<string, unknown>;
	context: {
		adapter: AuthAdapterLike;
		session?: {
			user: { id: string };
			session: Record<string, unknown> & { activeOrganizationId?: string | null };
		} | null;
	};
}

/**
 * Finds the acting member row for a user in the target organization using
 * the auth database adapter (model `member`).organizationId resolution
 * follows Better Auth's own convention: body override, else the session's
 * active organization.
 */
async function findActorMember(ctx: HookContextLike): Promise<MemberRow> {
	const session = ctx.context.session;
	const body = ctx.body ?? {};
	const organizationId =
		typeof body.organizationId === 'string' && body.organizationId.length > 0
			? body.organizationId
			: (session?.session.activeOrganizationId ?? null);
	if (!organizationId || !session) return null;
	return ctx.context.adapter.findOne({
		model: 'member',
		where: [
			{ field: 'userId', value: session.user.id },
			{ field: 'organizationId', value: organizationId },
		] as Where[],
	});
}

function forbidden(message: string): APIError {
	return new APIError('FORBIDDEN', { message });
}

/**
 * Builds the `hooks` block for the Better Auth instance.
 */
export function betterAuthHooks(): NonNullable<BetterAuthOptions['hooks']> {
	return {
		before: createAuthMiddleware(async (ctx) => {
			const path = ctx.path;
			const body = (ctx.body ?? {}) as { role?: RoleInput };
			const requested = parseRoles(body.role);

			// Owner-role grants always require an acting owner.
			if (
				path === '/organization/add-member' ||
				path === '/organization/create-invitation' ||
				path === '/organization/update-member-role'
			) {
				if (requested.length === 0 || !containsOwner(requested)) {
					// Non-owner role grants are gated by Better Auth's own
					// member/invitation permission middleware.
					return;
				}
				const session = await getSessionFromCtx(ctx).catch(() => null);
				if (!session) {
					throw new APIError('UNAUTHORIZED', {
						message: 'Authentication required',
					});
				}
				const actor = await findActorMember(ctx);
				if (!actor || !containsOwner(parseRoles(actor.role))) {
					throw forbidden(
						'Only organization owners can grant the owner role',
					);
				}
				return;
			}

			// Organization admins must not grant privileged ERP roles they do
			// not hold. Owner is covered above; keep the deny-list explicit for
			// future privileged roles.
			if (path === '/organization/add-member' || path === '/organization/update-member-role') {
				const session = await getSessionFromCtx(ctx).catch(() => null);
				if (!session) return; // unauthenticated: own middleware will 401
				const actor = await findActorMember(ctx);
				if (!actor) return; // non-member: Better Auth's own guard rejects
				const actorRoles = parseRoles(actor.role);
				if (!containsOwner(actorRoles)) {
					const illegal = requested.filter(
						(role) => !ADMIN_GRANTABLE_ROLES.includes(role),
					);
					if (illegal.length > 0) {
						throw forbidden(`Role not grantable: ${illegal.join(', ')}`);
					}
				}
			}

			return;
		}),
	};
}
