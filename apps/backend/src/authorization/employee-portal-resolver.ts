/**
 * Seam between the employee-portal guard and the human-resource module.
 *
 * @remarks
 * Like {@link import('./warehouse-pic-resolver')}, the guard must not touch
 * Drizzle: it resolves this port through
 * {@link EMPLOYEE_PORTAL_RESOLVER_TOKEN}. The HR module registers the
 * implementation (`EmployeePortalResolver`), so the dependency points from
 * authorization to a contract, never to a domain repository.
 */
import type { InjectionToken } from 'tsyringe';

/** The caller's own employee record inside one organization. */
export type TPortalEmployee = {
	id: string;
	employeeCode: string;
	fullName: string;
	organizationId: string;
};

/** One organization the caller can use the portal in. */
export type TPortalOrganization = {
	organizationId: string;
	employeeId: string;
	employeeCode: string;
	fullName: string;
};

/** Employee-record lookup used by the employee-portal guard. */
export interface IEmployeePortalResolver {
	/**
	 * The caller's live employee row in exactly this organization.
	 *
	 * @param userId - The authenticated caller
	 * @param organizationId - The resolved active organization
	 * @returns The employee row, or null when the user is not an employee there
	 */
	findByUserAndOrganization(
		userId: string,
		organizationId: string,
	): Promise<TPortalEmployee | null>;

	/**
	 * Organizations where the caller has a live employee record (portal org
	 * switcher; organization memberships without an employee record are not
	 * portal-usable). Names stay with the organization module.
	 */
	listOrganizationsForUser(userId: string): Promise<TPortalOrganization[]>;
}

export const EMPLOYEE_PORTAL_RESOLVER_TOKEN: InjectionToken<IEmployeePortalResolver> =
	Symbol('EMPLOYEE_PORTAL_RESOLVER');
