import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type { TAdminUser, TUserQuery } from '../contracts/admin.contract';
import {
	ROLE_REPOSITORY_TOKEN,
	USER_MANAGEMENT_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IUserManagementRepository } from '../contracts/repositories.interface';
import type { IUserManagementAuthGateway } from '../contracts/gateways.interface';
import type { IRoleRepository } from '../contracts/repositories.interface';
import { AUDIT_SERVICE_TOKEN } from '../../audit/constants/di';
import type { AuditService } from '../../audit/services/audit.service';
import { presignObjectUrl } from '@providers/s3/s3';
import type { TActor } from './invitation.service';
import {
	RankGuardError,
	UserNotFoundError,
	UserStateError,
} from './invitation.errors';

/**
 * Account lifecycle administration (phase 4).
 *
 * @remarks
 * Deactivate keeps every membership but revokes all sessions (locked
 * decision D9); restore brings the full context back. Soft delete hides the
 * account and also kills its sessions. All three are audited.
 *
 * Authorization is the caller's responsibility (the controller's `erp`
 * guard), except the rank guard which is enforced here because it depends on
 * the target user's highest organization rank.
 */
@injectable()
export class UserAdminService {
	constructor(
		@inject(USER_MANAGEMENT_REPOSITORY_TOKEN)
		private readonly users: IUserManagementRepository,
		@inject(USER_MANAGEMENT_AUTH_GATEWAY_TOKEN)
		private readonly gateway: IUserManagementAuthGateway,
		@inject(ROLE_REPOSITORY_TOKEN)
		private readonly roles: IRoleRepository,
		@inject(AUDIT_SERVICE_TOKEN) private readonly audit: AuditService,
	) {}

	/**
	 * Lists users with their active organization memberships.
	 *
	 * @param query validated listing filters
	 */
	async list(query: TUserQuery): Promise<TPaginationResult<TAdminUser>> {
		const result = await this.users.listUsers({
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
	 * @throws RankGuardError when the target outranks the caller in any org
	 */
	async deactivate(
		userId: string,
		callerRank: number,
		actor: TActor,
	): Promise<void> {
		const user = await this.requireUser(userId);
		if (user.status !== 'active') {
			throw new UserStateError();
		}

		await this.assertNotOutranking(userId, callerRank);

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
	 * @throws RankGuardError when the target outranks the caller in any org
	 */
	async remove(
		userId: string,
		callerRank: number,
		actor: TActor,
	): Promise<void> {
		const user = await this.requireUser(userId);
		await this.assertNotOutranking(userId, callerRank);

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

	/** Loads a live (or, with `includeDeleted`, any) user row. */
	private async requireUser(userId: string, includeDeleted = false) {
		const user = includeDeleted
			? await this.users.findAnyById(userId)
			: await this.users.findById(userId);
		if (!user) throw new UserNotFoundError(userId);
		return user;
	}

	/**
	 * Escalation guard for user lifecycle actions: the caller can never
	 * deactivate or delete someone who holds a role ranked at or above their
	 * own in any organization.
	 *
	 * @throws RankGuardError when the target outranks the caller
	 */
	private async assertNotOutranking(
		userId: string,
		callerRank: number,
	): Promise<void> {
		const memberships = await this.users.listMemberships(userId);

		for (const membership of memberships) {
			const role = await this.roles.findByName(
				membership.id,
				membership.role,
			);
			if (role && role.rank >= callerRank) {
				throw RankGuardError.targetTooHigh(role.name, role.rank);
			}
		}
	}
}
