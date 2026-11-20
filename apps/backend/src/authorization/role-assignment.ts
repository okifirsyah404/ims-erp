/**
 * Server-side enforcement of the organization role-assignment ladder.
 *
 * @remarks
 * The dialog hides the roles a caller may not hand out, but the UI is only
 * UX: `POST /organizations/:id/invitations`, `POST /admin/invitations`,
 * member add/update and the invite-first employee form all reach the same
 * services, so the rule is re-checked here against the guard-resolved caller.
 *
 * The ladder itself is shared data (`assignableOrganizationRoles` /
 * `grantableOrganizationRoles` in `@ims-erp/common`) so the client and the
 * server cannot drift.
 */
import {
	assignableOrganizationRoles,
	findUnassignableRoles,
	grantableOrganizationRoles,
	parseRoleList,
} from '@ims-erp/common';
import type { ErpContext } from './elysia-auth';
import { isGlobalAdmin } from './require-global-admin';

/** The caller's role-assignment context, derived from the guard. */
export type TRoleAssignmentContext = {
	/** The caller's own organization roles (comma-joined `member.role`). */
	callerRoles: string[];
	/** Better Auth `admin` application role: administers every organization. */
	isPlatformAdmin: boolean;
};

/** Builds the context from the guard-resolved request. */
export function roleAssignmentContext(erp: ErpContext): TRoleAssignmentContext {
	return {
		callerRoles: parseRoleList(erp.member.role),
		isPlatformAdmin: isGlobalAdmin({ erp }),
	};
}

/**
 * Roles the caller may put on an invitation.
 *
 * @param ctx - Caller context from {@link roleAssignmentContext}
 */
export function grantableRolesFor(ctx: TRoleAssignmentContext): string[] {
	return grantableOrganizationRoles(ctx.callerRoles, {
		isPlatformAdmin: ctx.isPlatformAdmin,
	});
}

/**
 * Roles the caller may set on an existing member, keeping whatever the member
 * already holds (an existing grant is not a new grant).
 *
 * @param ctx - Caller context from {@link roleAssignmentContext}
 * @param currentRoles - Roles the target member holds today
 */
export function assignableRolesFor(
	ctx: TRoleAssignmentContext,
	currentRoles: readonly string[],
): string[] {
	return assignableOrganizationRoles(ctx.callerRoles, {
		isPlatformAdmin: ctx.isPlatformAdmin,
		currentRoles,
	});
}

/**
 * The requested roles the caller may not grant on an invitation.
 *
 * @param ctx - Caller context from {@link roleAssignmentContext}
 * @param requested - Roles from the request payload (one row, or one member)
 */
export function unassignableInviteRoles(
	ctx: TRoleAssignmentContext,
	requested: readonly string[],
): string[] {
	return findUnassignableRoles(requested, grantableRolesFor(ctx));
}

/**
 * The requested roles the caller may not set on an existing member.
 *
 * @param ctx - Caller context from {@link roleAssignmentContext}
 * @param requested - Roles from the request payload
 * @param currentRoles - Roles the target member holds today
 */
export function unassignableMemberRoles(
	ctx: TRoleAssignmentContext,
	requested: readonly string[],
	currentRoles: readonly string[],
): string[] {
	return findUnassignableRoles(
		requested,
		assignableRolesFor(ctx, currentRoles),
	);
}
