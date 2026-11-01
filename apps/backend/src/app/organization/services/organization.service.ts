import { inject, injectable } from 'tsyringe';
import type { TOrganizationSelect } from '@drizzle/schemas/auth.schema';
import { TPaginationResult } from '@ims-erp/common';
import type {
	IOrganizationAuthGateway,
	TGatewayFullOrganization,
} from '../contracts/organization-auth.gateway.interface';
import type {
	IOrganizationRepository,
	TMemberPaginationRequest,
	TOrganizationPaginationRequest,
} from '../contracts/organization.repository.interface';
import type {
	TAddMember,
	TCreateOrganization,
	TMemberRole,
	TOrganizationMember,
	TUpdateMemberRole,
	TUpdateOrganization,
} from '../contracts/organization.contract';
import {
	ORGANIZATION_AUTH_GATEWAY_TOKEN,
	ORGANIZATION_REPOSITORY_TOKEN,
} from '../constants/di';
import {
	LastOwnerError,
	MemberNotFoundError,
	OrganizationAlreadyDeletedError,
	OrganizationAlreadyExistsError,
	OrganizationNotFoundError,
	OrganizationNotDeletedError,
	OrganizationSlugTakenError,
} from './organization.errors';

/**
 * Organization module service.
 *
 * @remarks
 * Enforces the deployment's single-organization invariant (at most one
 * organization row may exist, soft-deleted included), routes all
 * organization DELETEs to a soft delete (Better Auth's own hard delete is
 * never used), and guards the last-owner invariant for member mutations.
 * Membership/profile mutations flow through the Better Auth gateway.
 */
@injectable()
export class OrganizationService {
	constructor(
		@inject(ORGANIZATION_REPOSITORY_TOKEN)
		private readonly repository: IOrganizationRepository,
		@inject(ORGANIZATION_AUTH_GATEWAY_TOKEN)
		private readonly gateway: IOrganizationAuthGateway,
	) {}

	async createOrganization(
		input: TCreateOrganization & { creatorUserId?: string },
	): Promise<TOrganizationSelect> {
		// Single-organization invariant: soft-deleted rows still count.
		if (await this.repository.existsAny()) {
			throw new OrganizationAlreadyExistsError();
		}
		const created = await this.gateway.createOrganization({
			name: input.name,
			slug: input.slug,
			logo: input.logo ?? undefined,
			metadata: input.metadata ?? undefined,
			userId: input.creatorUserId,
			role: 'owner',
		});
		const row = await this.repository.findById(created.id);
		if (!row) throw new OrganizationNotFoundError();
		return row;
	}

	/**
	 * Paginated organization listing (soft-deleted excluded unless asked).
	 */
	async listOrganizations(
		request: TOrganizationPaginationRequest,
	): Promise<TPaginationResult<TOrganizationSelect>> {
		return this.repository.paginate(request);
	}

	/**
	 * Fetches one organization by id.
	 *
	 * @throws OrganizationNotFoundError when absent or soft-deleted
	 */
	async getOrganization(id: string): Promise<TOrganizationSelect> {
		const row = await this.repository.findById(id);
		if (!row || row.deletedAt) throw new OrganizationNotFoundError();
		return row;
	}

	/**
	 * Updates profile fields through the Better Auth gateway.
	 *
	 * @remarks
	 * The caller's headers are forwarded so Better Auth enforces its
	 * organization-level permission check before mutating.
	 *
	 * @throws OrganizationNotFoundError when absent or soft-deleted
	 */
	async updateOrganization(
		headers: Headers,
		organizationId: string,
		input: TUpdateOrganization,
	): Promise<TOrganizationSelect> {
		await this.ensureActive(organizationId);
		await this.gateway.updateOrganization(headers, {
			organizationId,
			data: {
				name: input.name,
				logo: input.logo ?? undefined,
				metadata: input.metadata ?? undefined,
			},
		});
		const row = await this.repository.findById(organizationId);
		if (!row) throw new OrganizationNotFoundError();
		return row;
	}

	/**
	 * Soft delete. Never calls Better Auth's hard-delete endpoint — the row
	 * (and its membership history) stays for audit purposes.
	 */
	async deleteOrganization(organizationId: string): Promise<void> {
		const row = await this.ensureActive(organizationId);
		await this.repository.softDelete(row.id);
	}

