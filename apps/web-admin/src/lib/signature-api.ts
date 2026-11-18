import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from './organization-store';

/**
 * API client for the signature flow (`/documents/signatures`, ERP-0048) and
 * the user signature image (ERP-0049).
 *
 * @remarks
 * The three pages map one-to-one onto the permission model: the register needs
 * `document:signature_read`, asking others to sign needs
 * `document:signature_request`, and acting on a request addressed to the
 * caller needs `document:signature_sign`. The backend re-checks ownership and
 * state, so a stale page only ever produces a 403/409, never a wrong write.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const SIGNATURE_METHODS = ['electronic', 'wet_ink', 'stamp'] as const;
export type TSignatureMethod = (typeof SIGNATURE_METHODS)[number];

export const SIGNATURE_REQUEST_STATUSES = [
	'pending',
	'signed',
	'declined',
	'expired',
	'cancelled',
] as const;
export type TSignatureRequestStatus = (typeof SIGNATURE_REQUEST_STATUSES)[number];

export type TSignature = {
	id: string;
	documentId: string;
	documentCode: string | null;
	documentTitle: string | null;
	signerType: string;
	signerUserId: string | null;
	signerName: string;
	signedAt: string;
	method: TSignatureMethod;
	ipAddress: string | null;
};

export type TSignatureRequest = {
	id: string;
	documentId: string;
	documentCode: string | null;
	documentTitle: string | null;
	documentType: string | null;
	requestedByUserId: string;
	requestedByName: string | null;
	signerUserId: string;
	signerName: string;
	status: TSignatureRequestStatus;
	/** A pending row past `expiresAt` reads as `expired` without a write. */
	effectiveStatus: TSignatureRequestStatus;
	note: string | null;
	declineReason: string | null;
	expiresAt: string | null;
	respondedAt: string | null;
	createdAt: string;
	/** Presigned snapshot of the signer's image, set when the row exists. */
	signatureImageUrl?: string | null;
	/** The PDF the signature was placed on, once placement happened. */
	sourceFileId?: string | null;
	hasSignedPdf?: boolean;
};

/** The signature image snapshot a signed request carries, when it has one. */
export function signatureImageFromRequest(request: TSignatureRequest): string | null {
	return request.signatureImageUrl ?? null;
}

