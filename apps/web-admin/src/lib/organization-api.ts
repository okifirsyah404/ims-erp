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
	rolesCount?: number;
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
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(
			envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed',
		);
	}
	return envelope;
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

export async function createOrganization(input: {
	name: string;
	slug: string;
	logo?: string | null;
}) {
	const envelope = await request<TOrganization>('/organizations', {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data;
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
	input: { userId: string; role: string },
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
	role: string,
) {
	const envelope = await request<{ id: string; role: string }>(
		`/organizations/${organizationId}/members/${memberId}`,
		{ method: 'PATCH', body: JSON.stringify({ role }) },
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

export function organizationMembersQueryOptions(organizationId: string) {
	return queryOptions({
		queryKey: ['organizations', organizationId, 'members'] as const,
		queryFn: () => listMembers(organizationId, { limit: 100 }),
	});
}
