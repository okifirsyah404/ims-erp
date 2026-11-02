import { inject, injectable } from 'tsyringe';
import type { TRoleSelect } from '@drizzle/schemas/role.schema';
import {
	builtInOrgStatements,
	erpStatements,
	portalStatements,
} from '@ims-erp/common';
import type {
	TCreateRole,
	TPermissionGrant,
	TUpdateRole,
} from '../contracts/admin.contract';
import {
	AUDIT_SERVICE_TOKEN,
	ROLE_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IRoleRepository } from '../contracts/repositories.interface';
import {
	InvalidPermissionGrantError,
	RankGuardError,
	RoleInUseError,
	RoleNameTakenError,
	RoleNotFoundError,
} from './invitation.errors';
import type { AuditService } from './audit.service';
import type { TActor } from './invitation.service';

/** Role row joined with the live member count (delete guard display). */
export type TRoleWithUsage = TRoleSelect & { memberCount: number };

/**
 * Every resource/action pair the shared catalog knows about. Grants are
 * validated against this map so a typo can never reach `auth.roles` and
 * silently deny (or accidentally allow) an operation later.
 */
const CATALOG: Record<string, readonly string[]> = {
	...builtInOrgStatements,
	...erpStatements,
	...portalStatements,
};

/**
 * Per-organization role management (phase 4).
 *
 * @remarks
 * Enforces locked decision D5 (escalation guard) on every write:
 * - A caller may only create/update/delete roles ranked strictly BELOW their
 *   own highest rank in the organization.
 * - Seeded system roles (`isSystem`) cannot be deleted; their permissions
 *   stay editable by the owner.
 * - A role still held by live members cannot be deleted.
 *
 * All authorization data comes from the validated ERP context; nothing here
 * trusts client-supplied roles or ranks beyond the validated request body.
 */
@injectable()
export class RoleManagementService {
	constructor(
		@inject(ROLE_REPOSITORY_TOKEN)
		private readonly roleRepository: IRoleRepository,
		@inject(AUDIT_SERVICE_TOKEN) private readonly audit: AuditService,
	) {}

	/**
	 * Lists an organization's roles with live member counts.
	 *
	 * @param organizationId validated org context
	 * @param includeDeleted surface soft-deleted roles (admin triage)
	 */
	async list(
		organizationId: string,
		includeDeleted = false,
	): Promise<TRoleWithUsage[]> {
		const rows = await this.roleRepository.list({
			organizationId,
			includeDeleted,
		});
		return Promise.all(
			rows.map(async (role) => ({
				...role,
				memberCount: await this.roleRepository.countMembers(
					organizationId,
					role.name,
				),
			})),
		);
	}

