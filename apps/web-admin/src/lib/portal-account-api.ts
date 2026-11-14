import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for customer-portal logins (`/admin/portal-accounts`,
 * ERP-0022). One login per person (customer contact) with a role (owner
 * decision D2); the person sets the password from the emailed link.
 * `portal_account:read|invite|revoke`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PORTAL_ROLES = ['owner', 'approver', 'finance', 'viewer'] as const;
export type TPortalRole = (typeof PORTAL_ROLES)[number];

export type TPortalAccount = {
	id: string;
	customerId: string;
	contactId: string | null;
	role: TPortalRole;
	status: 'active' | 'suspended' | 'revoked';
	user: { id: string; name: string; email: string };
	passwordSet: boolean;
	lastLoginAt: number | null;
	createdAt: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			'Accept-Language': currentLanguage(),
			...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope;
}

export function portalAccountsQueryOptions(customerId: string, enabled: boolean) {
	return queryOptions({
		queryKey: ['crm', 'portal-account', customerId] as const,
		queryFn: async () => (await request<TPortalAccount[]>(`/admin/portal-accounts?customerId=${encodeURIComponent(customerId)}`)).data ?? [],
		enabled,
	});
}

export async function invitePortalAccount(input: { customerId: string; name: string; email: string; role: TPortalRole }) {
	return (await request<TPortalAccount>('/admin/portal-accounts', { method: 'POST', body: JSON.stringify(input) })).data;
}

export async function resendPortalInvite(id: string) {
	return (await request<TPortalAccount>(`/admin/portal-accounts/${id}/resend`, { method: 'POST' })).data;
}

export async function revokePortalAccount(id: string) {
	await request<null>(`/admin/portal-accounts/${id}/revoke`, { method: 'POST' });
}
