import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for customer-portal logins (`/admin/customers/portal-accounts`,
 * ERP-0022). One login per person (a `customer.customers` row) with a role (owner
 * decision D2); the person sets the password from the emailed link.
 * `portal_account:read|invite|revoke`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PORTAL_ROLES = ['owner', 'approver', 'finance', 'viewer'] as const;
export type TPortalRole = (typeof PORTAL_ROLES)[number];

export type TPortalAccount = {
	id: string;
	/** The person; `id` is the same value. */
	customerId: string;
	companyId: string | null;
	role: TPortalRole;
	status: 'active' | 'suspended' | 'revoked';
	user: { id: string; name: string; email: string };
	passwordSet: boolean;
	lastLoginAt: string | null;
	createdAt: string;
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

/** A company's logins, or the one login of an individual customer. */
export type TPortalScope = { customerId: string; companyId?: undefined } | { companyId: string; customerId?: undefined };

const scopeKey = (scope: TPortalScope) => scope.companyId ?? scope.customerId ?? '';
const scopeQuery = (scope: TPortalScope) =>
	scope.companyId ? `companyId=${encodeURIComponent(scope.companyId)}` : `customerId=${encodeURIComponent(scope.customerId ?? '')}`;

export function portalAccountsQueryOptions(scope: TPortalScope, enabled: boolean) {
	return queryOptions({
		queryKey: ['crm', 'portal-account', scopeKey(scope)] as const,
		queryFn: async () => (await request<TPortalAccount[]>(`/admin/customers/portal-accounts?${scopeQuery(scope)}`)).data ?? [],
		enabled,
	});
}

export async function invitePortalAccount(input: TPortalScope & { name: string; email: string; role: TPortalRole }) {
	return (await request<TPortalAccount>('/admin/customers/portal-accounts', { method: 'POST', body: JSON.stringify(input) })).data;
}

export async function resendPortalInvite(id: string) {
	return (await request<TPortalAccount>(`/admin/customers/portal-accounts/${id}/resend`, { method: 'POST' })).data;
}

export async function revokePortalAccount(id: string) {
	await request<null>(`/admin/customers/portal-accounts/${id}/revoke`, { method: 'POST' });
}
