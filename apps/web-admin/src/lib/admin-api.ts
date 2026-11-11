import {
	erpRoleNames,
	type TApiPaginatedResponse,
	type TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import type { Permission } from './permissions';

/**
 * API client for the phase-4 administration endpoints: account lifecycle
 * (`/admin/users`), invitations (`/admin/invitations`) and the audit trail (`/admin/audit`).
 *
 * @remarks
 * Every request carries the `x-organization-id` header because the backend
 * guard validates membership + the static catalog permission against an
 * explicit organization context. The session cookie carries identity — no
 * token is ever read or stored by this module.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(
	path: string,
	init: RequestInit & { organizationId: string },
): Promise<TApiResponse<T>> {
	const { organizationId, ...rest } = init;
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		...rest,
		headers: {
			'x-organization-id': organizationId,
			...(rest.body != null ? { 'Content-Type': 'application/json' } : {}),
			...rest.headers,
		},
	});
	const envelope = await parseJsonEnvelope<T>(response);
	if (!response.ok) {
		throw new Error(
			envelope.errors?.[0]?.message ?? envelope.message ?? `Request failed (${response.status})`,
		);
	}
	return envelope;
}

/**
 * Reads the response as JSON, tolerating non-JSON bodies (auth redirect,
 * empty body, HTML) by returning an empty envelope so callers fall back to
 * the status-based error message instead of a cryptic JSON.parse error.
 */
async function parseJsonEnvelope<T>(
	response: Response,
): Promise<TApiResponse<T>> {
	try {
		return (await response.json()) as TApiResponse<T>;
	} catch {
		return {} as TApiResponse<T>;
	}
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type TUserStatus = 'pending' | 'active' | 'deactivated';

export type TAdminUser = {
	id: string;
	name: string;
	email: string;
	username: string | null;
	displayUsername: string | null;
	phone: string | null;
	image: string | null;
	role: string | null;
	status: TUserStatus | null;
	banned: boolean | null;
	createdAt: string;
	deletedAt: string | null;
	/**
	 * When the user joined the application (`users.claimedAt`): the moment
	 * an invited user claimed their invitation. Null for pending users.
	 */
	joinedAt: string | null;
	organizations: Array<{ id: string; name: string; role: string }>;
};

export type TUserSortField = 'name' | 'createdAt' | 'joinedAt';
export type TUserSortDirection = 'asc' | 'desc';

export type TUserListParams = {
	page?: number;
	limit?: number;
	status?: TUserStatus;
	role?: string;
	search?: string;
	includeDeleted?: boolean;
	/** Narrows the listing to users with a membership in this organization. */
	organizationId?: string;
	sortBy?: TUserSortField;
	sortDir?: TUserSortDirection;
};

export async function listUsers(organizationId: string, params: TUserListParams = {}) {
	const search = new URLSearchParams();
	if (params.page) search.set('page', String(params.page));
	if (params.limit) search.set('limit', String(params.limit));
	if (params.status) search.set('status', params.status);
	if (params.role) search.set('role', params.role);
	if (params.search) search.set('search', params.search);
	if (params.includeDeleted) search.set('includeDeleted', 'true');
	if (params.organizationId) search.set('organizationId', params.organizationId);
	if (params.sortBy) search.set('sortBy', params.sortBy);
	if (params.sortDir) search.set('sortDir', params.sortDir);
	const query = search.toString();

	const envelope = (await request<TApiUser[]>(
		`/admin/users${query ? `?${query}` : ''}`,
		{ organizationId },
	)) as TApiPaginatedResponse<TAdminUser>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

// Backend row shape shares the field names; alias kept for readability.
type TApiUser = TAdminUser;

export async function deactivateUser(organizationId: string, userId: string) {
	await request(`/admin/users/${userId}/deactivate`, {
		method: 'POST',
		organizationId,
	});
}

export async function restoreUser(organizationId: string, userId: string) {
	await request(`/admin/users/${userId}/restore`, {
		method: 'POST',
		organizationId,
	});
}

export async function deleteUser(organizationId: string, userId: string) {
	await request(`/admin/users/${userId}`, { method: 'DELETE', organizationId });
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Grant map `{ resource: action[] }` using the shared catalog vocabulary. */
// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export type TAdminAudit = {
	id: string;
	actorUserId: string;
	actorEmail: string | null;
	action: string;
	targetType: string;
	targetId: string;
	organizationId: string | null;
	meta: Record<string, unknown> | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string;
};

export type TAuditListParams = {
	page?: number;
	limit?: number;
	action?: string;
	targetType?: string;
	organizationId?: string;
	from?: string;
	to?: string;
};

export async function listAudit(
	organizationId: string,
	params: TAuditListParams = {},
) {
	const search = new URLSearchParams();
	if (params.page) search.set('page', String(params.page));
	if (params.limit) search.set('limit', String(params.limit));
	if (params.action) search.set('action', params.action);
	if (params.targetType) search.set('targetType', params.targetType);
	if (params.organizationId) search.set('organizationId', params.organizationId);
	if (params.from) search.set('from', params.from);
	if (params.to) search.set('to', params.to);
	const query = search.toString();

	const envelope = (await request<TApiAuditRow[]>(
		`/admin/audit${query ? `?${query}` : ''}`,
		{ organizationId },
	)) as TApiPaginatedResponse<TAdminAudit>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

type TApiAuditRow = TAdminAudit;

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export type TInvitationStatus = 'pending' | 'accepted' | 'cancelled' | 'expired';

/**
 * Invitation row as exposed by `GET /admin/invitations`. The raw token never
 * leaves the backend — only its hash is persisted — so this row carries the
 * expiry (`expiresAt`) the pending panel shows.
 */
export type TInvitation = {
	id: string;
	email: string;
	name: string | null;
	type: 'app' | 'org';
	status: TInvitationStatus;
	organizationId: string | null;
	/** Closed ERP organization role (org path); null on the app path. */
	organizationRole: string | null;
	invitedBy: string;
	expiresAt: string;
	acceptedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

/** Row result of bulk invite: per-row isolation (locked decision D13). */
export type TBulkInviteResult = {
	results: Array<
		| { ok: true; row: unknown }
		| { ok: false; email: string; error: string }
	>;
	succeeded: number;
	failed: number;
};

/**
 * Lists invitations. The backend pins org-scoped callers to their own
 * organization; passing `organizationId` narrows the admin view further.
 */
export async function listInvitations(
	organizationId: string,
	params: { status?: TInvitationStatus; email?: string } = {},
) {
	const search = new URLSearchParams();
	if (params.status) search.set('status', params.status);
	if (params.email) search.set('email', params.email);
	const query = search.toString();

	const envelope = (await request<TInvitation[]>(
		`/admin/invitations${query ? `?${query}` : ''}`,
		{ organizationId },
	)) as TApiPaginatedResponse<TInvitation>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/**
 * Sends one invitation or a bulk batch (cap 100 on the backend).
 *
 * @param input single invite, or an array for the bulk paste path
 * @returns bulk summary for arrays, the created invitation otherwise
 */
export async function sendInvitations(
	organizationId: string,
	input: TInviteInput | TInviteInput[],
) {
	const envelope = await request<TBulkInviteResult | unknown>(
		'/admin/invitations',
		{
			method: 'POST',
			organizationId,
			body: JSON.stringify(input),
		},
	);
	return envelope.data;
}

/** Input row for the invite dialog. Org invites carry the role *name*. */
export type TInviteInput = {
	email: string;
	/** Required by the backend contract (greets the invitee, prefills profile). */
	name: string;
	organizationId?: string;
	organizationRole?: string;
};

export async function resendInvitation(
	organizationId: string,
	invitationId: string,
) {
	await request(`/admin/invitations/${invitationId}/resend`, {
		method: 'POST',
		organizationId,
	});
}

/** Backend cap on one bulk batch (locked decision D13). */
export const BULK_INVITE_LIMIT = 100;

/**
 * Parses pasted bulk-invite rows.
 *
 * @remarks
 * One row per line, comma-separated: `email[, name[, role]]`. Rows may also
 * be a bare email list. `role` is matched case-insensitively against the
 * fixed `erpRoleNames` enum — the backend contract takes `organizationRole`,
 * not a role id.
 *
 * Unknown role names are deliberately NOT dropped here: the row is sent
 * without an `organizationRole` (or with the default), and the backend's
 * fallback to `member` applies. Blank lines are skipped.
 */
export function parseBulkInviteRows(
	pasted: string,
	options: {
		organizationId: string;
		/** Role used when a row does not specify one. */
		organizationRole?: string;
	},
): { rows: TInviteInput[]; error: string | null } {
	const lines = pasted
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length === 0) return { rows: [], error: 'Paste at least one row' };
	if (lines.length > BULK_INVITE_LIMIT) {
		return {
			rows: [],
			error: `Too many rows (${lines.length}); the limit is ${BULK_INVITE_LIMIT}`,
		};
	}

	const rows: TInviteInput[] = [];
	for (const [index, line] of lines.entries()) {
		const [rawEmail, rawName, rawRole] = line
			.split(',')
			.map((part) => part.trim());
		if (!rawEmail || !rawEmail.includes('@')) {
			return { rows: [], error: `Row ${index + 1}: "${line}" has no valid email` };
		}
		rows.push({
			email: rawEmail,
			// `name` is required by the backend contract; a bare-email row
			// defaults to the local part, matching the service's own fallback.
			name: rawName || rawEmail.split('@')[0]!,
			organizationId: options.organizationId,
			organizationRole: resolveOrganizationRole(rawRole, options),
		});
	}
	return { rows, error: null };
}

/**
 * Maps a pasted role name onto the fixed enum, case-insensitively. Empty
 * input falls back to the dialog default.
 */
function resolveOrganizationRole(
	value: string | undefined,
	options: { organizationRole?: string },
): string | undefined {
	if (!value) return options.organizationRole;
	const lowered = value.toLowerCase();
	return erpRoleNames.find((name) => name === lowered);
}

export async function cancelInvitation(
	organizationId: string,
	invitationId: string,
) {
	await request(`/admin/invitations/${invitationId}/cancel`, {
		method: 'POST',
		organizationId,
	});
}

export async function deleteInvitation(
	organizationId: string,
	invitationId: string,
) {
	await request(`/admin/invitations/${invitationId}`, {
		method: 'DELETE',
		organizationId,
	});
}

// ---------------------------------------------------------------------------
// Permission helpers shared by the admin pages
// ---------------------------------------------------------------------------

/** The permission strings the admin surfaces gate on. */
export const ADMIN_PERMISSIONS = {
	readMembers: 'member.read' as Permission,
	createMembers: 'member.create' as Permission,
	updateMembers: 'member.update' as Permission,
	deleteMembers: 'member.delete' as Permission,
	readAudit: 'audit_log.read' as Permission,
};

// ---------------------------------------------------------------------------
// Query options (shared cache keys for the admin pages)
// ---------------------------------------------------------------------------

/**
 * Users list query. Keyed by organization *and* the filter set so switching
 * filters or organizations is an independent cache entry.
 */
export const usersQueryOptions = (
	organizationId: string,
	params: TUserListParams = {},
) =>
	queryOptions({
		queryKey: ['admin-users', organizationId, params],
		queryFn: () => listUsers(organizationId, params),
		staleTime: 15 * 1000,
	});

/** Audit trail query, keyed by filters. */
export const auditQueryOptions = (
	organizationId: string,
	params: TAuditListParams = {},
) =>
	queryOptions({
		queryKey: ['admin-audit', organizationId, params],
		queryFn: () => listAudit(organizationId, params),
		staleTime: 15 * 1000,
	});

/** Pending invitations for the users page panel. */
export const invitationsQueryOptions = (
	organizationId: string,
	status: TInvitationStatus = 'pending',
) =>
	queryOptions({
		queryKey: ['admin-invitations', organizationId, status],
		queryFn: () => listInvitations(organizationId, { status }),
		staleTime: 15 * 1000,
	});
