import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the website catalog listings (`/catalog/listings`, M04
 * stage 1). The website reads published listings through `/public/v1/catalog`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PRICE_MODES = ['list', 'rfq'] as const;
export type TPriceMode = (typeof PRICE_MODES)[number];
export const OUT_OF_STOCK_MODES = ['out', 'preorder', 'request'] as const;
export type TOutOfStockMode = (typeof OUT_OF_STOCK_MODES)[number];

export type TListing = {
	id: string;
	itemId: string;
	slug: string;
	isPublished: boolean;
	publishedAt: string | null;
	specs: string | null;
	priceMode: TPriceMode;
	priceCaption: string | null;
	outOfStockMode: TOutOfStockMode;
	leadTimeLabel: string | null;
	applications: string[];
	popularity: number;
	item: { id: string; sku: string; name: string; sellingPrice: number } | null;
};

export type TListingInput = Omit<TListing, 'id' | 'isPublished' | 'publishedAt' | 'item'>;

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

export const listingsQueryOptions = () =>
	queryOptions({ queryKey: ['catalog', 'listings'] as const, queryFn: async () => (await request<TListing[]>('/catalog/listings')).data as TListing[] });

export const createListing = (input: TListingInput) => send<TListing>('/catalog/listings', 'POST', input);
export const updateListing = (id: string, input: TListingInput) => send<TListing>(`/catalog/listings/${id}`, 'PUT', input);
export const publishListing = (id: string, published: boolean) => send<TListing>(`/catalog/listings/${id}/publish`, 'POST', { published });
export const removeListing = (id: string) => send<{ removed: true }>(`/catalog/listings/${id}`, 'DELETE');

/** `Kamera CCTV 2MP` → `kamera-cctv-2mp`. */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120);
}
