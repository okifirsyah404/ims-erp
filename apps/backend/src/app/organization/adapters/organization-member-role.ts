import { inject, injectable } from 'tsyringe';
import type { IOrganizationMemberRolePort } from '@app/user/contracts/organization-member-role.port';
import { OrganizationMemberRoleError } from '@app/user/errors/invitation.errors';
import {
	LastOwnerError,
	MemberNotFoundError,
	MemberRoleNotAssignableError,
} from '../errors/organization.errors';
import { ORGANIZATION_SERVICE_TOKEN } from '../constants/di';
import type { OrganizationService } from '../services/organization.service';

/**
 * Organization adapter for the user module's member-role port.
 *
 * @remarks
 * The admin user surface changes a role by user id; every rule (role tier,
 * last owner, Better Auth write) stays in {@link OrganizationService}, so the
 * new route cannot drift from the organization module's own member edit.
 *
 * The three refusals are retold as {@link OrganizationMemberRoleError}: the
 * `user` module never imports this module's errors.
 */
@injectable()
export class OrganizationMemberRoleAdapter implements IOrganizationMemberRolePort {
	constructor(
		@inject(ORGANIZATION_SERVICE_TOKEN)
		private readonly organizations: OrganizationService,
	) {}

	async updateRolesByUser(
		input: Parameters<IOrganizationMemberRolePort['updateRolesByUser']>[0],
	): Promise<{ id: string; role: string }> {
		try {
			return await this.organizations.updateMemberRolesByUser(
				input.headers,
				input.organizationId,
				input.userId,
				{ roles: input.roles as never },
				{
					callerRoles: input.callerRoles,
					isPlatformAdmin: input.isPlatformAdmin,
				},
			);
		} catch (error) {
			if (error instanceof MemberNotFoundError) {
				throw OrganizationMemberRoleError.memberNotFound();
			}
			if (error instanceof MemberRoleNotAssignableError) {
				throw OrganizationMemberRoleError.roleNotAssignable(error.roles);
			}
			if (error instanceof LastOwnerError) {
				throw OrganizationMemberRoleError.lastOwner();
			}
			throw error;
		}
	}
}
