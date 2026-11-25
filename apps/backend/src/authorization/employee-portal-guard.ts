/**
 * Guard for the employee portal (`apps/web-employee-portal`).
 *
 * @remarks
 * A fourth path next to `erpGuard`, `sessionGuard` and `warehouseGuard`, with
 * a deliberately narrow answer: "is this caller an employee of the active
 * organization, and not one of the portal-excluded identities?"
 *
 * In order:
 * 1. Resolve the Better Auth session. -> 401
 * 2. Refuse the excluded global app roles (`admin`, `investor`, `customer`)
 *    even when the user also holds an employee record. -> 403
 * 3. Resolve the organization (header `x-organization-id` > active session).
 *    -> 403 when neither is present.
 * 4. Require a live `hr.employees` row for (user, organization). -> 403
 * 5. Run the optional record-level policy. The project routes pass one that
 *    checks `project:update` (PIC work) - a portal permission, resolved from
 *    the caller's organization roles, but never *required* for the plain
 *    self-service routes.
 *
 * The record is exposed as `ctx.erp.employee`; every `/me` handler scopes its
 * queries to `ctx.erp.employee.id`, so a caller can never address another
 * employee's data through these routes.
 */
import Elysia, { type Context } from 'elysia';
import { container } from 'tsyringe';
import { auth } from '@providers/better-auth/auth';
import { hasAppRole } from '@providers/better-auth/ac/admin-ac';
import { ORGANIZATION_HEADER, type SessionPayload } from './elysia-auth';
import {
	EMPLOYEE_PORTAL_RESOLVER_TOKEN,
	type IEmployeePortalResolver,
	type TPortalEmployee,
} from './employee-portal-resolver';

/** Context resolved by the `employeePortal` macro. */
export type EmployeePortalContext = {
	session: SessionPayload;
	organizationId: string;
	employee: TPortalEmployee;
};

/** Sentinel error mapped to an envelope response by the guard. */
export class EmployeePortalError extends Error {
	constructor(
		readonly status: 401 | 403,
		message: string,
	) {
		super(message);
		this.name = 'EmployeePortalError';
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

/** Global app roles that may never use the employee portal (ADR-0018 names). */
const EXCLUDED_APP_ROLES = ['admin', 'investor', 'customer'] as const;

function selectOrganizationId(
	headers: Headers,
	activeOrganizationId: string | null,
): string | null {
	const headerOrg = headers.get(ORGANIZATION_HEADER);
	if (headerOrg && headerOrg.trim().length > 0) return headerOrg.trim();
	return activeOrganizationId;
}

/** Options a route may add to the guard. */
export type TEmployeePortalMacroOptions = {
	/**
	 * Record-level policy, run after the employee record resolves. Throw
	 * {@link EmployeePortalError} (403) to refuse, or any domain error to keep
	 * the module's own error envelope.
	 */
	policy?: (context: EmployeePortalContext) => Promise<void> | void;
};

export function employeePortalGuard() {
	const resolver = container.resolve<IEmployeePortalResolver>(
		EMPLOYEE_PORTAL_RESOLVER_TOKEN,
	);

	return new Elysia({ name: 'employee-portal-guard' })
		.error({ EmployeePortalError })
		.onError({ as: 'global' }, ({ code, error, set }) => {
			if (code === 'EmployeePortalError') {
				set.status = error.status;
				return envelope(error.status, error.message);
			}
			return undefined;
		})
		.macro({
			employeePortal: (options: TEmployeePortalMacroOptions = {}) => ({
				resolve: async (
					context: Context,
				): Promise<{ erp: EmployeePortalContext }> => {
					const headers = context.request.headers;
					const session = await auth.api.getSession({ headers });
					if (!session) {
						throw new EmployeePortalError(401, 'Authentication required');
					}
					if (
						EXCLUDED_APP_ROLES.some((role) => hasAppRole(session.user.role, role))
					) {
						throw new EmployeePortalError(
							403,
							'The employee portal is not available to this account',
						);
					}
					const organizationId = selectOrganizationId(
						headers,
						session.session.activeOrganizationId ?? null,
					);
					if (!organizationId) {
						throw new EmployeePortalError(
							403,
							'Organization context required (set active organization or send x-organization-id)',
						);
					}
					const employee = await resolver.findByUserAndOrganization(
						session.user.id,
						organizationId,
					);
					if (!employee) {
						throw new EmployeePortalError(
							403,
							'The employee portal requires an employee record in this organization',
						);
					}
					const erp: EmployeePortalContext = { session, organizationId, employee };
					await options.policy?.(erp);
					return { erp };
				},
			}),
		});
}
