import { useQuery } from '@tanstack/react-query';
import {
	assignableOrganizationRoles,
	grantableOrganizationRoles,
	parseRoleList,
} from '@ims-erp/common';
import { useIsAppAdmin } from './use-is-app-admin';
import { myOrganizationsQueryOptions } from './organization-api';

/**
 * The caller's own role in a specific organization, for role-assignment UX.
 *
 * @remarks
 * UX only — the backend re-checks every assignment against the same shared
 * ladder (`assignableOrganizationRoles` in `@ims-erp/common`). The caller's
 * membership comes from `GET /organizations/mine`, which is session-scoped and
 * needs no active organization, so this works for the admin-mode dialog where
 * the target organization is not the active one.
 *
 * Returns an empty role list while the memberships are loading or the caller
 * belongs to no organization, which collapses the dropdown to the non-tier
 * roles — the safe direction (never offer something that will be rejected).
 */
export function useCallerOrgRoles(organizationId: string | null | undefined): {
	callerRoles: string[];
	isPlatformAdmin: boolean;
	isPending: boolean;
} {
	const { isAppAdmin } = useIsAppAdmin();
	const { data, isPending } = useQuery({
		...myOrganizationsQueryOptions,
		enabled: Boolean(organizationId),
	});
	const membership = organizationId
		? data?.find((org) => org.id === organizationId)
		: undefined;
	return {
		callerRoles: parseRoleList(membership?.role),
		isPlatformAdmin: isAppAdmin,
		isPending: Boolean(organizationId) && isPending,
	};
}

/**
 * Roles the caller may put on an invitation for the given organization.
 *
 * @param organizationId - Target organization (never the invitee's own)
 */
export function useGrantableOrgRoles(organizationId: string | null | undefined) {
	const { callerRoles, isPlatformAdmin, isPending } =
		useCallerOrgRoles(organizationId);
	return {
		roles: grantableOrganizationRoles(callerRoles, { isPlatformAdmin }),
		isPending,
	};
}

/**
 * Roles the caller may set on an existing member, keeping whatever that member
 * already holds (an existing grant is not a new grant).
 *
 * @param organizationId - Organization the member belongs to
 * @param currentRoles - Roles the target member holds today
 */
export function useAssignableOrgRoles(
	organizationId: string | null | undefined,
	currentRoles: readonly string[],
) {
	const { callerRoles, isPlatformAdmin, isPending } =
		useCallerOrgRoles(organizationId);
	return {
		roles: assignableOrganizationRoles(callerRoles, {
			isPlatformAdmin,
			currentRoles,
		}),
		isPending,
	};
}
