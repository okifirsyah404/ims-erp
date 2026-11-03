import { inject, injectable } from 'tsyringe';
import { runWithEndpointContext } from '@better-auth/core/context';
import type { TUserInvitationSelect } from '@drizzle/schemas/role.schema';
import type { TPaginationResult } from '@ims-erp/common';
import {
	INVITATION_MAILER_TOKEN,
	INVITATION_REPOSITORY_TOKEN,
	ROLE_REPOSITORY_TOKEN,
	USER_MANAGEMENT_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
} from '../constants/di';
import type {
	IInvitationRepository,
	TInvitationListRequest,
} from '../contracts/invitation.repository.interface';
import type {
	IRoleRepository,
} from '../contracts/role.repository.interface';
import type { IUserManagementRepository } from '../contracts/user-management.repository.interface';
import type { TClaimTarget } from '../contracts/user-management-auth.gateway.interface';
import type { IInvitationMailer } from '../contracts/invitation-mailer.gateway.interface';
import type { IUserManagementAuthGateway } from '../contracts/user-management-auth.gateway.interface';
import type { TCreateInvitationInput } from '../contracts/invitation.contract';
import { hashToken } from '../utils/token';
import { AuditService } from '../../audit/services/audit.service';
import {
	INVITATION_TTL_MS,
	generateInvitationToken,
	verifyToken,
} from '../utils/token';
import {
	ClaimConflictError,
	ClaimStateError,
	InvalidClaimTokenError,
	InvalidInvitationError,
	InvitationNotPendingError,
	InvitationNotFoundError,
	InvitationPendingExistsError,
	RoleNotFoundError,
} from '../errors/invitation.errors';

/** Actor context extracted from the guarded request. */
export type TActor = {
	userId: string;
	email: string;
	ip?: string | null;
	userAgent?: string | null;
};

/** Result of a single invite creation. */
export type TInviteResult = {
	invitation: TUserInvitationSelect;
	/** Created user id (pre-created pending user, possibly reused). */
	userId: string;
	/** True when an existing pending invitation was overwritten (D2 rule). */
	overwritten: boolean;
};

/** Result of a bulk invite. Per-row outcomes preserve input order. */
export type TBulkInviteResult = {
	results: Array<
		| { ok: true; row: TInviteResult }
		| { ok: false; email: string; error: string }
	>;
	succeeded: number;
	failed: number;
};

/**
 * Claim outcome: the invitation was accepted and the user has credentials.
 */
export type TClaimResult = {
	userId: string;
	/** Set-cookie header value for the post-claim auto-login session. */
	setCookie: string | null;
	/** Organization name when the invite was the org path. */
	organizationName: string | null;
};

const MAX_BULK = 100;

/**
 * Unified invitation pipeline (locked decisions D1/D2): app-admin and
 * org-admin/HR invites share one table, one claim flow. Users are
 * pre-created at invite time (`status='pending'`); resend reuses the row
 * and kills the old token; a pending duplicate email is overwritten.
 */
@injectable()
export class InvitationService {
	constructor(
		@inject(INVITATION_REPOSITORY_TOKEN)
		private readonly invitations: IInvitationRepository,
		@inject(USER_MANAGEMENT_REPOSITORY_TOKEN)
		private readonly users: IUserManagementRepository,
		@inject(USER_MANAGEMENT_AUTH_GATEWAY_TOKEN)
		private readonly authGateway: IUserManagementAuthGateway,
		@inject(INVITATION_MAILER_TOKEN)
		private readonly mailer: IInvitationMailer,
		@inject(ROLE_REPOSITORY_TOKEN)
		private readonly roles: IRoleRepository,
		private readonly audit: AuditService,
	) {}

