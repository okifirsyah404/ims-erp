/**
 * Cross-module port: replace a user's organization roles.
 *
 * @remarks
 * Consumed by the admin user surface (`PATCH /admin/users/:userId/roles`), so
 * the `user` module can change a role without touching `auth.members` itself
 * (`elysia-module` rule 3.2). Implemented by the organization module's adapter
 * over `OrganizationService.updateMemberRolesByUser`, which keeps the
 * role-tier ladder, the last-owner guard and the Better Auth write in one
 * place.
 */
export interface IOrganizationMemberRolePort {
	/**
	 * Replaces the role list of one member, identified by user id.
	 *
	 * @param input.organizationId - The organization the membership belongs to
	 * @param input.userId - The member's user id
	 * @param input.roles - The complete new role list (never empty)
	 * @param input.callerRoles - Acting caller's own organization roles
	 * @param input.isPlatformAdmin - Acting caller holds the app-admin role
	 * @throws MemberNotFoundError when the user is not a member
	 * @throws MemberRoleNotAssignableError when a role is above the caller's tier
	 * @throws LastOwnerError when the change would leave no owner
	 */
	updateRolesByUser(input: {
		headers: Headers;
		organizationId: string;
		userId: string;
		roles: string[];
		callerRoles: readonly string[];
		isPlatformAdmin: boolean;
	}): Promise<{ id: string; role: string }>;
}
