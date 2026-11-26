import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from '@/lib/organization-store';

/**
 * API client for the portal's document routes (`/documents/me/*`).
 *
 * @remarks
 * The backend scopes everything to the session: no userId is ever sent, and an
 * unknown id answers 404. Signature images are multipart, so `Content-Type` is
 * never set by hand for those calls.
 */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** A document concerned with the caller. */
export type TMyDocument = {
	id: string;
	code: string;
	title: string;
	documentType: string;
	status: string;
	issuedOn: string | null;
	createdAt: string;
	/** Set while a signature request for this document is pending. */
	pendingSignatureRequestId: string | null;
	/** Newest live file, if any. */
	fileId: string | null;
	fileName: string | null;
};

export const SIGNATURE_REQUEST_STATUSES = ['pending', 'signed', 'declined', 'cancelled'] as const;
export type TSignatureRequestStatus = (typeof SIGNATURE_REQUEST_STATUSES)[number];

/** One signature request addressed to the caller. */
export type TMySignatureRequest = {
	id: string;
	documentId: string;
	documentCode: string | null;
	documentTitle: string | null;
	documentType: string | null;
	requestedByName: string | null;
	signerName: string;
	status: TSignatureRequestStatus;
	effectiveStatus: TSignatureRequestStatus | 'expired';
	note: string | null;
	declineReason: string | null;
	expiresAt: string | null;
	respondedAt: string | null;
	createdAt: string;
	signatureImageUrl?: string | null;
};

async function parse<T>(response: Response): Promise<TApiResponse<T>> {
	const text = await response.text();
	const envelope = (text ? JSON.parse(text) : {}) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? `Request failed (${response.status})`);
	}
	return envelope;
}

const headers = (json: boolean) => ({
	...(json ? { 'Content-Type': 'application/json' } : {}),
	'Accept-Language': currentLanguage(),
	...organizationHeaders(),
});

async function getPaginated<T>(path: string): Promise<TApiPaginatedResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: headers(false) });
	return (await parse<T>(response)) as unknown as TApiPaginatedResponse<T>;
}

async function getData<T>(path: string): Promise<T> {
	const envelope = await parse<T>(await fetch(`${API_URL}${path}`, { credentials: 'include', headers: headers(false) }));
	if (envelope.data === null) throw new Error(envelope.message ?? 'No data');
	return envelope.data;
}

async function send<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
	const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
	const envelope = await parse<T>(
		await fetch(`${API_URL}${path}`, {
			method,
			credentials: 'include',
			headers: headers(!multipart && body !== undefined),
			body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
		}),
	);
	if (envelope.data === null) throw new Error(envelope.message ?? 'No data');
	return envelope.data;
}

const query = (params: Record<string, string | number | boolean | undefined>) => {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	const text = search.toString();
	return text ? `?${text}` : '';
};

export const myDocumentsQueryOptions = (params: { page?: number; search?: string } = {}) =>
	queryOptions({
		queryKey: ['employee-portal', 'documents', params] as const,
		queryFn: async () => (await getPaginated<TMyDocument>(`/documents/me/documents${query(params)}`)).data,
	});

/** A short-lived URL for one file of a document the caller may read. */
export const downloadMyDocumentFile = (documentId: string, fileId: string) =>
	getData<{ url: string; fileName: string; mimeType: string | null }>(
		`/documents/me/documents/${documentId}/files/${fileId}/download`,
	);

export const mySignatureRequestsQueryOptions = (params: { page?: number; status?: TSignatureRequestStatus } = {}) =>
	queryOptions({
		queryKey: ['employee-portal', 'signature-requests', params] as const,
		queryFn: async () => (await getPaginated<TMySignatureRequest>(`/documents/me/signature-requests${query(params)}`)).data,
	});

export const signMyRequest = (id: string) => send<unknown>('POST', `/documents/me/signature-requests/${id}/sign`);

export const declineMyRequest = (id: string, reason: string) =>
	send<unknown>('POST', `/documents/me/signature-requests/${id}/decline`, { reason });

export const mySignatureImageQueryOptions = queryOptions({
	queryKey: ['employee-portal', 'signature-image'] as const,
	queryFn: () => getData<{ url: string | null }>('/documents/me/signature-image'),
});

export const uploadMySignatureImage = (file: File) => {
	const form = new FormData();
	form.append('file', file);
	return send<{ url: string | null }>('PUT', '/documents/me/signature-image', form);
};

export const removeMySignatureImage = () => send<{ removed: true }>('DELETE', '/documents/me/signature-image');


