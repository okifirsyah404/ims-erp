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
	logo: string | null;
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
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers:
			init?.body != null ? { 'Content-Type': 'application/json' } : undefined,
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

export async function createOrganization(input: {
	name: string;
	slug: string;
	logo?: string | null;
	/** Nested users: active emails join directly, unknown emails get invited. */
	users?: Array<{ email: string; name: string; roles: string[] }>;
	/** Deliver invitation emails (default true). */
	sendInvites?: boolean;
}) {
	const envelope = await request<TCreateOrganizationResult>('/organizations', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data;
}

/** Uploads the org profile image (client-encoded WebP). */
export async function uploadOrganizationImage(
	organizationId: string,
	file: Blob,
) {
	const body = new FormData();
	body.append('file', file, 'logo.webp');
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

/** Encodes an image file to WebP via canvas (ERP-0041: client-side encode). */
export async function encodeWebp(file: File): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const canvas = document.createElement('canvas');
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) =>
				blob && blob.type === 'image/webp'
					? resolve(blob)
					: reject(new Error('WebP encoding failed')),
			'image/webp',
			0.9,
		);
	});
}

export async function updateOrganization(
	organizationId: string,
	input: { name?: string; logo?: string | null },
) {
	const envelope = await request<TOrganization>(
		`/organizations/${organizationId}`,
		{ method: 'PATCH', body: JSON.stringify(input) },
	);
	return envelope.data;
}

export async function deleteOrganization(organizationId: string) {
	await request(`/organizations/${organizationId}`, { method: 'DELETE' });
}

export async function restoreOrganization(organizationId: string) {
	await request(`/organizations/${organizationId}/restore`, {
		method: 'POST',
	});
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

export async function addMember(
	organizationId: string,
	input: { userId: string; roles: string[] },
) {
	const envelope = await request<{ id: string }>(
		`/organizations/${organizationId}/members`,
		{ method: 'POST', body: JSON.stringify(input) },
	);
	return envelope.data;
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

export async function removeMember(organizationId: string, memberId: string) {
	await request(`/organizations/${organizationId}/members/${memberId}`, {
		method: 'DELETE',
	});
}

// Reusable query options.
export const organizationsQueryOptions = queryOptions({
	queryKey: ['organizations'] as const,
	queryFn: () => listOrganizations({ includeDeleted: true }),
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
