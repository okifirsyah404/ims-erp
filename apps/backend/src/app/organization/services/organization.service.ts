import { inject, injectable } from 'tsyringe';
import type { TOrganizationSelect } from '@drizzle/schemas/auth.schema';
import { TPaginationResult } from '@ims-erp/common';
import { presignObjectUrl } from '@providers/s3/s3';
import { OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import type { IObjectStorage } from '@providers/s3/object-storage';
import { dispatchOrgLogoGeneration } from '../queues/org-logo.queue';
import { isWebpBuffer, OrganizationImageInvalidError } from '../utils/organization-image';
import { organizationImageObjectKey } from '../constants/image-keys';
import { seedOrganizationRoles } from '../../../../database/seeders/seed/organization-roles.seeder';
import type {
	IOrganizationAuthGateway,
	TGatewayFullOrganization,
} from '../contracts/organization-auth.gateway.interface';
import type {
	IOrganizationRepository,
	TMemberPaginationRequest,
	TOrganizationPaginationRequest,
	TOrganizationWithCounts,
} from '../contracts/organization.repository.interface';
import type {
	TAddMember,
	TCreateOrganization,
	TCreateOrganizationResult,
	TOrganizationMember,
	TUpdateMemberRole,
	TUpdateOrganization,
} from '../contracts/organization.contract';
import {
	ORGANIZATION_AUTH_GATEWAY_TOKEN,
	ORGANIZATION_REPOSITORY_TOKEN,
} from '../constants/di';
import { INVITATION_SERVICE_TOKEN } from '@app/user/constants/di';
import type {
	InvitationService,
	TActor,
} from '@app/user/services/invitation.service';
import { USER_MANAGEMENT_REPOSITORY_TOKEN } from '@app/user/constants/di';
import type { IUserManagementRepository } from '@app/user/contracts/user-management.repository.interface';
import {
	LastOrganizationError,
	LastOwnerError,
	MemberNotFoundError,
	OrganizationAlreadyDeletedError,
	OrganizationNotDeletedError,
	OrganizationNotFoundError,
	OrganizationSlugTakenError,
} from '../errors/organization.errors';
import type { TMemberRole } from '../contracts/organization.contract';

/**
 * Organization module service.
 *
 * @remarks
 * Supports multiple organizations inside one company (ADR-0007). Organization
 * creation is restricted to application admins at the HTTP boundary and the
 * Better Auth plugin options; this service owns the cross-organization rules:
 * every created organization receives the per-organization role catalog, the
 * last remaining organization cannot be deleted, and all organization DELETEs
 * are soft deletes (Better Auth's own hard delete is never used). The
 * last-owner invariant is guarded for member mutations, and
 * membership/profile mutations flow through the Better Auth gateway.
 */
@injectable()
export class OrganizationService {
	constructor(
		@inject(ORGANIZATION_REPOSITORY_TOKEN)
		private readonly repository: IOrganizationRepository,
		@inject(ORGANIZATION_AUTH_GATEWAY_TOKEN)
		private readonly gateway: IOrganizationAuthGateway,
		@inject(INVITATION_SERVICE_TOKEN)
		private readonly invitations: InvitationService,
		@inject(USER_MANAGEMENT_REPOSITORY_TOKEN)
		private readonly users: IUserManagementRepository,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {}

	/**
	 * Creates an organization and verifies the closed role enum.
	 *
	 * @param headers - Caller headers; Better Auth enforces
	 * `allowUserToCreateOrganization` (application admin) and activates the
	 * new organization for that session
	 * @param input - Organization profile, optional nested users, and the
	 * creator to register as `owner`
	 * @param actor - Audit actor for the invitation pipeline
	 * @param creatorEmail - The creator's own email; a nested-user row with
	 * this email is skipped (the creator already becomes owner)
	 *
	 * @remarks
	 * Enum verification is best-effort: a failure there must not orphan an
	 * organization that Better Auth has already created. Roles are a closed
	 * code catalog (`erpRoleNames`/`erpRoleGrants` in `@ims-erp/common`), so
	 * no per-organization provisioning is required.
	 *
	 * Nested users are per-item isolated (ERP-0041): an email belonging to a
	 * live active user joins directly through the auth gateway (`added`);
	 * any other email runs the unified invitation pipeline (`invited`),
	 * which pre-creates the pending user and delivers the email unless
	 * `sendInvites` is false. A failed row is reported and the rest still
	 * run — the organization itself is never rolled back.
	 */
	async createOrganization(
		headers: Headers,
		input: TCreateOrganization & { creatorUserId?: string },
		actor?: TActor,
		creatorEmail?: string,
	): Promise<TCreateOrganizationResult> {
		const created = await this.gateway.createOrganization({
			name: input.name,
			slug: input.slug,
			logo: input.logo ?? undefined,
			metadata: input.metadata ?? undefined,
			userId: input.creatorUserId,
			headers,
		});
		await this.provisionRoles(created.id);
		const row = await this.repository.findById(created.id);
		if (!row) throw new OrganizationNotFoundError();

		// Fire-and-forget DiceBear fallback logo: skipped by the worker when
		// the client already uploaded a real logo, or the org got deleted.
		await dispatchOrgLogoGeneration({ id: row.id, slug: row.slug }).catch(
			(error) =>
				console.error('[organization] logo dispatch failed', row.id, error),
		);

		const members: TCreateOrganizationResult['members'] = [];
		for (const user of input.users ?? []) {
			members.push(
				await this.attachCreateUser(row.id, user, {
					actor,
					creatorEmail,
					sendInvites: input.sendInvites !== false,
				}).catch((error: unknown) => ({
					email: user.email,
					status: 'failed' as const,
					error: error instanceof Error ? error.message : String(error),
				})),
			);
		}

		return {
			organization: {
				id: row.id,
				name: row.name,
				slug: row.slug,
				logo: row.logo ?? null,
			},
			members,
		};
	}

	/**
	 * Attaches one nested user to a freshly created organization: existing
	 * active user → direct membership through the auth gateway (`added`);
	 * otherwise → the unified invitation pipeline (`invited`), which
	 * pre-creates the pending user and (unless `sendInvites` is false)
	 * delivers the email. The creator's own email is skipped: the creator
	 * already became owner at organization creation.
	 */
	private async attachCreateUser(
		organizationId: string,
		user: { email: string; name: string; roles: TMemberRole[] },
		context: {
			actor?: TActor;
			creatorEmail?: string;
			sendInvites: boolean;
		},
	): Promise<TCreateOrganizationResult['members'][number]> {
		if (
			context.creatorEmail &&
			user.email.toLowerCase() === context.creatorEmail.toLowerCase()
		) {
			return { email: user.email, status: 'skipped', reason: 'creator' };
		}
		if (!context.actor) {
			return {
				email: user.email,
				status: 'skipped',
				reason: 'no actor context',
			};
		}
		const activeUser = await this.users.findActiveByEmail(user.email);
		if (activeUser) {
			const member = await this.gateway.addMember({
				organizationId,
				userId: activeUser.id,
				roles: user.roles,
			});
			return { email: user.email, status: 'added', memberId: member.id };
		}
		const result = await this.invitations.invite(
			{
				email: user.email,
				name: user.name,
				organizationId,
				organizationRoles: user.roles,
			},
			context.actor,
			context.sendInvites,
		);
		return {
			email: user.email,
			status: 'invited',
			invitationId: result.invitation.id,
		};
	}

	/**
	 * Verifies the closed organization-role enum type for a new organization.
	 *
	 * @remarks
	 * Best-effort by design: a failure here must not orphan an organization
	 * that Better Auth has already created. Roles are a closed enum; the
	 * guardian seeder only ensures the Postgres enum type
	 * `auth.organization_role` exists and carries every catalog value.
	 */
	private async provisionRoles(organizationId: string): Promise<void> {
		try {
			await seedOrganizationRoles();
		} catch (error) {
			console.error(
				`[organization] role enum provisioning failed for ${organizationId}`,
				error,
			);
		}
	}

	/**
	 * Paginated organization listing (soft-deleted excluded unless asked).
	 */
	async listOrganizations(
		request: TOrganizationPaginationRequest,
	): Promise<TPaginationResult<TOrganizationWithCounts>> {
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
	 *
	 * @param headers - Caller headers, used to release a session pinned to
	 * the deleted organization
	 *
	 * @throws LastOrganizationError when this is the final live organization
	 *
	 * @remarks
	 * Because the delete is soft, Better Auth's own `deleteOrganization`
	 * never runs — and that is the endpoint which clears a session's
	 * `activeOrganizationId`. Members left pointing at a soft-deleted
	 * organization would 403 on every organization-scoped route with no
	 * recovery path, so the caller's active organization is unset here. Other
	 * members are released on their next session creation
	 * (`sessionAutoActivateOrganizationHook`).
	 */
	async deleteOrganization(
		headers: Headers,
		organizationId: string,
	): Promise<void> {
		const row = await this.ensureActive(organizationId);
		if ((await this.repository.countActive()) <= 1) {
			throw new LastOrganizationError();
		}
		await this.repository.softDelete(row.id);
		// Best-effort: a failure here must not resurrect the deleted row.
		if (headers.get('cookie')) {
			await this.gateway.setActive(headers, null).catch(() => undefined);
		}
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
		await this.repository.restore(row.id);
	}

	/**
	 * Replaces (or, with `null`, removes) the organization profile image.
	 * The client uploads WebP; the server validates magic bytes and size and
	 * stores the object key in `auth.organizations.logo` — presigned on read,
	 * never a stored URL (ERP-0041).
	 *
	 * @param headers - Caller headers; Better Auth enforces `organization:update`
	 * @param file - The validated WebP file, or `null` to clear the image
	 *
	 * @throws OrganizationImageInvalidError when the file is not a WebP
	 */
	async setImage(
		headers: Headers,
		organizationId: string,
		file: File | null,
	): Promise<{ id: string; imageKey: string | null }> {
		await this.ensureActive(organizationId);
		if (file && !(await isWebpBuffer(file))) {
			throw new OrganizationImageInvalidError();
		}
		let imageKey: string | null = null;
		if (file) {
			await this.storage.put(
				organizationImageObjectKey(organizationId),
				file,
				'image/webp',
			);
			imageKey = organizationImageObjectKey(organizationId);
		}
		// Direct repository write (Better Auth's logo column is mirrored by
		// this module's read path; no caller-session mutation is needed).
		await this.repository.setLogo(organizationId, imageKey);
		return { id: organizationId, imageKey };
	}

	/**
	 * Presigned GET URL of the organization profile image, or `null` when
	 * none was uploaded yet.
	 */
	async getImage(organizationId: string): Promise<string | null> {
		const row = await this.ensureActive(organizationId);
		return row.logo ? presignObjectUrl(row.logo) : null;
	}

	/**
	 * Role string of a user's membership, or `null` when not a member.
	 *
	 * @remarks
	 * Exported for other modules' record rules (ADR-0011 step 3b: a lead may
	 * only be assigned to a member of the caller's organization).
	 */
	getMemberRole(organizationId: string, userId: string): Promise<string | null> {
		return this.repository.findMemberRole(organizationId, userId);
	}

	/**
	 * Paginated member list joined with user identity fields.
	 *
	 * @remarks
	 * `user.image` stores an S3 object key, never a URL — remapped to a
	 * short-lived presigned GET URL here (same convention as
	 * `UserService.withPresignedAvatar`), so the browser can actually load
	 * the avatar.
	 */
	async listMembers(
		organizationId: string,
		request: TMemberPaginationRequest,
	): Promise<TPaginationResult<TOrganizationMember>> {
		const page = await this.repository.paginateMembers(organizationId, request);
		return {
			...page,
			data: page.data.map((member) => ({
				...member,
				user: member.user
					? {
							...member.user,
							image: member.user.image ? presignObjectUrl(member.user.image) : null,
						}
					: null,
			})),
		};
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
			roles: input.roles,
		});
	}

	/**
	 * Changes a member's roles through the Better Auth gateway (full
	 * comma-joined overwrite).
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
	): Promise<{ id: string; role: string }> {
		await this.ensureActive(organizationId);
		const member = await this.repository.findMemberById(organizationId, memberId);
		if (!member) throw new MemberNotFoundError();
		if (this.isOwner(member.role) && !input.roles.includes('owner')) {
			await this.ensureNotLastOwner(organizationId, memberId);
		}
		const joined = input.roles.join(',');
		const result = await this.gateway.updateMemberRole(headers, {
			organizationId,
			memberId,
			role: joined,
		});
		return { id: result.member.id, role: joined };
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
	LastOrganizationError,
	LastOwnerError,
	MemberNotFoundError,
	OrganizationAlreadyDeletedError,
	OrganizationNotFoundError,
	OrganizationNotDeletedError,
	OrganizationSlugTakenError,
};
export type { TGatewayFullOrganization };
