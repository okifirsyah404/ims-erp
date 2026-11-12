/**
 * Organization as returned by the Better Auth gateway (server-side shape).
 */
export type TGatewayOrganization = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	/** Optional free-text description; `null` when unset. */
	description: string | null;
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
	/**
	 * Creates an organization; the creator becomes its owner. `headers`, when
	 * present, make Better Auth resolve the session, enforce
	 * `allowUserToCreateOrganization`, and activate the new organization for
	 * that session.
	 */
	createOrganization(input: {
		name: string;
		slug: string;
		logo?: string | null;
		/** Optional free-text description. */
		description?: string;
		metadata?: Record<string, unknown>;
		/** Creator to add as owner; role applies to that membership. */
		userId?: string;
		headers?: Headers;
	}): Promise<TGatewayOrganization>;

	/** Sets or clears (`null`) the calling session's active organization. */
	setActive(headers: Headers, organizationId: string | null): Promise<void>;

	/** Requires caller headers (Better Auth checks `organization:update`). */
	updateOrganization(
		headers: Headers,
		input: {
			organizationId: string;
			data: {
				name?: string;
				logo?: string | null;
				/** `null` clears the description. */
				description?: string | null;
				metadata?: Record<string, unknown>;
			};
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
		/** Comma-joined closed ERP roles (ERP-0041 multi-role). */
		roles: string[];
	}): Promise<{ id: string }>;

	/** Requires caller headers (Better Auth checks `member:update`). */
	updateMemberRole(
		headers: Headers,
		input: { organizationId: string; memberId: string; role: string },
	): Promise<{ member: { id: string; role: string } }>;

	/** Requires caller headers (Better Auth checks `member:delete`). */
	removeMember(
		headers: Headers,
		input: { organizationId: string; memberIdOrEmail: string },
	): Promise<void>;
}
