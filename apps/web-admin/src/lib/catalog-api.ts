import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the website catalog listings (`/inventory/product-listings`,
 * M04 stage 1). The website reads published listings through
 * `/public/v1/catalog`.
 *
 * @remarks
 * A listing is no longer its own row (ADR-0024 Q14): it is the set of listing
 * columns on a product, so it is addressed by the **product id** and there is
 * no separate create call — saving is an idempotent `PUT` that creates the
 * listing on first save (unpublished) and edits it afterwards.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PRICE_MODES = ['list', 'rfq'] as const;
export type TPriceMode = (typeof PRICE_MODES)[number];
export const OUT_OF_STOCK_MODES = ['out', 'preorder', 'request'] as const;
export type TOutOfStockMode = (typeof OUT_OF_STOCK_MODES)[number];

/** A listing as the admin list shows it: a product with its listing columns. */
export type TListing = {
	/** The product id; the listing has no id of its own. */
	id: string;
	sku: string;
	name: string;
	/** IDR minor units. */
	sellingPrice: number;
	slug: string | null;
	isPublished: boolean;
	publishedAt: string | null;
	listingSpecs: string | null;
	priceMode: TPriceMode;
	priceCaption: string | null;
	outOfStockMode: TOutOfStockMode;
	leadTimeLabel: string | null;
	applications: string[];
	popularity: number;
	updatedAt: string | null;
};

/** Body of the save call; mirrors `listingBodySchema` on the backend. */
export type TListingInput = {
	slug: string;
	specs: string | null;
	priceMode: TPriceMode;
	priceCaption: string | null;
	outOfStockMode: TOutOfStockMode;
	leadTimeLabel: string | null;
	applications: string[];
	popularity: number;
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

export const listingsQueryOptions = () =>
	queryOptions({
		queryKey: ['catalog', 'listings'] as const,
		queryFn: async () => (await request<TListing[]>('/inventory/product-listings')).data as TListing[],
	});

/** Creates the listing of a product (first save, unpublished) or edits it. */
export const saveListing = (productId: string, input: TListingInput) =>
	send<TListing>(`/inventory/product-listings/${productId}`, 'PUT', input);
export const publishListing = (productId: string, published: boolean) =>
	send<TListing>(`/inventory/product-listings/${productId}/publish`, 'POST', { published });
/** Removes the listing; the product itself stays. */
export const removeListing = (productId: string) => send<void>(`/inventory/product-listings/${productId}`, 'DELETE');

/** `Kamera CCTV 2MP` → `kamera-cctv-2mp`. */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120);
}
