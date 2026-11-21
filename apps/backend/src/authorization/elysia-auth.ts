/**
 * Reusable Elysia authorization layer on top of Better Auth.
 *
 * One plugin, one macro:
 *   `erpGuard()`  - registers the `erp` macro and error mapping.
 *   `sessionGuard()` - registers the `erpSession` macro (session only).
 *   `warehouseGuard()` - registers the `warehouse` macro (person in charge,
 *                        ADR-0017).
 *
 * The macro options:
 *   permission: ['quotation:read', 'quotation:approve']  (ALL must pass)
 *   policy: (ctx) => void                               (record-level check)
 *
 * What it does, in order, inside the resolve phase (before the handler):
 *   1. Resolves the Better Auth session from the REAL request headers.
 *      -> 401 when unauthenticated.
 *   2. Resolves the organization context: explicit `x-organization-id`
 *      header takes precedence over the session's active organization.
 *      -> 403 when neither is present.
 *   3. Validates current membership against the SAME resolved id using the
 *      caller's request headers. -> 403 when not a member. A global admin
 *      without membership is NOT exempt.
 *   4. Checks every requested resource:action permission against the
 *      caller's organization roles (union across multi-role members).
 *      -> 403 on the first failure.
 *   5. Runs the optional record-level policy hook.
 *
 * The resolved context is exposed to handlers as `ctx.erp`
 * (`{ session, organizationId, member }`). Use the SAME
 * `ctx.erp.organizationId` for membership, permission, queries, and audit
 * records. Client-provided user IDs, roles, or permission arrays are never
 * trusted as authorization evidence.
 */
import Elysia, { type Context } from 'elysia';
import { container } from 'tsyringe';
import { isWebAdminSessionAllowed } from '@providers/better-auth/options/session.auth';
import { auth } from '@providers/better-auth/auth';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from '@providers/better-auth/ac/admin-ac';
import type { ErpResource } from '@ims-erp/common';
import {
	PERMISSION_RESOLVER_TOKEN,
	type IPermissionResolver,
} from './permission-resolver';
import {
	WAREHOUSE_PIC_RESOLVER_TOKEN,
	type IWarehousePicResolver,
} from './warehouse-pic-resolver';

export const ORGANIZATION_HEADER = 'x-organization-id';

/**
 * The Better Auth session shape resolved by the guards.
 *
 * @remarks
 * Exported so record-level policies (e.g.
 * {@link import('./require-global-admin').requireGlobalAdmin}) can be typed
 * against it without redeclaring it structurally.
 */
export type SessionPayload = NonNullable<
	Awaited<ReturnType<typeof auth.api.getSession>>
>;

export type ErpMember = {
	id: string;
	userId: string;
	organizationId: string;
	role: string;
};

export type ErpContext = {
	session: SessionPayload;
	/** Validated organization id (header > active session). */
	organizationId: string;
	/** Caller's membership row for the validated organization. */
	member: ErpMember;
};

/** A permission requirement, e.g. `'quotation:read'` (resource:action). */
export type PermissionRequirement =
	| `${ErpResource}:${string}`
	// Built-in Better Auth organization statements (not part of the ERP
	// business catalog) are granted through the same role system.
	| `organization:${string}`
	| `member:${string}`
	| `invitation:${string}`
	| `ac:${string}`;

/** Sentinel error mapped to an envelope response by the guard. */
export class ErpAuthError extends Error {
	constructor(
		readonly status: 401 | 403 | 404,
		message: string,
	) {
		super(message);
		this.name = 'ErpAuthError';
	}
}

function envelope(status: number, message: string) {
	return {
		requestId: crypto.randomUUID(),
		status,
		message,
		timestamp: Date.now(),
		data: null,
		errors: [{ message }],
	};
}

function parseRequirement(requirement: string): {
	resource: string;
	actions: string[];
} | null {
	const separator = requirement.indexOf(':');
	if (separator <= 0 || separator === requirement.length - 1) return null;
	const actions = requirement
		.slice(separator + 1)
		.split('|')
		.filter(Boolean);
	if (actions.length === 0) return null;
	return { resource: requirement.slice(0, separator), actions };
}

/** Organization selection: explicit header wins; active org is fallback. */
function selectOrganizationId(
	headers: Headers,
	activeOrganizationId: string | null,
): string | null {
	const headerOrg = headers.get(ORGANIZATION_HEADER);
	if (headerOrg && headerOrg.trim().length > 0) return headerOrg.trim();
	return activeOrganizationId;
}

