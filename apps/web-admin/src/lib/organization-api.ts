import type {
	TApiResponse,
	TApiPaginatedResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the organization module's first-party endpoints
 * (`/organizations`). Envelope types come from `@ims-erp/common`; row shapes
 * mirror the backend contracts.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type TOrganization = {
	id: string;
	name: string;
	slug: string;
	/**
	 * Presigned image URL on list responses (the backend signs the stored
	 * object key on read, since the client cannot). `null` when unset.
	 */
	logo: string | null;
	/** Optional free-text organization description; `null` when unset. */
	description: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	deletedAt: string | null;
	membersCount?: number;
	warehousesCount?: number;
	projectCount?: number;
};

export type TOrganizationMember = {
	id: string;
	organizationId: string;
	userId: string;
	role: string;
	createdAt: string;
	user: {
		name: string;
		email: string;
		image: string | null;
	} | null;
};

async function request<T>(
	path: string,
	init?: RequestInit,
): Promise<TApiResponse<T>> {
	// FormData must carry the browser-generated multipart boundary: setting any
	// Content-Type here breaks the body parse (400 from the server).
	const isFormData =
		typeof FormData !== 'undefined' && init?.body instanceof FormData;
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers:
			init?.body != null && !isFormData
				? { 'Content-Type': 'application/json' }
				: undefined,
		...init,
	});
	// Parse defensively: error responses (auth redirect, empty body, HTML)
	// are not JSON — surface the HTTP status instead of a cryptic
	// "JSON.parse: unexpected character" from the browser.
	const envelope = await parseJsonEnvelope<T>(response);
	if (!response.ok) {
		throw new Error(
			envelope.errors?.[0]?.message ?? envelope.message ?? `Request failed (${response.status})`,
		);
	}
	return envelope;
}

/**
 * Reads the response as JSON, tolerating non-JSON bodies by returning an
 * empty envelope so callers fall back to the status-based error message.
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

export async function listOrganizations(params?: {
	page?: number;
	limit?: number;
	includeDeleted?: boolean;
}) {
	const search = new URLSearchParams();
	if (params?.page) search.set('page', String(params.page));
	if (params?.limit) search.set('limit', String(params.limit));
	if (params?.includeDeleted) search.set('includeDeleted', 'true');
	const query = search.toString();
	const envelope = (await request<TOrganization[]>(`/organizations${query ? `?${query}` : ''}`)) as TApiPaginatedResponse<TOrganization>;
	return {
		rows: envelope.data,
		pagination: (envelope as TApiPaginatedResponse<TOrganization>).pagination,
	};
}

export async function getOrganization(organizationId: string) {
	const envelope = await request<TOrganization>(
		`/organizations/${organizationId}`,
	);
	return envelope.data;
}

/** Result of the create flow: the org plus per-user outcomes (ERP-0041). */
export type TCreateOrganizationResult = {
	organization: TOrganization;
	members: Array<
		| { email: string; status: 'added'; memberId: string }
		| { email: string; status: 'invited'; invitationId: string }
		| { email: string; status: 'skipped'; reason: string }
		| { email: string; status: 'failed'; error: string }
	>;
};

// `createOrganization` was removed with K12 (M12-2): the ERP uses one
// company, so `POST /organizations` always answers 409 and no UI calls it.

/** Uploads the org profile image; the server normalises it to WebP. */
export async function uploadOrganizationImage(
	organizationId: string,
	file: Blob,
) {
	const body = new FormData();
	// The server decides the format from the bytes; the name is only a hint.
	body.append('file', file, `logo.${file.type === 'image/png' ? 'png' : 'webp'}`);
	await request(`/organizations/${organizationId}/image-profile`, {
		method: 'POST',
		body,
	});
}

export async function deleteOrganizationImage(organizationId: string) {
	await request(`/organizations/${organizationId}/image-profile`, {
		method: 'DELETE',
	});
}

export async function getOrganizationImage(organizationId: string) {
	const envelope = await request<{ url: string | null }>(
		`/organizations/${organizationId}/image-profile`,
	);
	return envelope.data?.url ?? null;
}

export async function updateOrganization(
	organizationId: string,
	input: {
		name?: string;
		logo?: string | null;
		/** Trimmed server-side; an empty string clears it. */
		description?: string | null;
	},
) {
	const envelope = await request<TOrganization>(
		`/organizations/${organizationId}`,
		{ method: 'PATCH', body: JSON.stringify(input) },
	);
	return envelope.data;
}

export async function listMembers(
	organizationId: string,
	params?: { page?: number; limit?: number; role?: string },
) {
	const search = new URLSearchParams();
	if (params?.page) search.set('page', String(params.page));
	if (params?.limit) search.set('limit', String(params.limit));
	if (params?.role) search.set('role', params.role);
	const query = search.toString();
	const envelope = (await request<TOrganizationMember[]>(
		`/organizations/${organizationId}/members${query ? `?${query}` : ''}`,
	)) as TApiPaginatedResponse<TOrganizationMember>;
	return {
		rows: envelope.data,
		pagination: (envelope as TApiPaginatedResponse<TOrganizationMember>)
			.pagination,
	};
}

export async function updateMemberRole(
	organizationId: string,
	memberId: string,
	roles: string[],
) {
	const envelope = await request<{ id: string; role: string }>(
		`/organizations/${organizationId}/members/${memberId}`,
		{ method: 'PATCH', body: JSON.stringify({ roles }) },
	);
	return envelope.data;
}

// Reusable query options.
export const organizationsQueryOptions = queryOptions({
	queryKey: ['organizations'] as const,
	queryFn: () => listOrganizations({ includeDeleted: true }),
});

/** The caller's memberships (`GET /organizations/mine`); `role` is comma-joined. */
export type TMyOrganization = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	role: string;
};

export async function listMyOrganizations(): Promise<TMyOrganization[]> {
	const envelope = await request<TMyOrganization[]>('/organizations/mine');
	return envelope.data ?? [];
}

/** Separate key from `organizationsQueryOptions`: membership rows, not the admin list. */
export const myOrganizationsQueryOptions = queryOptions({
	queryKey: ['my-organizations'] as const,
	queryFn: listMyOrganizations,
});

export function organizationQueryOptions(organizationId: string) {
	return queryOptions({
		queryKey: ['organizations', organizationId] as const,
		queryFn: () => getOrganization(organizationId),
	});
}

export function organizationMembersQueryOptions(
	organizationId: string,
	page = 1,
	limit = 20,
) {
	return queryOptions({
		queryKey: [
			'organizations',
			organizationId,
			'members',
			{ page, limit },
		] as const,
		queryFn: () => listMembers(organizationId, { page, limit }),
	});
}
