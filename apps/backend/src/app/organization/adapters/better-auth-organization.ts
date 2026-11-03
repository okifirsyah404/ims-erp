import { auth } from '@providers/better-auth/auth';
import { APIError } from 'better-auth/api';
import { injectable } from 'tsyringe';
import type {
	IOrganizationAuthGateway,
	TGatewayFullOrganization,
	TGatewayOrganization,
} from '../contracts/organization-auth.gateway.interface';
import type { TMemberRole } from '../contracts/organization.contract';
import {
	LastOwnerError,
	MemberNotFoundError,
	OrganizationNotFoundError,
	OrganizationSlugTakenError,
} from '../errors/organization.errors';

/**
 * Better Auth organization API implementation of
 * {@link IOrganizationAuthGateway}.
 *
 * @remarks
 * Membership and organization profile mutations stay inside Better Auth;
 * this class only forwards parsed input and translates `APIError`s into
 * module domain errors. Endpoints with `requireHeaders` run Better Auth's
 * own organization-authorization check against the caller's session, so the
 * caller's request headers are forwarded unchanged. DELETE of the
 * organization itself intentionally does NOT go through
 * `auth.api.deleteOrganization` (hard delete) — the service routes it to the
 * repository's `softDelete` instead.
 */
@injectable()
export class BetterAuthOrganizationGateway implements IOrganizationAuthGateway {
	/**
	 * Creates an organization via Better Auth.
	 *
	 * @remarks
	 * When `headers` are provided Better Auth resolves the calling session and
	 * enforces `allowUserToCreateOrganization` (application admin only, see
	 * the plugin options). It also stamps the new organization as the
	 * session's active one unless `keepCurrentActiveOrganization` is set — so
	 * a creator lands in the organization they just made.
	 *
	 * When `userId` is provided (seeder / server-side bootstrap) Better Auth
	 * treats the call as a system action: the creator gate is skipped and
	 * that user is registered as the organization's owner.
	 */
	async createOrganization(input: {
		name: string;
		slug: string;
		logo?: string | null;
		metadata?: Record<string, unknown>;
		userId?: string;
		role?: TMemberRole;
		headers?: Headers;
	}): Promise<TGatewayOrganization> {
		try {
			const organization = await auth.api.createOrganization({
				...(input.headers ? { headers: input.headers } : {}),
				body: {
					name: input.name,
					slug: input.slug,
					logo: input.logo ?? undefined,
					metadata: input.metadata,
					// Server-side creation: Better Auth adds `userId` as the
					// organization owner (implicit `role: 'owner'`).
					userId: input.userId,
				},
			});
			return this.toGatewayOrganization(organization);
		} catch (error) {
			throw this.translate(error);
		}
	}

	/**
	 * Sets (or clears) the session's active organization.
	 *
	 * @remarks
	 * `null` unsets it; Better Auth no-ops when nothing was active. Used to
	 * release callers pinned to a soft-deleted organization, which would
	 * otherwise 403 on every organization-scoped route.
	 */
	async setActive(
		headers: Headers,
		organizationId: string | null,
	): Promise<void> {
		try {
			await auth.api.setActiveOrganization({
				headers,
				body: { organizationId },
			});
		} catch (error) {
			throw this.translate(error);
		}
	}

	/**
	 * Updates an organization's profile fields via Better Auth.
	 *
	 * @remarks
	 * Forwards the caller's headers so Better Auth runs its own
	 * organization-authorization check (permission-based) before mutating.
	 */
	async updateOrganization(
		headers: Headers,
		input: {
			organizationId: string;
			data: {
				name?: string;
				logo?: string | null;
				metadata?: Record<string, unknown>;
			};
		},
	): Promise<TGatewayOrganization> {
		try {
			const organization = await auth.api.updateOrganization({
				headers,
				body: {
					organizationId: input.organizationId,
					data: input.data,
				},
			});
			if (!organization) throw new OrganizationNotFoundError();
			return this.toGatewayOrganization(organization);
		} catch (error) {
			throw this.translate(error);
		}
	}

	/**
	 * Fetches one organization with its members via Better Auth.
	 *
	 * @remarks
	 * Forwards the caller's headers for Better Auth's authorization check.
	 */
	async getFullOrganization(
		headers: Headers,
		organizationId: string,
	): Promise<TGatewayFullOrganization> {
		try {
			const organization = await auth.api.getFullOrganization({
				headers,
				query: { organizationId },
			});
			if (!organization) throw new OrganizationNotFoundError();
			return {
				...this.toGatewayOrganization(organization),
				members: (organization.members ?? []).map((member) => ({
					id: member.id,
					userId: member.userId,
					role: member.role,
					createdAt: member.createdAt,
					user: member.user
						? {
								name: member.user.name,
								email: member.user.email,
								image: member.user.image ?? null,
							}
						: null,
				})),
			};
		} catch (error) {
			throw this.translate(error);
		}
	}

