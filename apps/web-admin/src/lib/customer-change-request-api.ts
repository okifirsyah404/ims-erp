import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/** Company-data change requests from the customer portal (ERP-0076). */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type TCompanyChanges = { name?: string; taxId?: string | null; industry?: string | null };

export type TChangeRequest = {
	id: string;
	changes: TCompanyChanges;
	previous: TCompanyChanges;
	status: 'pending' | 'approved' | 'rejected' | 'superseded';
	requestedByName: string | null;
	decisionNote: string | null;
	createdAt: string;
	decidedAt: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: { 'Accept-Language': currentLanguage(), ...(init?.body != null ? { 'Content-Type': 'application/json' } : {}) },
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	return envelope.data as T;
}

export const changeRequestsQueryOptions = (customerId: string) =>
	queryOptions({
		queryKey: ['crm', 'change-requests', customerId] as const,
		queryFn: () => request<TChangeRequest[]>(`/customers/${encodeURIComponent(customerId)}/change-requests`),
	});

export const decideChangeRequest = (customerId: string, requestId: string, decision: 'approve' | 'reject', note?: string) =>
	request<TChangeRequest>(`/customers/${encodeURIComponent(customerId)}/change-requests/${encodeURIComponent(requestId)}/${decision}`, {
		method: 'POST',
		body: JSON.stringify(note ? { note } : {}),
	});
