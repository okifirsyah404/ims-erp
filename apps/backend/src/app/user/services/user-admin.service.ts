import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type { TAdminUser, TUserQuery } from '../contracts/admin.contract';
import {
	USER_MANAGEMENT_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
	ORGANIZATION_MEMBER_ROLE_TOKEN,
} from '../constants/di';
import type { IOrganizationMemberRolePort } from '../contracts/organization-member-role.port';
import type { IUserManagementRepository } from '../contracts/user-management.repository.interface';
import type { IUserManagementAuthGateway } from '../contracts/user-management-auth.gateway.interface';
import { AUDIT_SERVICE_TOKEN } from '../../audit/constants/di';
import type { AuditService } from '../../audit/services/audit.service';
import { presignObjectUrl } from '@providers/s3/s3';
import type { TActor } from './invitation.service';
import {
	UserNotFoundError,
	UserStateError,
} from '../errors/invitation.errors';

/**
 * Account lifecycle administration (phase 4).
 *
 * @remarks
 * Deactivate keeps every membership but revokes all sessions (locked
 * decision D9); restore brings the full context back. Soft delete hides the
 * account and also kills its sessions. All three are audited.
 *
 * Authorization is the caller's responsibility (the controller's `erp`
 * guard with its `member:update`/`member:delete` permission — granted only
 * to `owner` and `admin` in the shared `erpRoleGrants` catalog). There is no
 * numeric rank guard: roles are a closed enum with explicit permission
 * grants, so permissions alone decide who may act on whom.
 */
@injectable()
export class UserAdminService {
	constructor(
		@inject(USER_MANAGEMENT_REPOSITORY_TOKEN)
		private readonly users: IUserManagementRepository,
		@inject(USER_MANAGEMENT_AUTH_GATEWAY_TOKEN)
		private readonly gateway: IUserManagementAuthGateway,
		@inject(AUDIT_SERVICE_TOKEN) private readonly audit: AuditService,
		/** Cross-module producer entry point (M12-14); `user` owns no membership table. */
		@inject(ORGANIZATION_MEMBER_ROLE_TOKEN)
		private readonly memberRoles: IOrganizationMemberRolePort,
	) {}

	/**
	 * Lists users with their active organization memberships.
	 *
	 * @param query validated listing filters
	 */
	async list(query: TUserQuery): Promise<TPaginationResult<TAdminUser>> {
		const result = await this.users.paginateUsers({
			status: query.status,
			role: query.role,
			search: query.search,
			includeDeleted: query.includeDeleted,
			organizationId: query.organizationId,
			sortBy: query.sortBy,
			sortDir: query.sortDir,
			page: query.page,
			limit: query.limit,
		});

		return {
			data: result.data.map((row) => ({
				id: row.user.id,
				name: row.user.name,
				email: row.user.email,
				username: row.user.username,
				displayUsername: row.user.displayUsername,
				phone: row.user.phone,
				// `image` stores an S3 object key, never a URL — remap to a
				// short-lived presigned URL so the browser can actually load
				// it (same convention as `UserService.withPresignedAvatar`).
				// A raw key as <img src> fails and the UI falls back to
				// initials.
				image: row.user.image
					? presignObjectUrl(row.user.image)
					: null,
				role: row.user.role,
				status: row.user.status,
				banned: row.user.banned,
				createdAt: row.user.createdAt,
				deletedAt: row.user.deletedAt,
				joinedAt: row.user.claimedAt,
				organizations: row.organizations,
			})),
			meta: result.meta,
		};
	}

	/**
	 * Deactivates an account: status `deactivated` + every session revoked.
	 *
	 * @throws UserStateError when the account is not active
	 */
	async deactivate(userId: string, actor: TActor): Promise<void> {
		const user = await this.requireUser(userId);
		if (user.status !== 'active') {
			throw new UserStateError();
		}

		await this.users.setStatus(userId, 'deactivated');
		await this.gateway.revokeSessions(userId);

		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'user.deactivated',
			targetType: 'user',
			targetId: userId,
			meta: { email: user.email },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
	}

	/**
	 * Restores a deactivated or soft-deleted account to `active`.
	 *
	 * @throws UserStateError when the account is already active
	 */
	async restore(userId: string, actor: TActor): Promise<void> {
		const user = await this.requireUser(userId, true);
		if (user.deletedAt) {
			// Reuse the invite-path restore (clears deletedAt) then activate.
			await this.users.restore(userId);
		} else if (user.status === 'active') {
			throw UserStateError.alreadyActive();
		}

		await this.users.reactivate(userId);

		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'user.restored',
			targetType: 'user',
			targetId: userId,
			meta: { email: user.email },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
	}

	/**
	 * Soft-deletes an account and revokes its sessions.
	 *
	/** Soft-deletes an account and revokes its sessions. */
	async remove(userId: string, actor: TActor): Promise<void> {
		const user = await this.requireUser(userId);

		await this.users.delete(userId);
		await this.gateway.revokeSessions(userId);

		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'user.deleted',
			targetType: 'user',
			targetId: userId,
			meta: { email: user.email },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
	}

	/**
	 * Replaces a user's organization roles (M12-14, KF-R1).
	 *
	 * @param userId - The member's user id
	 * @param organizationId - The organization the membership belongs to
	 * @param roles - The complete new role list
	 * @param actor - Audit actor (the caller), never client input
	 * @param assignment - Caller's role tier, from the guard-resolved session
	 *
	 * @remarks
	 * The membership lives in `auth.members`, owned by the organization
	 * module, so the write goes through
	 * {@link IOrganizationMemberRolePort} — the same service the
	 * organization's own member edit calls, which keeps the role-tier ladder
	 * and the last-owner guard in one place. Audited as `member.roleChanged`.
	 */
	async updateRoles(
		userId: string,
		organizationId: string,
		roles: string[],
		actor: TActor,
		assignment: { callerRoles: readonly string[]; isPlatformAdmin: boolean },
		headers: Headers,
	): Promise<{ id: string; role: string }> {
		const user = await this.requireUser(userId);
		const result = await this.memberRoles.updateRolesByUser({
			headers,
			organizationId,
			userId,
			roles,
			callerRoles: assignment.callerRoles,
			isPlatformAdmin: assignment.isPlatformAdmin,
		});

		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'member.roleChanged',
			targetType: 'user',
			targetId: userId,
			meta: { email: user.email, organizationId, roles: result.role },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});

		return result;
	}

	/** Loads a live (or, with `includeDeleted`, any) user row. */
	private async requireUser(userId: string, includeDeleted = false) {		const user = includeDeleted
			? await this.users.findAnyById(userId)
			: await this.users.findById(userId);
		if (!user) throw new UserNotFoundError(userId);
		return user;
	}
}