export type TDocumentSignatureSection = {
	signatures: TSignature[];
	requests: TSignatureRequest[];
};

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			'Accept-Language': currentLanguage(),
			...organizationHeaders(),
			...(init?.body != null && !(init.body instanceof FormData)
				? { 'Content-Type': 'application/json' }
				: {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope;
}

async function paginated<T>(path: string): Promise<{ rows: T[]; pagination: TApiPaginatedResponse<T>['pagination'] }> {
	const envelope = (await request<T[]>(path)) as TApiPaginatedResponse<T>;
	return { rows: envelope.data ?? [], pagination: envelope.pagination };
}

/** The signature evidence register, newest first. */
export function signaturesQueryOptions(params: {
	page?: number;
	limit?: number;
	documentId?: string;
	method?: TSignatureMethod;
}) {
	const query = new URLSearchParams();
	query.set('page', String(params.page ?? 1));
	query.set('limit', String(params.limit ?? 20));
	if (params.documentId) query.set('documentId', params.documentId);
	if (params.method) query.set('method', params.method);
	return queryOptions({
		queryKey: ['documents', 'signatures', 'register', params],
		queryFn: () => paginated<TSignature>(`/documents/signatures?${query}`),
	});
}

/** Requests addressed to the caller. */
export function incomingSignatureRequestsQueryOptions(params: {
	page?: number;
	limit?: number;
	pendingOnly?: boolean;
}) {
	const query = new URLSearchParams();
	query.set('page', String(params.page ?? 1));
	query.set('limit', String(params.limit ?? 20));
	if (params.pendingOnly) query.set('pendingOnly', 'true');
	return queryOptions({
		queryKey: ['documents', 'signatures', 'incoming', params],
		queryFn: () => paginated<TSignatureRequest>(`/documents/signatures/requests/incoming?${query}`),
	});
}

/** Requests the caller created. */
export function outgoingSignatureRequestsQueryOptions(params: {
	page?: number;
	limit?: number;
	pendingOnly?: boolean;
}) {
	const query = new URLSearchParams();
	query.set('page', String(params.page ?? 1));
	query.set('limit', String(params.limit ?? 20));
	if (params.pendingOnly) query.set('pendingOnly', 'true');
	return queryOptions({
		queryKey: ['documents', 'signatures', 'outgoing', params],
		queryFn: () => paginated<TSignatureRequest>(`/documents/signatures/requests/outgoing?${query}`),
	});
}

/** Signature evidence and requests of one document (detail tab). */
export function documentSignatureSectionQueryOptions(documentId: string) {
	return queryOptions({
		queryKey: ['documents', 'signatures', 'document', documentId],
		queryFn: async () =>
			(await request<TDocumentSignatureSection>(`/documents/${documentId}/signatures`))
				.data as TDocumentSignatureSection,
	});
}

/** Asks one or more internal users to sign a document. */
export function createSignatureRequests(input: {
	documentId: string;
	signerUserIds: string[];
	note?: string | null;
	expiresAt?: string | null;
}) {
	return request<TSignatureRequest[]>('/documents/signatures/requests', {
		method: 'POST',
		body: JSON.stringify({
			documentId: input.documentId,
			signerUserIds: input.signerUserIds,
			note: input.note ?? null,
			expiresAt: input.expiresAt ?? null,
		}),
	});
}

/** Signs a request addressed to the caller. */
export function signSignatureRequest(id: string, method: TSignatureMethod) {
	return request<TSignature>(`/documents/signatures/requests/${id}/sign`, {
		method: 'POST',
		body: JSON.stringify({ method }),
	});
}

/** Declines a request addressed to the caller, with a reason. */
export function declineSignatureRequest(id: string, reason: string) {
	return request<TSignatureRequest>(`/documents/signatures/requests/${id}/decline`, {
		method: 'POST',
		body: JSON.stringify({ reason }),
	});
}

/** Cancels a pending request the caller created. */
export function cancelSignatureRequest(id: string) {
	return request<TSignatureRequest>(`/documents/signatures/requests/${id}/cancel`, {
		method: 'POST',
	});
}

/** Records the signed PDF on the caller's signature (multipart, placement final). */
export async function attachSignedPdf(
	requestId: string,
	file: File,
	sourceFileId: string,
): Promise<TSignature> {
	const body = new FormData();
	body.set('file', file);
	body.set('sourceFileId', sourceFileId);
	const envelope = await request<TSignature>(
		`/documents/signatures/requests/${requestId}/signed-pdf`,
		{ method: 'PUT', body },
	);
	return envelope.data as TSignature;
}

/** The caller's signature image URL, or `null`. */
export function mySignatureImageQueryOptions() {
	return queryOptions({
		queryKey: ['documents', 'signatures', 'my-image'],
		queryFn: async () =>
			(await request<string | null>('/documents/signatures/my-image')).data ?? null,
	});
}

/** Uploads or replaces the caller's signature image (multipart). */
export async function uploadMySignatureImage(file: File): Promise<string | null> {
	const body = new FormData();
	body.set('file', file);
	const response = await fetch(`${API_URL}/documents/signatures/my-image`, {
		method: 'PUT',
		credentials: 'include',
		headers: { 'Accept-Language': currentLanguage(), ...organizationHeaders() },
		body,
	});
	const envelope = (await response.json()) as TApiResponse<string | null>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope.data ?? null;
}

/** Removes the caller's signature image. */
export function deleteMySignatureImage() {
	return request<null>('/documents/signatures/my-image', { method: 'DELETE' });
}

/** Presigned signature images of many users (print layouts). */
export async function userSignatureImages(userIds: string[]): Promise<Map<string, string>> {
	const envelope = await request<{ userId: string; imageUrl: string | null }[]>(
		'/documents/signatures/user-images',
		{ method: 'POST', body: JSON.stringify({ userIds }) },
	);
	const urls = new Map<string, string>();
	for (const row of envelope.data ?? []) {
		if (row.imageUrl) urls.set(row.userId, row.imageUrl);
	}
	return urls;
}

/** A presigned URL for the signed PDF artifact, or throws when absent. */
export async function signedPdfUrl(requestId: string): Promise<{ url: string; fileName: string }> {
	const envelope = await request<{ url: string; fileName: string }>(
		`/documents/signatures/requests/${requestId}/signed-pdf`,
	);
	return envelope.data as { url: string; fileName: string };
}