	/**
	 * Restores a soft-deleted organization.
	 *
	 * @throws OrganizationNotFoundError when the row is absent
	 * @throws OrganizationNotDeletedError when the row is not deleted
	 */
	async restoreOrganization(organizationId: string): Promise<void> {
		const row = await this.repository.findById(organizationId);
		if (!row) throw new OrganizationNotFoundError();
		if (!row.deletedAt) throw new OrganizationNotDeletedError();
		// Single-organization invariant makes this unreachable in practice,
		// but keep the guard symmetric with delete.
		await this.repository.restore(row.id);
	}

	/** Paginated member list joined with user identity fields. */
	async listMembers(
		organizationId: string,
		request: TMemberPaginationRequest,
	): Promise<TPaginationResult<TOrganizationMember>> {
		return this.repository.paginateMembers(organizationId, request);
	}

	/**
	 * Adds a member through the Better Auth gateway.
	 *
	 * @throws OrganizationNotFoundError when the organization is absent or
	 * soft-deleted
	 */
	async addMember(
		headers: Headers,
		organizationId: string,
		input: TAddMember,
	): Promise<{ id: string }> {
		await this.ensureActive(organizationId);
		return this.gateway.addMember({
			organizationId,
			userId: input.userId,
			role: input.role,
		});
	}

	/**
	 * Changes a member's role through the Better Auth gateway.
	 *
	 * @remarks
	 * Demoting an owner is pre-checked here (last-owner protection) in
	 * addition to Better Auth's own check, so the failure surfaces as a
	 * typed domain error.
	 *
	 * @throws MemberNotFoundError when the member does not exist
	 * @throws LastOwnerError when demoting the last owner
	 */
	async updateMemberRole(
		headers: Headers,
		organizationId: string,
		memberId: string,
		input: TUpdateMemberRole,
	): Promise<{ id: string; role: TMemberRole }> {
		await this.ensureActive(organizationId);
		const member = await this.repository.findMemberById(organizationId, memberId);
		if (!member) throw new MemberNotFoundError();
		if (this.isOwner(member.role) && input.role !== 'owner') {
			await this.ensureNotLastOwner(organizationId, memberId);
		}
		const result = await this.gateway.updateMemberRole(headers, {
			organizationId,
			memberId,
			role: input.role,
		});
		return { id: result.member.id, role: input.role };
	}

	/**
	 * Removes a member through the Better Auth gateway.
	 *
	 * @throws MemberNotFoundError when the member does not exist
	 * @throws LastOwnerError when removing the last owner
	 */
	async removeMember(
		headers: Headers,
		organizationId: string,
		memberId: string,
	): Promise<void> {
		await this.ensureActive(organizationId);
		const member = await this.repository.findMemberById(organizationId, memberId);
		if (!member) throw new MemberNotFoundError();
		if (this.isOwner(member.role)) {
			await this.ensureNotLastOwner(organizationId, memberId);
		}
		await this.gateway.removeMember(headers, {
			organizationId,
			memberIdOrEmail: member.user?.email ?? memberId,
		});
	}

	/**
	 * Loads the organization and asserts it exists and is not soft-deleted.
	 *
	 * @throws OrganizationNotFoundError otherwise
	 */
	private async ensureActive(
		organizationId: string,
	): Promise<TOrganizationSelect> {
		const row = await this.repository.findById(organizationId);
		if (!row || row.deletedAt) throw new OrganizationNotFoundError();
		return row;
	}

	/**
	 * Guards the last-owner invariant before a role change or removal.
	 *
	 * @throws LastOwnerError when the member is the only owner
	 */
	private async ensureNotLastOwner(
		organizationId: string,
		memberId: string,
	): Promise<void> {
		const owners = await this.repository.countOwners(organizationId);
		const member = await this.repository.findMemberById(organizationId, memberId);
		if (owners <= 1 && member && this.isOwner(member.role)) {
			throw new LastOwnerError();
		}
	}

	/**
	 * Whether the member's (possibly comma-joined) role list includes
	 * `owner`.
	 */
	private isOwner(role: string): boolean {
		return role.split(',').map((r) => r.trim()).includes('owner');
	}
}

// Re-export for controller convenience.
export {
	LastOwnerError,
	MemberNotFoundError,
	OrganizationAlreadyDeletedError,
	OrganizationAlreadyExistsError,
	OrganizationNotFoundError,
	OrganizationNotDeletedError,
	OrganizationSlugTakenError,
};
export type { TGatewayFullOrganization };
