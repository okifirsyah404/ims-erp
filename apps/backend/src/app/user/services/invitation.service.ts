import { inject, injectable } from 'tsyringe';
import { runWithEndpointContext } from '@better-auth/core/context';
import type { TUserInvitationSelect } from '@drizzle/schemas/role.schema';
import type { TPaginationResult } from '@ims-erp/common';
import {
	INVITATION_MAILER_TOKEN,
	INVITATION_REPOSITORY_TOKEN,
	ORGANIZATION_SLUG_RESOLVER_TOKEN,
	USER_MANAGEMENT_AUTH_GATEWAY_TOKEN,
	USER_MANAGEMENT_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IOrganizationSlugResolverPort } from '../contracts/organization-slug-resolver.port';
import { dispatchAvatarGeneration } from '../queues/avatar.queue';
import type {
	IInvitationRepository,
	TInvitationListRequest,
} from '../contracts/invitation.repository.interface';
import type { IUserManagementRepository } from '../contracts/user-management.repository.interface';
import type { TClaimTarget } from '../contracts/user-management-auth.gateway.interface';
import type { IInvitationMailer } from '../contracts/invitation-mailer.gateway.interface';
import type { IUserManagementAuthGateway } from '../contracts/user-management-auth.gateway.interface';
import type { TCreateInvitationInput } from '../contracts/invitation.contract';
import { pinoLogger } from '@providers/logger/logger';
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
} from '../errors/invitation.errors';

/** Actor context extracted from the guarded request. */
export type TActor = {
	userId: string;
	email: string;
	ip?: string | null;
	userAgent?: string | null;
};

/**
 * Caller scope for id-targeted invitation actions.
 *
 * @remarks
 * Organization-scoped callers pass the organization they are acting in; the
 * service then refuses invitations owned by another organization with a 404
 * (not a 403 - probing must not reveal that the id exists). Application
 * admins omit it and keep the cross-organization reach their role implies.
 */
