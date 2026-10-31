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
} from '../services/organization.errors';

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
	async createOrganization(input: {
		name: string;
		slug: string;
		logo?: string | null;
		metadata?: Record<string, unknown>;
		userId?: string;
		role?: TMemberRole;
	}): Promise<TGatewayOrganization> {
		try {
			const organization = await auth.api.createOrganization({
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