async function resolveSession(headers: Headers): Promise<SessionPayload | null> {
	return auth.api.getSession({ headers });
}

/**
 * Validates current membership against the exact organization id via the
 * caller's request headers, so membership checks, permission checks, DB
 * queries, and audit records all use the same validated id.
 */
async function resolveMember(
	headers: Headers,
	organizationId: string,
	sessionUserId: string,
): Promise<ErpMember | null> {
	const fullOrg = await auth.api
		.getFullOrganization({
			headers,
			query: { organizationId },
		})
		.catch(() => null);
	if (!fullOrg || fullOrg.id !== organizationId) return null;
	const member = fullOrg.members.find((m) => m.userId === sessionUserId);
	if (!member) return null;
	return {
		id: member.id,
		userId: member.userId,
		organizationId: fullOrg.id,
		role: member.role,
	};
}

async function guardResolve(
	context: Context,
	options: {
		permission?: readonly PermissionRequirement[];
		policy?: (ctx: Context & { erp: ErpContext }) => Promise<void> | void;
	},
	permissionResolver: IPermissionResolver,
): Promise<{ erp: ErpContext }> {
	const headers = context.request.headers;

	const session = await resolveSession(headers);
	if (!session) {
		throw new ErpAuthError(401, 'Authentication required');
	}

	const organizationId = selectOrganizationId(
		headers,
		session.session.activeOrganizationId ?? null,
	);
	if (!organizationId) {
		throw new ErpAuthError(
			403,
			'Organization context required (set active organization or send x-organization-id)',
		);
	}

	const member = await resolveMember(
		headers,
		organizationId,
		session.user.id,
	);
	if (!member) {
		throw new ErpAuthError(403, 'Organization membership required');
	}

	const erp: ErpContext = { session, organizationId, member };

	const requirements = options.permission ?? [];
	if (requirements.length > 0) {
		const roleNames = member.role.split(',').map((r) => r.trim());
		for (const requirement of requirements) {
			const parsed = parseRequirement(requirement);
			if (!parsed) {
				throw new ErpAuthError(403, 'Invalid permission requirement');
			}
			// Static closed catalog grants (`erpRoleGrants`), union across the
			// member's roles via the permission resolver seam.
			const allowed = await permissionResolver.hasPermission(
				organizationId,
				roleNames,
				{
					[parsed.resource]: parsed.actions,
				} as never,
			);
			if (!allowed) {
				throw new ErpAuthError(403, 'Insufficient permissions');
			}
		}
	}

	if (options.policy) {
		// The policy must see the resolved ERP context: merge it over the
		// request context (the raw resolve-phase context does not yet carry
		// `erp` — this was a latent bug never exercised by tests or the
		// pre-existing policy routes).
		await options.policy(
			Object.assign(context as Context & { erp: ErpContext }, { erp }),
		);
	}

	return { erp };
}

/**
 * The ERP guard plugin. Attach once to the app (or per-controller plugin);
 * routes opt in via the `erp` macro option. Authorization always runs in the
 * resolve phase before protected handlers.
 */
export function erpGuard() {
	const permissionResolver = container.resolve<IPermissionResolver>(
		PERMISSION_RESOLVER_TOKEN,
	);

	return new Elysia({ name: 'erp-guard' })
		.error({ ErpAuthError })
		.onError({ as: 'global' }, ({ code, error, set }) => {
			if (code === 'ErpAuthError') {
				set.status = error.status;
				return envelope(error.status, error.message);
			}
			return undefined;
		})
		.macro({
			erp: (
				options: {
					permission?: readonly PermissionRequirement[];
					policy?: (ctx: Context & { erp: ErpContext }) => Promise<void> | void;
				} = {},
			) => ({
				resolve: (context: Context) =>
					guardResolve(context, options, permissionResolver),
			}),
		});
}