	/**
	 * Adds a member via Better Auth (server-side call, no headers).
	 *
	 * @remarks
	 * Casting the role to `'owner'` is required because Better Auth's
	 * inferred endpoint type only knows the built-in literals; custom ERP
	 * roles are valid at runtime (registered via `erpRoles`).
	 */
	async addMember(input: {
		organizationId: string;
		userId: string;
		role: TMemberRole;
	}): Promise<{ id: string }> {
		try {
			const member = await auth.api.addMember({
				body: {
					organizationId: input.organizationId,
					userId: input.userId,
					// Custom ERP roles are valid at runtime (registered via
					// `erpRoles`); the inferred endpoint type only knows the
					// built-in literals, hence the cast.
					role: input.role as 'owner',
				},
			}) as unknown as { id: string };
			return { id: member.id };
		} catch (error) {
			throw this.translate(error);
		}
	}

	/**
	 * Changes a member's role via Better Auth.
	 *
	 * @remarks
	 * Forwards the caller's headers so Better Auth enforces its
	 * owner-escalation rules (cannot demote the last owner, cannot set a
	 * role above one's own).
	 */
	async updateMemberRole(
		headers: Headers,
		input: { organizationId: string; memberId: string; role: TMemberRole },
	): Promise<{ member: { id: string; role: string } }> {
		try {
			const result = (await auth.api.updateMemberRole({
				headers,
				body: {
					organizationId: input.organizationId,
					memberId: input.memberId,
					// Custom ERP role; see the note in addMember.
					role: input.role as 'owner',
				},
			})) as unknown as { id: string; role: string };
			return { member: { id: result.id, role: result.role } };
		} catch (error) {
			throw this.translate(error);
		}
	}

	/**
	 * Removes a member via Better Auth.
	 *
	 * @remarks
	 * Forwards the caller's headers so Better Auth enforces last-owner
	 * protection.
	 */
	async removeMember(
		headers: Headers,
		input: { organizationId: string; memberIdOrEmail: string },
	): Promise<void> {
		try {
			await auth.api.removeMember({
				headers,
				body: {
					organizationId: input.organizationId,
					memberIdOrEmail: input.memberIdOrEmail,
				},
			});
		} catch (error) {
			throw this.translate(error);
		}
	}

	/**
	 * Maps a raw Better Auth organization row onto the gateway contract.
	 *
	 * @remarks
	 * Normalizes `logo` to `null` and narrows untyped `metadata` to a
	 * record; `deletedAt` is surfaced read-only — all writes to it belong
	 * to the repository, never to Better Auth.
	 */
	private toGatewayOrganization(organization: {
		id: string;
		name: string;
		slug: string;
		logo?: string | null;
		metadata?: unknown;
		createdAt: Date;
		deletedAt?: Date | null;
	}): TGatewayOrganization {
		return {
			id: organization.id,
			name: organization.name,
			slug: organization.slug,
			logo: organization.logo ?? null,
			metadata:
				organization.metadata &&
				typeof organization.metadata === 'object'
					? (organization.metadata as Record<string, unknown>)
					: null,
			createdAt: organization.createdAt,
			// Soft-delete column: `input: false` keeps it out of Better Auth
			// writes; the repository owns this field.
			deletedAt: organization.deletedAt ?? null,
		};
	}

	/**
	 * Translates a thrown value from `auth.api` into a module domain error.
	 *
	 * @remarks
	 * Domain errors pass through untouched (they may originate from this
	 * class's own guard clauses). For `APIError`s the mapping is heuristic
	 * on Better Auth's message text: a 403 mentioning "owner" becomes
	 * {@link LastOwnerError}, any other 403 becomes
	 * {@link MemberNotFoundError}, and a message mentioning "slug" becomes
	 * {@link OrganizationSlugTakenError}. Everything else is rethrown
	 * as-is so unknown Better Auth failures keep their original shape.
	 */
	private translate(error: unknown): Error {
		if (error instanceof LastOwnerError) return error;
		if (error instanceof OrganizationNotFoundError) return error;
		if (error instanceof APIError) {
			const message = error.message ?? '';
			const status = error.status ?? 400;
			if (status === 403 || message.toLowerCase().includes('forbidden')) {
				// Preserve Better Auth's authorization signal as-is: the erpGuard
				// already gates these routes, so a 403 here means an org-level
				// rule (owner escalation, last-owner protection).
				if (message.toLowerCase().includes('owner')) {
					return new LastOwnerError();
				}
				return new MemberNotFoundError();
			}
			if (message.toLowerCase().includes('slug')) {
				return new OrganizationSlugTakenError();
			}
			return error;
		}
		return error instanceof Error ? error : new Error(String(error));
	}
}
