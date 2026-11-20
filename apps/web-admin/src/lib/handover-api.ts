import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for BAST documents (`/projects/:id/basts`) and warranty
 * certificates (`/projects/warranties/projects/:projectId`), ADR-0011
 * step 6b.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type TDocumentItem = { description: string; volume: string; remarks: string };

export type TBastInput = {
	bastDate: string;
	firstPartyCompany: string;
	firstPartyName: string;
	firstPartyTitle: string;
	secondPartyCompany: string;
	secondPartyName: string;
	secondPartyTitle: string;
	contractNumber: string | null;
	workTitle: string;
	projectName: string | null;
	items: TDocumentItem[];
	scope: string[];
};

export type TBast = TBastInput & {
	id: string;
	projectId: string;
	code: string;
	status: 'issued' | 'cancelled';
	createdAt: string;
};

export type TBastRow = TBast & { projectCode: string; customerName: string };

export type TWarrantyInput = {
	handoverId: string;
	issueDate: string;
	months: number;
	productSummary: string;
	projectName: string;
	projectLocation: string | null;
	projectOwner: string;
	items: TDocumentItem[];
	coverage: string;
	exclusions: string;
	serviceTerms: string;
};

export type TWarrantyDraft = Omit<TWarrantyInput, 'handoverId'> & { handoverId: string | null };

export type TWarranty = TWarrantyInput & {
	id: string;
	code: string;
	projectId: string;
	startDate: string;
	endDate: string;
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
	if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	return envelope;
}

const send = async <T>(path: string, method: string, body?: unknown): Promise<T> =>
	(await request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })).data as T;

export function allBastsQueryOptions(params: { page?: number; search?: string }) {
	return queryOptions({
		queryKey: ['projects', 'basts', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			if (params.page) search.set('page', String(params.page));
			if (params.search) search.set('search', params.search);
			const envelope = (await request<TBastRow[]>(`/projects/basts${search.size ? `?${search}` : ''}`)) as TApiPaginatedResponse<TBastRow>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function projectBastsQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: ['projects', 'detail', projectId, 'basts'] as const,
		queryFn: async () => (await request<TBast[]>(`/projects/${projectId}/basts`)).data as TBast[],
	});
}

export function bastQueryOptions(projectId: string, bastId: string) {
	return queryOptions({
		queryKey: ['projects', 'detail', projectId, 'basts', bastId] as const,
		queryFn: async () => (await request<TBast>(`/projects/${projectId}/basts/${bastId}`)).data as TBast,
		retry: false,
	});
}

export function bastDraftQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: ['projects', 'detail', projectId, 'bast-draft'] as const,
		queryFn: async () => (await request<TBastInput>(`/projects/${projectId}/basts/draft`)).data as TBastInput,
		staleTime: 0,
	});
}

export const createBast = (projectId: string, input: TBastInput) => send<TBast>(`/projects/${projectId}/basts`, 'POST', input);
export const updateBast = (projectId: string, bastId: string, input: TBastInput) => send<TBast>(`/projects/${projectId}/basts/${bastId}`, 'PUT', input);
export const cancelBast = (projectId: string, bastId: string) => send<TBast>(`/projects/${projectId}/basts/${bastId}/cancel`, 'POST');

export function warrantyQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: ['projects', 'detail', projectId, 'warranty'] as const,
		queryFn: async () => ((await request<TWarranty | null>(`/projects/warranties/projects/${projectId}`)).data ?? null) as TWarranty | null,
	});
}

export function warrantyDraftQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: ['projects', 'detail', projectId, 'warranty-draft'] as const,
		queryFn: async () => (await request<TWarrantyDraft>(`/projects/warranties/projects/${projectId}/draft`)).data as TWarrantyDraft,
		staleTime: 0,
	});
}

export const saveWarranty = (projectId: string, input: TWarrantyInput) => send<TWarranty>(`/projects/warranties/projects/${projectId}`, 'PUT', input);
