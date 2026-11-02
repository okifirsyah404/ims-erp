import type {
	TApiPaginatedResponse,
	TApiResponse,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the location reference endpoints (`/locations`).
 *
 * @remarks
 * These endpoints are **public** — no session is required and no permission
 * gates them. They expose the Indonesian administrative hierarchy used by the
 * warehouse address form: province → regency → district → village.
 *
 * Every level supports the same filter shape: an exact parent id plus a
 * partial `name` search, with pagination capped at 100 by the backend
 * (`location.contract.ts`). Search is therefore **server-side** at each level —
 * never fetch everything and filter client-side.
 *
 * Only the village id is persisted on a warehouse address
 * (`warehouse_addresses.village_id`); the ancestors are presentation state.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** One province. */
export type TProvince = {
	id: string;
	code: string;
	name: string;
};

/** One regency (kabupaten/kota) inside a province. */
export type TRegency = {
	id: string;
	code: string;
	name: string;
	provinceId: string | null;
};

/** One district (kecamatan) inside a regency. */
export type TDistrict = {
	id: string;
	code: string;
	name: string;
	regencyId: string | null;
};

/** One village (kelurahan/desa) inside a district. */
export type TVillage = {
	id: string;
	code: string;
	name: string;
	districtId: string | null;
};

/** Shared query shape for every level. */
export type TLocationQuery = {
	page?: number;
	limit?: number;
	/** Case-insensitive partial match on the administrative name. */
	name?: string;
	/** Case-insensitive partial match on the BPS code. */
	code?: string;
};

async function request<T>(path: string): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(
			envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed',
		);
	}
	return envelope;
}

/** Builds a query string from a location query, omitting empty values. */
function toSearchParams(query: TLocationQuery & { parentId?: string | null }) {
	const params = new URLSearchParams();
	if (query.page) params.set('page', String(query.page));
	params.set('limit', String(query.limit ?? 25));
	if (query.name?.trim()) params.set('name', query.name.trim());
	if (query.code?.trim()) params.set('code', query.code.trim());
	return params;
}

/** Fetches one page of provinces. */
export async function listProvinces(query: TLocationQuery = {}) {
	const params = toSearchParams(query);
	const envelope = (await request<TProvince[]>(
		`/locations/provinces?${params.toString()}`,
	)) as TApiPaginatedResponse<TProvince>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one page of regencies, optionally scoped to a province. */
export async function listRegencies(
	query: TLocationQuery & { provinceId?: string | null } = {},
) {
	const params = toSearchParams(query);
	if (query.provinceId) params.set('provinceId', query.provinceId);
	const envelope = (await request<TRegency[]>(
		`/locations/regencies?${params.toString()}`,
	)) as TApiPaginatedResponse<TRegency>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one page of districts, optionally scoped to a regency. */
export async function listDistricts(
	query: TLocationQuery & { regencyId?: string | null } = {},
) {
	const params = toSearchParams(query);
	if (query.regencyId) params.set('regencyId', query.regencyId);
	const envelope = (await request<TDistrict[]>(
		`/locations/districts?${params.toString()}`,
	)) as TApiPaginatedResponse<TDistrict>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one page of villages, optionally scoped to a district. */
export async function listVillages(
	query: TLocationQuery & { districtId?: string | null } = {},
) {
	const params = toSearchParams(query);
	if (query.districtId) params.set('districtId', query.districtId);
	const envelope = (await request<TVillage[]>(
		`/locations/villages?${params.toString()}`,
	)) as TApiPaginatedResponse<TVillage>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Fetches one province by id (used to rebuild the cascade when editing). */
export async function getProvince(provinceId: string) {
	const envelope = await request<TProvince>(`/locations/provinces/${provinceId}`);
	return envelope.data;
}

/** Fetches one regency by id. */
export async function getRegency(regencyId: string) {
	const envelope = await request<TRegency>(`/locations/regencies/${regencyId}`);
	return envelope.data;
}

/** Fetches one district by id. */
export async function getDistrict(districtId: string) {
	const envelope = await request<TDistrict>(
		`/locations/districts/${districtId}`,
	);
	return envelope.data;
}

/** Fetches one village by id. */
export async function getVillage(villageId: string) {
	const envelope = await request<TVillage>(`/locations/villages/${villageId}`);
	return envelope.data;
}

/* ------------------------------------------------------------------------ *
 * Query options
 * ------------------------------------------------------------------------ */

/**
 * Query options for provinces.
 *
 * @remarks
 * `placeholderData` keeps the previous page visible while a new search term is
 * in flight, so the combobox list does not flash empty on every keystroke.
 */
export const provincesQueryOptions = (query: TLocationQuery = {}) =>
	queryOptions({
		queryKey: ['locations', 'provinces', query],
		queryFn: () => listProvinces(query),
		staleTime: 5 * 60_000,
		placeholderData: (previous) => previous,
	});

/** Query options for regencies within a province. */
export const regenciesQueryOptions = (
	query: TLocationQuery & { provinceId?: string | null } = {},
) =>
	queryOptions({
		queryKey: ['locations', 'regencies', query],
		queryFn: () => listRegencies(query),
		staleTime: 5 * 60_000,
		enabled: Boolean(query.provinceId),
		placeholderData: (previous) => previous,
	});

/** Query options for districts within a regency. */
export const districtsQueryOptions = (
	query: TLocationQuery & { regencyId?: string | null } = {},
) =>
	queryOptions({
		queryKey: ['locations', 'districts', query],
		queryFn: () => listDistricts(query),
		staleTime: 5 * 60_000,
		enabled: Boolean(query.regencyId),
		placeholderData: (previous) => previous,
	});

/** Query options for villages within a district. */
export const villagesQueryOptions = (
	query: TLocationQuery & { districtId?: string | null } = {},
) =>
	queryOptions({
		queryKey: ['locations', 'villages', query],
		queryFn: () => listVillages(query),
		staleTime: 5 * 60_000,
		enabled: Boolean(query.districtId),
		placeholderData: (previous) => previous,
	});

/**
 * Resolves a village id to its full ancestor chain.
 *
 * @remarks
 * Needed when editing an existing address: only `village_id` is stored, so the
 * four cascade selections must be rebuilt. The chain is three hops
 * (village → district → regency → province), each of which carries its parent
 * id, so no search is involved.
 *
 * @param villageId - The stored village id
 * @returns The village with its district, regency, and province
 */
export async function resolveVillageChain(villageId: string) {
	const village = (await getVillage(villageId)) as TVillage | null;
	if (!village) {
		return { village: null, district: null, regency: null, province: null };
	}
	const district = village.districtId
		? await getDistrict(village.districtId)
		: null;
	const regency = district?.regencyId
		? await getRegency(district.regencyId)
		: null;
	const province = regency?.provinceId
		? await getProvince(regency.provinceId)
		: null;
	return { village, district, regency, province };
}

/** Query options wrapping {@link resolveVillageChain}. */
export const villageChainQueryOptions = (villageId: string | null | undefined) =>
	queryOptions({
		queryKey: ['locations', 'village-chain', villageId],
		queryFn: () => resolveVillageChain(villageId as string),
		staleTime: 5 * 60_000,
		enabled: Boolean(villageId),
	});