export type TInvitationScope = { organizationId: string };

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
		@inject(ORGANIZATION_SLUG_RESOLVER_TOKEN)
		private readonly slugResolver: IOrganizationSlugResolverPort,
		private readonly audit: AuditService,
	) {}

	/**
	 * Creates one invitation. Both paths require `name` (it prefills the
	 * pre-created user and the claim profile form). The org path also
	 * requires `organizationId`; the role is the closed-enum
	 * `organizationRole`, defaulting to `member` when omitted.
	 *
	 * Overwrite rule: a pending invitation for the same email is reused —
	 * same user row, new token, old token invalidated, counts resent. The
	 * reused row adopts the new invite's context (path, organization, role,
	 * name) so the delivered email and the membership created on claim match
	 * what the admin just submitted, not the original invite. A pending
	 * invite owned by a *different* organization is rejected instead, so one
	 * org can never hijack another org's pending invitation.
	 */
	async invite(
		input: TCreateInvitationInput,
		actor: TActor,
	): Promise<TInviteResult> {
		const isOrgPath = Boolean(
			input.organizationRole || input.organizationId || input.organizationSlug,
		);
		if (isOrgPath && !input.organizationId && !input.organizationSlug) {
			throw new InvalidInvitationError();
		}
		if (!input.name) {
			throw InvalidInvitationError.requiresName();
		}

		// Bulk-file convenience: a slug stands in for the UUID. Unknown slug
		// is a domain error so the bulk loop reports it per row.
		const organizationId = input.organizationId ?? (input.organizationSlug
			? await this.resolveSlug(input.organizationSlug)
			: undefined);

		const organizationRole = isOrgPath
			? (input.organizationRole ?? 'member')
			: null;

		// Overwrite rule: reuse the pending invitation + pre-created user.
		const existingPending = await this.invitations.findPendingByEmail(
			input.email,
		);
		if (existingPending) {
			if (
				existingPending.type === 'org' &&
				existingPending.organizationId !== organizationId
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
				// Sync context: the row must describe THIS invite, otherwise the
				// email renders the stale template and claim attaches the wrong
				// organization (or none).
				type: isOrgPath ? 'org' : 'app',
				name: input.name,
				organizationId: isOrgPath ? (organizationId ?? null) : null,
				orgRole: organizationRole,
			});
			const updated = await this.invitations.findById(existingPending.id);
			// Overwrite reuses the pre-created user row (D2): resolve it by
			// email — it is the row created by the original invite.
			const existingUser = await this.users.findByEmail(input.email);
			if (!existingUser) {
				throw ClaimStateError.invitedUserMissing();
			}
			// Keep the pending profile in sync with the new invite; a claimed
			// account is left untouched (the repository guards `pending`).
			if (existingUser.name !== input.name) {
				await this.users.renamePendingUser(existingUser.id, input.name);
			}
			// Overwritten pre-created users may predate the avatar dispatch —
			// top them up if the row has no image yet.
			await this.ensureAvatar(existingUser.id, input.name, existingUser.image);
			await this.deliver(updated!, token);
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
			await this.ensureAvatar(userId, displayName, existingAny.image);
		} else {
			userId = (
				await this.users.createPendingUser({
					name: displayName,
					email: input.email,
				})
			).id;
			await this.ensureAvatar(userId, displayName, null);
		}
		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'user.precreated',
			targetType: 'user',
			targetId: userId,
			organizationId: organizationId ?? null,
			meta: { email: input.email },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});

		const { token, tokenHash } = generateInvitationToken();
		const invitation = await this.invitations.create({
			id: crypto.randomUUID(),
			type: isOrgPath ? 'org' : 'app',
			email: input.email,
			name: input.name ?? null,
			organizationId: organizationId ?? null,
			orgRole: organizationRole,
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
			organizationId: organizationId ?? null,
			meta: { email: input.email, organizationRole },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
		await this.deliver(invitation, token);
		return { invitation, userId, overwritten: false };
	}

	/**
	 * Bulk invite: per-row isolation. Roles are the closed enum (validated by
	 * Zod at the boundary), so any row-level error fails only its row.
	 * Result order matches input order.
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
	async resend(
		invitationId: string,
		actor: TActor,
		scope?: TInvitationScope,
	): Promise<void> {
		const invitation = await this.requirePending(invitationId, scope);
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
		await this.deliver(updated!, token);
	}

	/** Cancel: pending → cancelled. Terminal states are final. */
	async cancel(
		invitationId: string,
		actor: TActor,
		scope?: TInvitationScope,
	): Promise<void> {
		const invitation = await this.requirePending(invitationId, scope);
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
	 * Rollback for an invite whose employee insert failed (ERP-0034): cancels
	 * the still-pending invitation and soft-deletes its pre-created pending
	 * user, so no orphan pending account remains. A claimed user is a real
	 * account and is never touched here.
	 */
	async rollbackPending(
		invitationId: string,
		userId: string,
		actor: TActor,
	): Promise<void> {
		const invitation = await this.invitations.findById(invitationId);
		if (!invitation || invitation.status !== 'pending') return;
		await this.invitations.markStatus(invitation.id, 'cancelled');
		const user = await this.users.findById(userId);
		if (user && user.status === 'pending') {
			await this.users.delete(user.id);
		}
		await this.audit.record({
			actorUserId: actor.userId,
			actorEmail: actor.email,
			action: 'invitation.cancelled',
			targetType: 'invitation',
			targetId: invitation.id,
			organizationId: invitation.organizationId,
			meta: { reason: 'employee_create_failed' },
			request: { ip: actor.ip, userAgent: actor.userAgent },
		});
	}

	/**
	 * Delete (wrong-email fix): only while pending. Soft-deletes the
	 * invitation AND its pre-created pending user. After claim the caller
	 * must deactivate instead — enforced here.
	 */
	async deleteUnclaimed(
		invitationId: string,
		actor: TActor,
		scope?: TInvitationScope,
	): Promise<void> {
		const invitation = await this.invitations.findById(invitationId);
		if (!invitation) throw new InvitationNotFoundError(invitationId);
		this.assertScope(invitation, scope, invitationId);
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
				organizationRole: invitation.orgRole,
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
			organizationName = await this.authGateway.attachMembership({
				userId: user.id,
				organizationId: invitation.organizationId,
				roleName: target.invitation.organizationRole ?? 'member',
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
	 * Bulk path preparation seam: rows pass through unchanged (role validity
	 * is enforced by the Zod enum at the boundary). Kept for symmetry with
	 * the single path.
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
		scope?: TInvitationScope,
	): Promise<TUserInvitationSelect> {
		const invitation = await this.invitations.findById(invitationId);
		if (!invitation) throw new InvitationNotFoundError(invitationId);
		this.assertScope(invitation, scope, invitationId);
		if (invitation.status !== 'pending') {
			throw new InvitationNotPendingError();
		}
		return invitation;
	}

	/**
	 * Resolves a bulk-file `organizationSlug` to the organization id.
	 *
	 * @throws InvalidInvitationError When no live organization has the slug —
	 * thrown inside the bulk loop's try, so it is reported per row.
	 */
	private async resolveSlug(slug: string): Promise<string> {
		const id = await this.slugResolver.resolveIdBySlug(slug);
		if (!id) {
			throw InvalidInvitationError.unknownOrganizationSlug(slug);
		}
		return id;
	}

	/**
	 * Organization-scope gate for id-targeted actions: an org-scoped caller
	 * may only touch invitations owned by its own organization. Reports the
	 * row as missing so a probe cannot confirm another org's invitation.
	 */
	private assertScope(
		invitation: TUserInvitationSelect,
		scope: TInvitationScope | undefined,
		invitationId: string,
	): void {
		if (scope && invitation.organizationId !== scope.organizationId) {
			throw new InvitationNotFoundError(invitationId);
		}
	}

	/**
	 * Fire-and-forget avatar generation for pre-created (pending) users.
	 * Better Auth's `user.create.after` hook only fires on `auth.api`
	 * creations, which the invitation pipeline bypasses — so invited users
	 * would otherwise never get a generated avatar and always render the
	 * fallback. Guarded on the current image key: the deterministic job id
	 * (`avatar-<userId>`) dedupes, and users that already carry an avatar
	 * (restored rows) are not re-rendered.
	 */
	private async ensureAvatar(
		userId: string,
		name: string,
		currentImage: string | null,
	): Promise<void> {
		if (currentImage) return;
		try {
			await dispatchAvatarGeneration({ id: userId, name });
		} catch (error) {
			// Mirror the hook's resilience: a queue outage never fails the
			// invite. The next resend tops the avatar up.
			pinoLogger.warn(
				{ err: error, userId },
				'[invitation] avatar dispatch failed',
			);
		}
	}

	/**
	 * Email delivery. A mailer failure flips `deliveryFailed` (visible in
	 * the pending list) but never fails the invite — resend re-delivers.
	 */
	private async deliver(
		invitation: TUserInvitationSelect,
		rawToken: string,
	): Promise<void> {
		try {
			let organizationName: string | null = null;
			let roleName: string | null = null;
			const isOrgInvite =
				invitation.type === 'org' && Boolean(invitation.organizationId);
			if (isOrgInvite && invitation.organizationId) {
				organizationName = await this.organizationNameFor(
					invitation.organizationId,
				);
				roleName = invitation.orgRole ?? null;
			}
			await this.mailer.sendInvite({
				to: invitation.email,
				name: invitation.name,
				token: rawToken,
				type: isOrgInvite ? 'org' : 'app',
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

