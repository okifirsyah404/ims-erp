import type { TApiResponse, TWebsiteContentTypeKey } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * Typed client for the public website's content (`/website/pages`,
 * `/website/assets`, ERP-0071 stages 2-4). The form shapes come from the
 * shared content-type registry in `@ims-erp/common`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const WEB_PAGE_STATUSES = ['draft', 'published', 'archived'] as const;
export type TWebPageStatus = (typeof WEB_PAGE_STATUSES)[number];

/** Badge variant per status. */
export const STATUS_VARIANT: Record<TWebPageStatus, 'default' | 'secondary' | 'outline'> = { published: 'default', draft: 'secondary', archived: 'outline' };

export type TWebPage = {
	id: string;
	pageType: TWebsiteContentTypeKey;
	slug: string;
	title: string;
	status: TWebPageStatus;
	publishedAt: string | null;
	position: number;
	content: Record<string, unknown>;
	seoTitle: string | null;
	seoDescription: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
};

export type TWebPageBody = {
	pageType: TWebsiteContentTypeKey;
	slug: string;
	title: string;
	position: number;
	seoTitle: string | null;
	seoDescription: string | null;
	content: Record<string, unknown>;
	version?: number;
};

export type TWebAsset = { id: string; ref: string; fileName: string; byteSize: number; altText: string | null; url: string; createdAt: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const isJson = init?.body != null && !(init.body instanceof FormData);
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: { 'Accept-Language': currentLanguage(), ...(isJson ? { 'Content-Type': 'application/json' } : {}) },
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	return envelope.data as T;
}

const send = <T>(path: string, method: string, body?: unknown) =>
	request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const webPagesQueryOptions = (type: TWebsiteContentTypeKey) =>
	queryOptions({ queryKey: ['website', 'pages', type] as const, queryFn: () => request<TWebPage[]>(`/website/pages?type=${type}`) });

export const webPageQueryOptions = (id: string) =>
	queryOptions({ queryKey: ['website', 'page', id] as const, queryFn: () => request<TWebPage>(`/website/pages/${encodeURIComponent(id)}`) });

export const webAssetsQueryOptions = () =>
	queryOptions({ queryKey: ['website', 'assets'] as const, queryFn: () => request<TWebAsset[]>('/website/assets') });

export const createWebPage = (body: TWebPageBody) => send<TWebPage>('/website/pages', 'POST', body);
export const updateWebPage = (id: string, body: TWebPageBody) => send<TWebPage>(`/website/pages/${encodeURIComponent(id)}`, 'PUT', body);
export const setWebPageStatus = (id: string, status: TWebPageStatus) =>
	send<TWebPage>(`/website/pages/${encodeURIComponent(id)}/status`, 'POST', { status });
export const deleteWebPage = (id: string) => send<null>(`/website/pages/${encodeURIComponent(id)}`, 'DELETE');

export function uploadWebAsset(file: File, altText?: string): Promise<TWebAsset> {
	const form = new FormData();
	form.append('file', file);
	if (altText) form.append('altText', altText);
	return request<TWebAsset>('/website/assets', { method: 'POST', body: form });
}
