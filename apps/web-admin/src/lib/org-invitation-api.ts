import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import type {
	TBulkInviteResult,
	TInvitation,
	TInvitationStatus,
	TInviteInput,
} from './admin-api';

/**
 * API client for the organization-scoped invitation endpoints
 * (`/organizations/:organizationId/invitations`).
 *
 * @remarks
 * Organization admins reach their own invitations here instead of
 * `/admin/invitations`, which is application-admin only. Every request sends
 * `x-organization-id` because the ERP guard resolves the caller's membership
 * from that header; the path is the authoritative organization on the
 * backend and the two must agree.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(
	organizationId: string,
	path: string,
	init?: RequestInit,
): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		...init,
		headers: {
			'x-organization-id': organizationId,
			...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
			...init?.headers,
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

/** Tolerates non-JSON bodies so callers fall back to the HTTP status. */
async function parseJsonEnvelope<T>(
	response: Response,
): Promise<TApiResponse<T>> {
	try {
		return (await response.json()) as TApiResponse<T>;
	} catch {
		return {} as TApiResponse<T>;
	}
}

export async function listOrgInvitations(
	organizationId: string,
	params: { status?: TInvitationStatus; email?: string } = {},
) {
	const search = new URLSearchParams();
	if (params.status) search.set('status', params.status);
	if (params.email) search.set('email', params.email);
	const query = search.toString();

	const envelope = (await request<TInvitation[]>(
		organizationId,
		`/organizations/${organizationId}/invitations${query ? `?${query}` : ''}`,
	)) as TApiPaginatedResponse<TInvitation>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Sends one invitation or a bulk batch; the organization comes from the path. */
export async function sendOrgInvitations(
	organizationId: string,
	input: TInviteInput | TInviteInput[],
) {
	const envelope = await request<TBulkInviteResult | unknown>(
		organizationId,
		`/organizations/${organizationId}/invitations`,
		{ method: 'POST', body: JSON.stringify(input) },
	);
	return envelope.data;
}

export async function resendOrgInvitation(
	organizationId: string,
	invitationId: string,
) {
	await request(
		organizationId,
		`/organizations/${organizationId}/invitations/${invitationId}/resend`,
		{ method: 'POST' },
	);
}

export async function cancelOrgInvitation(
	organizationId: string,
	invitationId: string,
) {
	await request(
		organizationId,
		`/organizations/${organizationId}/invitations/${invitationId}/cancel`,
		{ method: 'POST' },
	);
}

export async function deleteOrgInvitation(
	organizationId: string,
	invitationId: string,
) {
	await request(
		organizationId,
		`/organizations/${organizationId}/invitations/${invitationId}`,
		{ method: 'DELETE' },
	);
}

/** Pending invitations for an organization, keyed separately from the admin list. */
export const orgInvitationsQueryOptions = (
	organizationId: string,
	status: TInvitationStatus = 'pending',
) =>
	queryOptions({
		queryKey: ['org-invitations', organizationId, status],
		queryFn: () => listOrgInvitations(organizationId, { status }),
		staleTime: 15 * 1000,
	});
