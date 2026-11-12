import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the document registry (`/documents`).
 *
 * @remarks
 * Business documents stay in their owning module; this registry holds the
 * issued copy: its code (allocated by the numbering authority), status and
 * access trail. Reading needs `document:read`, voiding needs
 * `document:update`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const DOCUMENT_STATUSES = ['draft', 'issued', 'void', 'archived'] as const;
export type TDocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export type TDocument = {
	id: string;
	organizationId: string | null;
	code: string;
	documentType: string;
	title: string;
	status: TDocumentStatus;
	/** Business date (`YYYY-MM-DD`, Asia/Jakarta). */
	issuedOn: string;
	module: string | null;
	sourceType: string | null;
	sourceId: string | null;
};

export type TDocumentListParams = {
	page?: number;
	limit?: number;
	search?: string;
	status?: TDocumentStatus;
	documentType?: string;
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

/** One page of the registry, newest first. */
export function documentsQueryOptions(params: TDocumentListParams) {
	const query = new URLSearchParams();
	query.set('page', String(params.page ?? 1));
	query.set('limit', String(params.limit ?? 20));
	if (params.search) query.set('search', params.search);
	if (params.status) query.set('status', params.status);
	if (params.documentType) query.set('documentType', params.documentType);
	return queryOptions({
		queryKey: ['documents', params],
		queryFn: async () => {
			const envelope = (await request<TDocument[]>(`/documents?${query}`)) as TApiPaginatedResponse<TDocument>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

/** Voids a live document; the row is kept, never deleted. */
export function voidDocument(id: string) {
	return request<TDocument>(`/documents/${id}/void`, { method: 'POST' });
}