/**
 * Session-only guard for identity routes that are NOT organization-scoped
 * (e.g. `GET /users/me`).
 *
 * @remarks
 * Resolves the Better Auth session and 401s when absent — nothing more. No
 * organization context is required: a fresh login has no
 * `activeOrganizationId` yet, and demanding one for "who am I?" made the
 * route 403 immediately after sign-in (the bug this fixes). The macro
 * exposes `erp.session` only; `organizationId`/`member` remain exclusive to
 * {@link erpGuard} so their type stays non-nullable for existing consumers.
 * Like `erpGuard`, it accepts an optional `policy` hook for record-level
 * checks that must run before the handler.
 *
 * Maps its own `ErpAuthError` (2026-11-14): it used to rely on being mounted
 * next to `erpGuard()`, so a module that rode the session guard **alone**
 * answered an unauthenticated call with Elysia's default plain-text body
 * instead of the API envelope. The ERP-0047 notification routes are the first
 * session-only surface with no `erp` macro, which exposed it.
 */
export function sessionGuard() {
	return new Elysia({ name: 'session-guard' })
		.error({ ErpAuthError })
		.onError({ as: 'global' }, ({ code, error, set }) => {
			if (code === 'ErpAuthError') {
				set.status = error.status;
				return envelope(error.status, error.message);
			}
			return undefined;
		})
		.macro({
			erpSession: (options: {
				/** Object-form macro enablement flag (no behavior of its own). */
				session?: boolean;
				/** Record-level hook, run after the session is resolved. */
				policy?: (ctx: { erp: { session: SessionPayload } }) => Promise<void> | void;
			}) => ({
				resolve: async (
					context: Context,
				): Promise<{ erp: { session: SessionPayload } }> => {
					const session = await resolveSession(context.request.headers);
					if (!session) {
						throw new ErpAuthError(401, 'Authentication required');
					}
					// ADR-0018 / ADR-0017 §8: re-check the web-admin login gate on
					// every request so sessions created before the gate are rejected.
					// Failure is 403 (authenticated, not allowed), not 401.
					if (!(await isWebAdminSessionAllowed(session.user.id))) {
						throw new ErpAuthError(403, 'Web-admin access requires an internal organization role');
					}
					const erp = { session };
					// Session-only guard has no other preconditions, so the
					// record-level hook runs here (mirrors `erpGuard`'s policy).
					if (options.policy) await options.policy({ erp });
					return { erp };
				},
			}),
		});
}

/** The warehouse actions a person in charge may perform (ADR-0017 §2). */
export type TWarehouseAction =
	| 'read'
	| 'update'
	| 'archive'
	| 'import'
	| 'export';

/**
 * Guard for warehouse routes a person in charge may call (ADR-0017 §5).
 *
 * @remarks
 * A second authorization path next to {@link erpGuard}, deliberately narrow:
 * it answers "may this user act on **this** warehouse?" and nothing else. It
 * never reads organization roles and never requires an active organization —
 * a PIC keeps access even when the warehouse is not linked to their active
 * organization (ADR-0017 §3). Stock stays on `erpGuard` + the
 * warehouse↔organization link; this guard grants no stock operation.
 *
 * The PIC lookup is a port ({@link IWarehousePicResolver}) so this file stays
 * free of Drizzle, mirroring how `erpGuard` reaches the permission resolver.
 *
 * Status mapping:
 * - no session → 401
 * - web-admin login gate closed → 403
 * - application admin → allowed, without a PIC row
 * - PIC of this warehouse → allowed
 * - PIC of *another* warehouse → 404, so existence is not leaked (ADR-0017 §7)
 * - no live PIC row at all → 403
 *
 * Create, assign, and unassign deliberately stay on `requireGlobalAdmin`.
 */
export function warehouseGuard() {
	const picResolver = container.resolve<IWarehousePicResolver>(
		WAREHOUSE_PIC_RESOLVER_TOKEN,
	);

	return new Elysia({ name: 'warehouse-guard' })
		.error({ ErpAuthError })
		.onError({ as: 'global' }, ({ code, error, set }) => {
			if (code === 'ErpAuthError') {
				set.status = error.status;
				return envelope(error.status, error.message);
			}
			return undefined;
		})
		.macro({
			warehouse: (options: {
				/** The action the route performs. All five are PIC rights. */
				action: TWarehouseAction;
			}) => ({
				resolve: async (
					context: Context,
				): Promise<{
					erp: { session: SessionPayload };
					warehouse: { id: string; action: TWarehouseAction };
				}> => {
					const session = await resolveSession(context.request.headers);
					if (!session) {
						throw new ErpAuthError(401, 'Authentication required');
					}
					if (!(await isWebAdminSessionAllowed(session.user.id))) {
						throw new ErpAuthError(
							403,
							'Web-admin access requires an internal organization role',
						);
					}

					const warehouseId = (context.params as { id?: string } | undefined)?.id;
					if (!warehouseId) {
						throw new ErpAuthError(
							403,
							'Warehouse route requires a warehouse id',
						);
					}

					const erp = { session };
					const warehouse = { id: warehouseId, action: options.action };
					if (hasAppRole(session.user.role, GLOBAL_ADMIN_ROLE)) {
						return { erp, warehouse };
					}

					const managed = await picResolver.listWarehouseIdsForUser(
						session.user.id,
					);
					if (managed.length === 0) {
						throw new ErpAuthError(
							403,
							'Warehouse person-in-charge access required',
						);
					}
					if (!managed.includes(warehouseId)) {
						throw new ErpAuthError(404, 'Warehouse not found');
					}
					return { erp, warehouse };
				},
			}),
		});
}