	/**
	 * Creates a custom role below the caller's rank.
	 *
	 * @param input validated body
	 * @param callerRank highest rank the caller holds in this organization
	 */
	async create(
		input: TCreateRole,
		callerRank: number,
		actor: TActor,
	): Promise<TRoleWithUsage> {
		this.assertBelowRank(input.rank, callerRank);

		const existing = await this.roleRepository.findByName(
			input.organizationId,
			input.name,
		);
		if (existing) throw new RoleNameTakenError(input.name);

		const permissions = this.validateGrant(
			input.permissions,
			`Role "${input.name}"`,
		);

		// A soft-deleted role with this name is revived rather than colliding
		// with the partial unique index.
		const deleted = await this.roleRepository.findByNameIncludingDeleted(
			input.organizationId,
			input.name,
		);
		const role = deleted
			? await this.roleRepository
					.update(deleted.id, {
						rank: input.rank,
						permissions,
					})
					.then(async (row) => {
						await this.roleRepository.undelete(deleted.id);
						return row;
					})
			: await this.roleRepository.create({
					organizationId: input.organizationId,
					name: input.name,
					rank: input.rank,
					permissions,
					isSystem: false,
				});

		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'role.created',
			targetType: 'role',
			targetId: role.id,
			organizationId: input.organizationId,
			meta: { name: input.name, rank: input.rank },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});

		return { ...role, memberCount: 0 };
	}

	/**
	 * Updates a role's name, rank or grants.
	 *
	 * @throws RankGuardError when either the current or the new rank is at or
	 * above the caller's rank
	 */
	async update(
		roleId: string,
		organizationId: string,
		patch: TUpdateRole,
		callerRank: number,
		actor: TActor,
	): Promise<TRoleWithUsage> {
		const role = await this.requireRole(roleId, organizationId);
		this.assertBelowRank(role.rank, callerRank);
		if (patch.rank !== undefined) this.assertBelowRank(patch.rank, callerRank);

		if (patch.name && patch.name !== role.name) {
			const clash = await this.roleRepository.findByName(
				organizationId,
				patch.name,
			);
			if (clash) throw new RoleNameTakenError(patch.name);
		}

		const permissions = patch.permissions
			? this.validateGrant(patch.permissions, `Role "${role.name}"`)
			: undefined;

		const updated = await this.roleRepository.update(roleId, {
			name: patch.name,
			rank: patch.rank,
			permissions,
		});

		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'role.updated',
			targetType: 'role',
			targetId: roleId,
			organizationId,
			meta: {
				before: { name: role.name, rank: role.rank },
				after: { name: updated.name, rank: updated.rank },
			},
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});

		return {
			...updated,
			memberCount: await this.roleRepository.countMembers(
				organizationId,
				updated.name,
			),
		};
	}

	/**
	 * Soft-deletes a custom role.
	 *
	 * @throws RoleInUseError when the role is a seeded system role or live
	 * members still hold it
	 */
	async remove(
		roleId: string,
		organizationId: string,
		callerRank: number,
		actor: TActor,
	): Promise<void> {
		const role = await this.requireRole(roleId, organizationId);
		this.assertBelowRank(role.rank, callerRank);

		if (role.isSystem) {
			throw RoleInUseError.system(role.name);
		}

		const holders = await this.roleRepository.countMembers(
			organizationId,
			role.name,
		);
		if (holders > 0) {
			throw RoleInUseError.heldBy(role.name, holders);
		}

		await this.roleRepository.softDelete(roleId);

		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'role.deleted',
			targetType: 'role',
			targetId: roleId,
			organizationId,
			meta: { name: role.name, rank: role.rank },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
	}

	/** Loads a live role and asserts it belongs to the validated org. */
	private async requireRole(
		roleId: string,
		organizationId: string,
	): Promise<TRoleSelect> {
		const role = await this.roleRepository.findById(roleId);
		if (!role || role.organizationId !== organizationId) {
			throw new RoleNotFoundError(roleId);
		}
		return role;
	}

	/**
	 * Escalation guard: the target rank must be strictly below the caller's.
	 *
	 * @throws RankGuardError otherwise
	 */
	private assertBelowRank(targetRank: number, callerRank: number): void {
		if (targetRank >= callerRank) {
			throw new RankGuardError();
		}
	}

	/**
	 * Validates a grant against the shared catalog vocabulary.
	 *
	 * @throws InvalidPermissionGrantError on an unknown resource or action
	 */
	private validateGrant(
		grant: TPermissionGrant,
		label: string,
	): TPermissionGrant {
		const validated: TPermissionGrant = {};
		for (const [resource, actions] of Object.entries(grant)) {
			const allowed = CATALOG[resource];
			if (!allowed) {
				throw InvalidPermissionGrantError.unknownResource(label, resource);
			}
			const unique = [...new Set(actions)];
			for (const action of unique) {
				if (!allowed.includes(action)) {
					throw InvalidPermissionGrantError.unknownAction(
						label,
						resource,
						action,
					);
				}
			}
			if (unique.length > 0) validated[resource] = unique;
		}
		return validated;
	}
}