	/**
	 * Creates one invitation. App path requires `name`; org path requires
	 * `organizationId` + `roleId` (existing role in that org's master data).
	 *
	 * Overwrite rule: a pending invitation for the same email is reused —
	 * same user row, new token, old token invalidated, counts resent.
	 */
	async invite(
		input: TCreateInvitationInput,
		actor: TActor,
	): Promise<TInviteResult> {
		const isOrgPath = Boolean(input.roleId || input.organizationId);
		if (isOrgPath && (!input.organizationId || !input.roleId)) {
			throw new InvalidInvitationError();
		}
		if (!isOrgPath && !input.name) {
			throw InvalidInvitationError.requiresName();
		}

		let roleName: string | null = null;
		if (isOrgPath) {
			// `findById` + org ownership check: the single-invite path rejects
			// typos; the bulk path falls back to `member` upstream.
			const role = await this.roles.findById(input.roleId!);
			if (!role || role.organizationId !== input.organizationId) {
				throw new RoleNotFoundError(input.roleId!);
			}
			roleName = role.name;
		}

		// Overwrite rule: reuse the pending invitation + pre-created user.
		const existingPending = await this.invitations.findPendingByEmail(
			input.email,
		);
		if (existingPending) {
			if (
				existingPending.type === 'org' &&
				existingPending.organizationId !== input.organizationId
			) {
				// Cross-org duplicate: another org's pending invite must not be
				// hijacked — reject instead of overwrite.
				throw new InvitationPendingExistsError(input.email);
			}
			const { token, tokenHash } = generateInvitationToken();
			const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
			await this.invitations.updateToken(existingPending.id, {
				tokenHash,
				expiresAt,
			});
			const updated = await this.invitations.findById(existingPending.id);
			// Overwrite reuses the pre-created user row (D2): resolve it by
			// email — it is the row created by the original invite.
			const existingUser = await this.users.findByEmail(input.email);
			if (!existingUser) {
				throw ClaimStateError.invitedUserMissing();
			}
			await this.deliver(updated!, token, actor);
			return {
				invitation: updated!,
				userId: existingUser.id,
				overwritten: true,
			};
		}

		// Pre-create the pending user (name from input; app path guarantees
		// it). If the email already exists — a previously claimed invitation,
		// or a soft-deleted wrong-email fix — reuse/restore that row instead
		// of colliding with the email unique index. A live ACTIVE user is a
		// real conflict (409); Better Auth owns no add-user-on-invite path.
		const existingAny = await this.users.findAnyByEmail(input.email);
		if (existingAny && existingAny.deletedAt === null) {
			// A live user already holds this email: either pending (harmless —
			// it is the pre-created row for the pending invitation above) or
			// active/deactivated (no new invite can be created for it).
			if (existingAny.status !== 'pending') {
				throw new InvitationPendingExistsError(input.email);
			}
		}
		let userId: string;
		const displayName = input.name ?? input.email.split('@')[0]!;
		if (existingAny) {
			// Soft-deleted user from a prior wrong-email delete: restore it.
			await this.users.restore(existingAny.id);
			userId = existingAny.id;
		} else {
			userId = (
				await this.users.createPendingUser({
					name: displayName,
					email: input.email,
				})
			).id;
		}
		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'user.precreated',
			targetType: 'user',
			targetId: userId,
			organizationId: input.organizationId ?? null,
			meta: { email: input.email },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});

		const { token, tokenHash } = generateInvitationToken();
		const invitation = await this.invitations.create({
			id: crypto.randomUUID(),
			type: isOrgPath ? 'org' : 'app',
			email: input.email,
			name: input.name ?? null,
			organizationId: input.organizationId ?? null,
			roleId: input.roleId ?? null,
			tokenHash,
			invitedBy: actor.userId,
			expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
		});

		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'invitation.sent',
			targetType: 'invitation',
			targetId: invitation.id,
			organizationId: input.organizationId ?? null,
			meta: { email: input.email, roleName },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
		await this.deliver(invitation, token, actor);
		return { invitation, userId, overwritten: false };
	}

	/**
	 * Bulk invite: per-row isolation. A typo'd/unapproved role in an org row
	 * falls back to that org's `member` role (locked decision); other errors
	 * fail only their row. Result order matches input order.
	 */
	async inviteBulk(
		inputs: TCreateInvitationInput[],
		actor: TActor,
	): Promise<TBulkInviteResult> {
		if (inputs.length > MAX_BULK) {
			throw InvalidInvitationError.bulkLimited(MAX_BULK);
		}
		const results: TBulkInviteResult['results'] = [];
		for (const input of inputs) {
			try {
				const prepared = await this.prepare(input);
				results.push({ ok: true, row: await this.invite(prepared, actor) });
			} catch (error) {
				// Bulk role fallback: unknown role in an org row → member.
				if (input.roleId && input.organizationId && isRoleNotFound(error)) {
					const memberRole =
						await this.roles.findMemberRole(input.organizationId);
					if (memberRole) {
						try {
							results.push({
								ok: true,
								row: await this.invite(
									{ ...input, roleId: memberRole.id },
									actor,
								),
							});
							continue;
						} catch (fallbackError) {
							results.push({
								ok: false,
								email: input.email,
								error: String(fallbackError),
							});
							continue;
						}
					}
				}
				results.push({
					ok: false,
					email: input.email,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		return {
			results,
			succeeded: results.filter((r) => r.ok).length,
			failed: results.filter((r) => !r.ok).length,
		};
	}

	list(
		request: TInvitationListRequest,
	): Promise<TPaginationResult<TUserInvitationSelect>> {
		return this.invitations.list(request);
	}

	/**
	 * Resend: new token on the SAME row (old token dies), 3-day TTL reset.
	 */
	async resend(invitationId: string, actor: TActor): Promise<void> {
		const invitation = await this.requirePending(invitationId);
		const { token, tokenHash } = generateInvitationToken();
		await this.invitations.updateToken(invitation.id, {
			tokenHash,
			expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
		});
		const updated = await this.invitations.findById(invitation.id);
		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'invitation.resent',
			targetType: 'invitation',
			targetId: invitation.id,
			organizationId: invitation.organizationId,
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
		await this.deliver(updated!, token, actor);
	}

	/** Cancel: pending → cancelled. Terminal states are final. */
	async cancel(invitationId: string, actor: TActor): Promise<void> {
		const invitation = await this.requirePending(invitationId);
		await this.invitations.markStatus(invitation.id, 'cancelled');
		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'invitation.cancelled',
			targetType: 'invitation',
			targetId: invitation.id,
			organizationId: invitation.organizationId,
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
	}

	/**
	 * Delete (wrong-email fix): only while pending. Soft-deletes the
	 * invitation AND its pre-created pending user. After claim the caller
	 * must deactivate instead — enforced here.
	 */
	async deleteUnclaimed(invitationId: string, actor: TActor): Promise<void> {
		const invitation = await this.invitations.findById(invitationId);
		if (!invitation) throw new InvitationNotFoundError(invitationId);
		if (invitation.status !== 'pending') {
			throw InvitationNotPendingError.claimed();
		}
		const user = await this.users.findByEmail(invitation.email);
		await this.invitations.delete(invitation.id);
		if (user && user.status === 'pending') {
			await this.users.delete(user.id);
		}
		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'invitation.deleted',
			targetType: 'invitation',
			targetId: invitation.id,
			organizationId: invitation.organizationId,
			meta: { email: invitation.email, userDeleted: user?.status === 'pending' },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
	}

	/**
	 * Validates a raw claim token (timing-safe hash compare) and returns the
	 * claim target. Expiry is enforced here, not trusted from the row.
	 */
	async resolveClaimToken(rawToken: string): Promise<TClaimTarget> {
		const invitation = await this.invitations.findByTokenHash(
			hashToken(rawToken),
		);
		if (!invitation) throw new InvalidClaimTokenError();
		if (invitation.status !== 'pending') {
			throw invitation.status === 'accepted'
				? InvalidClaimTokenError.alreadyUsed()
				: InvalidClaimTokenError.inactive();
		}
		if (invitation.expiresAt.getTime() < Date.now()) {
			throw InvalidClaimTokenError.expired();
		}
		if (!verifyToken(rawToken, invitation.tokenHash)) {
			throw new InvalidClaimTokenError();
		}
		const user = await this.users.findById(
			(await this.userIdFor(invitation)) ?? '',
		);
		if (!user) throw new ClaimStateError();
		if (user.status !== 'pending') {
			throw ClaimStateError.alreadyActive();
		}
		return {
			invitation: {
				id: invitation.id,
				type: invitation.type,
				organizationId: invitation.organizationId,
				roleId: invitation.roleId,
			},
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				status: user.status,
			},
		};
	}

	/**
	 * Claim (form 1): sets credentials via Better Auth, stamps phone +
	 * `active`, accepts the invitation, creates the org membership for org
	 * invites, and opens a session (option A: profile form follows login).
	 *
	 * Availability of username/phone is re-checked server-side right before
	 * the credential write.
	 */
	async claim(
		rawToken: string,
		input: { username: string; password: string; phone: string },
		headers: Headers,
	): Promise<TClaimResult> {
		const target = await this.resolveClaimToken(rawToken);
		const { invitation, user } = target;

		if (!(await this.users.isUsernameAvailable(input.username))) {
			throw new ClaimConflictError();
		}
		if (!(await this.users.isPhoneAvailable(input.phone))) {
			throw ClaimConflictError.phoneInUse();
		}

		await this.authGateway.claimCredentials({
			userId: user.id,
			username: input.username,
			password: input.password,
		});

		await this.users.setClaimed(user.id, { phone: input.phone });

		// Org path: attach membership with the invited role BEFORE accepting
		// the invitation — a failed attach leaves the claim retryable (the
		// user is active but the invitation stays pending).
		let organizationName: string | null = null;
		if (invitation.type === 'org' && invitation.organizationId) {
			const role = invitation.roleId
				? await this.roles.findById(invitation.roleId)
				: await this.roles.findMemberRole(invitation.organizationId);
			organizationName = await this.authGateway.attachMembership({
				userId: user.id,
				organizationId: invitation.organizationId,
				roleName: role?.name ?? 'member',
			});
		}

		await this.invitations.markStatus(invitation.id, 'accepted', new Date());

		const { setCookie } = await this.authGateway.createSession(user.id, {
			password: input.password,
		}, headers);

		return { userId: user.id, setCookie, organizationName };
	}

	/** Marks delivery failure surfaced in the admin pending list. */
	async markDeliveryFailed(invitationId: string): Promise<void> {
		await this.invitations.setDeliveryFailed(invitationId, true);
	}

	// -- internals ------------------------------------------------------------

	/**
	 * Bulk path preparation: for org rows with an unknown role id, fall back
	 * to the org's `member` role. Single rows pass through unchanged (the
	 * strict error is desired there).
	 */
	private async prepare(
		input: TCreateInvitationInput,
	): Promise<TCreateInvitationInput> {
		// Kept as a seam: single rows pass through unchanged (strict role
		// errors are desired); the bulk path applies the member fallback
		// around invite() itself.
		return input;
	}

	private async requirePending(
		invitationId: string,
	): Promise<TUserInvitationSelect> {
		const invitation = await this.invitations.findById(invitationId);
		if (!invitation) throw new InvitationNotFoundError(invitationId);
		if (invitation.status !== 'pending') {
			throw new InvitationNotPendingError();
		}
		return invitation;
	}

	/**
	 * Email delivery. A mailer failure flips `deliveryFailed` (visible in
	 * the pending list) but never fails the invite — resend re-delivers.
	 */
	private async deliver(
		invitation: TUserInvitationSelect,
		rawToken: string,
		actor: TActor,
	): Promise<void> {
		try {
			let organizationName: string | null = null;
			let roleName: string | null = null;
			if (invitation.organizationId) {
				const org = await this.organizationNameFor(invitation.organizationId);
				organizationName = org;
				if (invitation.roleId) {
					roleName =
						(await this.roles.findById(invitation.roleId))?.name ??
						null;
				}
			}
			await this.mailer.sendInvite({
				to: invitation.email,
				name: invitation.name,
				token: rawToken,
				organizationName,
				roleName,
				expiresAt: invitation.expiresAt,
			});
		} catch {
			await this.invitations.setDeliveryFailed(invitation.id, true);
		}
	}

	/**
	 * Resolves the pre-created user row for an invitation by email.
	 */
	private async userIdFor(
		invitation: TUserInvitationSelect,
	): Promise<string> {
		const user = await this.users.findByEmail(invitation.email);
		return user?.id ?? '';
	}

	private async organizationNameFor(
		organizationId: string,
	): Promise<string | null> {
		try {
			// Internal-adapter read: getFullOrganization requires a caller
			// session (orgSessionMiddleware), which invite-time delivery lacks.
			const { auth } = await import('@providers/better-auth/auth');
			const name = (await runWithEndpointContext(
				{ headers: new Headers(), request: new Request('http://internal/org-name'), context: {} as never } as never,
				async () => {
					const ctx = await auth.$context;
					const org = (await ctx.adapter.findOne({
						model: 'organization',
						where: [{ field: 'id', value: organizationId }],
					})) as { name?: string } | null;
					return org?.name ?? null;
				},
			)) as string | null;
			return name;
		} catch {
			return null;
		}
	}
}

function isRoleNotFound(error: unknown): boolean {
	return error instanceof Error && error.name === 'RoleNotFoundError';
}