/** Context resolved by {@link adminOrErpGuard}. */
export type AdminOrErpContext = {
	session: SessionPayload;
	/**
	 * Selected organization (header > active session). Validated by
	 * membership for an organization member; for an application admin it is
	 * the selection as sent and may be `null`.
	 */
	organizationId: string | null;
	/** Whether the caller holds the platform administrator role. */
	isAppAdmin: boolean;
};

/**
 * Guard for application-wide settings an application admin always reaches and
 * an organization role may be granted (the code-numbering settings).
 *
 * @remarks
 * A third path next to {@link erpGuard} and {@link sessionGuard}:
 * - application admin -> allowed, with or without an organization context
 *   (ADR-0007: an admin manages global records without a membership);
 * - `appAdminOnly` -> everyone else is refused (the warehouse series follows
 *   ADR-0008: warehouses are application-admin-only);
 * - otherwise the caller needs an organization context, a live membership in
 *   it and every requested permission - exactly what `erpGuard` checks.
 *
 * Status mapping: no session 401; web-admin gate closed, no organization,
 * no membership, missing permission or not an admin on `appAdminOnly` 403.
 */
export function adminOrErpGuard() {
	const permissionResolver = container.resolve<IPermissionResolver>(
		PERMISSION_RESOLVER_TOKEN,
	);

	return new Elysia({ name: 'admin-or-erp-guard' })
		.error({ ErpAuthError })
		.onError({ as: 'global' }, ({ code, error, set }) => {
			if (code === 'ErpAuthError') {
				set.status = error.status;
				return envelope(error.status, error.message);
			}
			return undefined;
		})
		.macro({
			adminOrErp: (options: {
				/** Permissions an organization member needs (ALL must pass). */
				permission?: readonly PermissionRequirement[];
				/** Refuse everyone who is not an application admin. */
				appAdminOnly?: boolean;
			}) => ({
				resolve: async (context: Context): Promise<{ erp: AdminOrErpContext }> => {
					const headers = context.request.headers;
					const session = await resolveSession(headers);
					if (!session) {
						throw new ErpAuthError(401, 'Authentication required');
					}
					if (!(await isWebAdminSessionAllowed(session.user.id))) {
						throw new ErpAuthError(
							403,
							'Web-admin access requires an internal organization role',
						);
					}

					const organizationId = selectOrganizationId(
						headers,
						session.session.activeOrganizationId ?? null,
					);
					if (hasAppRole(session.user.role, GLOBAL_ADMIN_ROLE)) {
						return { erp: { session, organizationId, isAppAdmin: true } };
					}
					if (options.appAdminOnly) {
						throw new ErpAuthError(403, 'Application administrator role required');
					}
					if (!organizationId) {
						throw new ErpAuthError(
							403,
							'Organization context required (set active organization or send x-organization-id)',
						);
					}
					const member = await resolveMember(headers, organizationId, session.user.id);
					if (!member) {
						throw new ErpAuthError(403, 'Organization membership required');
					}
					const roleNames = member.role.split(',').map((r) => r.trim());
					for (const requirement of options.permission ?? []) {
						const parsed = parseRequirement(requirement);
						if (!parsed) {
							throw new ErpAuthError(403, 'Invalid permission requirement');
						}
						const allowed = await permissionResolver.hasPermission(
							organizationId,
							roleNames,
							{ [parsed.resource]: parsed.actions } as never,
						);
						if (!allowed) {
							throw new ErpAuthError(403, 'Insufficient permissions');
						}
					}
					return { erp: { session, organizationId, isAppAdmin: false } };
				},
			}),
		});
}
