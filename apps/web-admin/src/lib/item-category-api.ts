import type { TApiResponse } from '@ims-erp/common';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for **product** categories (`/inventory/product-categories`,
 * ADR-0011).
 *
 * @remarks
 * One level, company-wide. Reading needs `product:read`; managing needs
 * `product:create|update|archive`. The slug matches the public website's
 * category and cannot change after creation. Not to be confused with the
 * backend's `/inventory/item-categories`, which are *asset* categories
 * (depreciation rules) and belong to `asset-api.ts`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type TItemCategory = {
	id: string;
	slug: string;
	name: string;
	shortName: string | null;
	sortOrder: number;
	description: string | null;
	isActive: boolean;
};

export type TItemCategoryInput = {
	slug: string;
	name: string;
	shortName: string | null;
	sortOrder: number;
	description: string | null;
	isActive: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			// Server error messages come back in the UI language.
			'Accept-Language': currentLanguage(),
			...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope.data as T;
}

/** Categories for pickers (active only) or management (all live ones). */
export function itemCategoriesQueryOptions(includeInactive = false) {
	return queryOptions({
		queryKey: ['inventory', 'item-categories', { includeInactive }] as const,
		queryFn: () =>
			request<TItemCategory[]>(`/inventory/product-categories${includeInactive ? '?includeInactive=true' : ''}`),
	});
}

/** Category names by id (inactive ones included, for existing items). */
export function useItemCategoryNames(): ReadonlyMap<string, string> {
	const { data } = useQuery(itemCategoriesQueryOptions(true));
	return new Map((data ?? []).map((category) => [category.id, category.name]));
}

export function createItemCategory(input: TItemCategoryInput) {
	return request<TItemCategory>('/inventory/product-categories', {
		method: 'POST',
		body: JSON.stringify(input),
	});
}

export function updateItemCategory(id: string, input: Omit<TItemCategoryInput, 'slug'>) {
	return request<TItemCategory>(`/inventory/product-categories/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(input),
	});
}

export function archiveItemCategory(id: string) {
	return request<TItemCategory>(`/inventory/product-categories/${id}`, { method: 'DELETE' });
}
