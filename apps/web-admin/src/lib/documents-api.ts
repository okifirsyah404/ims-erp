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
	issuedOn: string | null;
	module: string | null;
	sourceType: string | null;
	sourceId: string | null;
};

export type TDocumentFile = {
	id: string;
	fileName: string;
	mimeType: string | null;
	sizeBytes: number;
	uploadedAt: string;
	/** Short-lived presigned URL. */
	url: string;
};

export type TDocumentShare = {
	id: string;
	token: string;
	sharedAt: string;
	expiresAt: string | null;
	isRevoked: boolean;
};

export type TDocumentDetail = TDocument & {
	files: TDocumentFile[];
	shares: TDocumentShare[];
	accessTrail: {
		id: string;
		action: 'view' | 'download' | 'print' | 'share' | 'delete';
		accessedAt: string;
		accessedByUserId: string | null;
	}[];
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

/** One document with its files, live links and access trail (appends a view row). */
export function documentDetailQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['documents', id],
		queryFn: async () => (await request<TDocumentDetail>(`/documents/${id}`)).data as TDocumentDetail,
	});
}

/** Attaches a PDF or image (multipart, at most 10 MB). */
export async function uploadDocumentFile(id: string, file: File): Promise<TDocumentFile> {
	const body = new FormData();
	body.set('file', file);
	const response = await fetch(`${API_URL}/documents/${id}/files`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Accept-Language': currentLanguage() },
		body,
	});
	const envelope = (await response.json()) as TApiResponse<TDocumentFile>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope.data as TDocumentFile;
}

/** Soft-deletes a file; the row is kept for the trail. */
export function deleteDocumentFile(id: string, fileId: string) {
	return request<null>(`/documents/${id}/files/${fileId}`, { method: 'DELETE' });
}

/** A presigned download URL; opening it appends a download row. */
export async function downloadDocumentFile(id: string, fileId: string): Promise<string> {
	const envelope = await request<{ url: string }>(`/documents/${id}/files/${fileId}/download`);
	return (envelope.data as { url: string }).url;
}

/** Creates a revocable public link with a mandatory expiry. */
export function createDocumentShare(id: string, expiresInDays: number) {
	return request<TDocumentShare>(`/documents/${id}/shares`, {
		method: 'POST',
		body: JSON.stringify({ expiresInDays }),
	});
}

/** Revokes a public link; the row is kept. */
export function revokeDocumentShare(id: string, shareId: string) {
	return request<TDocumentShare>(`/documents/${id}/shares/${shareId}`, { method: 'DELETE' });
}

/** The anonymous URL a share token resolves to. */
export function publicShareUrl(token: string): string {
	return `${API_URL}/documents/public/v1/shares/${token}`;
}
