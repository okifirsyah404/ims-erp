import type { TMemberRole } from './organization.contract';

/**
 * Organization as returned by the Better Auth gateway (server-side shape).
 */
export type TGatewayOrganization = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
	deletedAt: Date | null;
};

/**
 * Full organization payload from `auth.api.getFullOrganization` (includes
 * the member list).
 */
export type TGatewayFullOrganization = TGatewayOrganization & {
	members: Array<{
		id: string;
		userId: string;
		role: string;
		createdAt: Date;
		user?: { name: string; email: string; image?: string | null } | null;
	}>;
};

/**
 * Port to the Better Auth organization API.
 *
 * @remarks
 * All membership and organization-profile mutations stay inside Better Auth;
 * this class only forwards parsed input and translates `APIError`s into
 * module domain errors. Endpoints with `requireHeaders` run Better Auth's
 * own organization-authorization check against the caller's session, so the
 * caller's request headers are forwarded unchanged. The organization module's
 * repository keeps the only direct write to `deletedAt`.
 */
export interface IOrganizationAuthGateway {
	/** Server-side create (also stamps the creator as a member). */
	createOrganization(input: {
		name: string;
		slug: string;
		logo?: string | null;
		metadata?: Record<string, unknown>;
		/** Creator to add as a member; `role` applies to that membership. */
		userId?: string;
		role?: TMemberRole;
	}): Promise<TGatewayOrganization>;

	/** Requires caller headers (Better Auth checks `organization:update`). */
	updateOrganization(
		headers: Headers,
		input: {
			organizationId: string;
			data: { name?: string; logo?: string | null; metadata?: Record<string, unknown> };
		},
	): Promise<TGatewayOrganization>;

	/** Full organization incl. members; Better Auth checks membership. */
	getFullOrganization(
		headers: Headers,
		organizationId: string,
	): Promise<TGatewayFullOrganization>;

	/** Direct member add by userId (no invitation round-trip). */
	addMember(input: {
		organizationId: string;
		userId: string;
		role: TMemberRole;
	}): Promise<{ id: string }>;

	/** Requires caller headers (Better Auth checks `member:update`). */
	updateMemberRole(
		headers: Headers,
		input: { organizationId: string; memberId: string; role: TMemberRole },
	): Promise<{ member: { id: string; role: string } }>;

	/** Requires caller headers (Better Auth checks `member:delete`). */
	removeMember(
		headers: Headers,
		input: { organizationId: string; memberIdOrEmail: string },
	): Promise<void>;
}
