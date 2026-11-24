import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the supplier master (`/suppliers`, ADR-0024 `supplier`
 * module): companies (the B2B entity a purchase order is issued to), people
 * (the supplier-side PIC) and their addresses. Company-wide.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const SUPPLIER_TYPES = ['company', 'government', 'individual'] as const;
export type TSupplierType = (typeof SUPPLIER_TYPES)[number];

export const SUPPLIER_SORT_FIELDS = ['name', 'code', 'createdAt'] as const;
export type TSupplierSortField = (typeof SUPPLIER_SORT_FIELDS)[number];
export type TSupplierSortDir = 'asc' | 'desc';

/** `supplier.companies` row. Bank fields are restricted (`supplier:read_bank`). */
export type TSupplierCompany = {
	id: string;
	code: string;
	name: string;
	legalName: string | null;
	supplierType: TSupplierType;
	taxId: string | null;
	email: string | null;
	phone: string | null;
	website: string | null;
	bankName: string | null;
	bankAccountNumber: string | null;
	bankAccountHolder: string | null;
	/** Presigned URL of the single supplier photo, or `null`. */
	imageUrl: string | null;
	status: 'active' | 'inactive';
	notes: string | null;
	createdAt: string;
};

/** `supplier.suppliers` row: the supplier-side person in charge. */
export type TSupplierPerson = {
	id: string;
	companyId: string | null;
	name: string;
	title: string | null;
	phone: string | null;
	email: string | null;
	isPrimary: boolean;
	status: 'active' | 'inactive';
};

/** `supplier.company_addresses` row. */
export type TSupplierCompanyAddress = {
	id: string;
	companyId: string;
	kind: 'office' | 'factory' | 'warehouse' | 'billing' | 'other';
	label: string | null;
	contactName: string | null;
	contactPhone: string | null;
	addressLine: string;
	villageId: string | null;
	postalCode: string | null;
	isPrimary: boolean;
};

/** `supplier.addresses` row of a person. */
export type TSupplierPersonAddress = {
	id: string;
	supplierId: string;
	kind: 'office' | 'other';
	label: string | null;
	addressLine: string;
	villageId: string | null;
	postalCode: string | null;
	isPrimary: boolean;
};

export type TSupplierCompanyDetail = TSupplierCompany & {
	people: TSupplierPerson[];
	addresses: TSupplierCompanyAddress[];
};

export type TSupplierCompanyInput = Omit<
	TSupplierCompany,
	'id' | 'status' | 'imageUrl' | 'createdAt'
>;

export type TSupplierPersonInput = {
	companyId: string | null;
	name: string;
	title: string | null;
	phone: string | null;
	email: string | null;
	isPrimary: boolean;
};

export type TSupplierCompanyAddressInput = {
	kind: TSupplierCompanyAddress['kind'];
	label: string | null;
	contactName: string | null;
	contactPhone: string | null;
	addressLine: string;
	villageId: string | null;
	postalCode: string | null;
	isPrimary: boolean;
};

export type TSupplierPersonAddressInput = {
	kind: TSupplierPersonAddress['kind'];
	label: string | null;
	addressLine: string;
	villageId: string | null;
	postalCode: string | null;
	isPrimary: boolean;
};

export type TSupplierCompanyListParams = {
	page?: number;
	limit?: number;
	search?: string;
	status?: 'active' | 'inactive';
	sortBy?: TSupplierSortField;
	sortDir?: TSupplierSortDir;
};

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			// Server error messages come back in the UI language.
			'Accept-Language': currentLanguage(),
			// Multipart bodies (the photo upload) must set their own boundary.
			...(typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope;
}

const send = async <T>(path: string, method: string, body?: unknown) =>
	(await request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })).data as T;

function query(params: Record<string, unknown>) {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	return search.size ? `?${search}` : '';
}

export function supplierCompaniesQueryOptions(params: TSupplierCompanyListParams) {
	return queryOptions({
		queryKey: ['procurement', 'suppliers', 'companies', params] as const,
		queryFn: async () => {
			const envelope = (await request<TSupplierCompany[]>(
				`/suppliers/companies${query(params)}`,
			)) as TApiPaginatedResponse<TSupplierCompany>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function supplierCompanyQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['procurement', 'suppliers', 'company', id] as const,
		queryFn: async () => (await request<TSupplierCompanyDetail>(`/suppliers/companies/${id}`)).data as TSupplierCompanyDetail,
		retry: false,
	});
}

export function supplierPeopleQueryOptions(companyId: string) {
	return queryOptions({
		queryKey: ['procurement', 'suppliers', 'people', companyId] as const,
		queryFn: async () => {
			const envelope = (await request<TSupplierPerson[]>(
				`/suppliers/people${query({ companyId, limit: 100 })}`,
			)) as TApiPaginatedResponse<TSupplierPerson>;
			return envelope.data;
		},
		enabled: companyId !== '',
	});
}

export const createSupplierCompany = (input: Partial<TSupplierCompanyInput>) =>
	send<TSupplierCompany>('/suppliers/companies', 'POST', input);
export const updateSupplierCompany = (id: string, input: Partial<TSupplierCompanyInput>) =>
	send<TSupplierCompany>(`/suppliers/companies/${id}`, 'PATCH', input);
export const setSupplierCompanyActive = (id: string, active: boolean) =>
	send<TSupplierCompany>(`/suppliers/companies/${id}/${active ? 'activate' : 'deactivate'}`, 'POST');

export const createSupplierPerson = (input: TSupplierPersonInput) => send<TSupplierPerson>('/suppliers/people', 'POST', input);
export const updateSupplierPerson = (id: string, input: Partial<TSupplierPersonInput>) =>
	send<TSupplierPerson>(`/suppliers/people/${id}`, 'PATCH', input);
export const removeSupplierPerson = async (id: string) => {
	await request(`/suppliers/people/${id}`, { method: 'DELETE' });
};

/** Uploads the single supplier photo; the server normalises it to WebP. */
export async function uploadSupplierImage(companyId: string, file: File) {
	const body = new FormData();
	body.set('file', file, `photo.${file.type === 'image/png' ? 'png' : 'webp'}`);
	return (await request<TSupplierCompany>(`/suppliers/companies/${companyId}/image`, {
		method: 'PUT',
		body,
	})).data as TSupplierCompany;
}

export async function removeSupplierImage(companyId: string) {
	await request(`/suppliers/companies/${companyId}/image`, { method: 'DELETE' });
}

export const createSupplierCompanyAddress = (companyId: string, input: TSupplierCompanyAddressInput) =>
	send<TSupplierCompanyAddress>(`/suppliers/companies/${companyId}/addresses`, 'POST', input);
export const updateSupplierCompanyAddress = (
	companyId: string,
	addressId: string,
	input: Partial<TSupplierCompanyAddressInput>,
) => send<TSupplierCompanyAddress>(`/suppliers/companies/${companyId}/addresses/${addressId}`, 'PATCH', input);
export const removeSupplierCompanyAddress = async (companyId: string, addressId: string) => {
	await request(`/suppliers/companies/${companyId}/addresses/${addressId}`, { method: 'DELETE' });
};

export const createSupplierPersonAddress = (supplierId: string, input: TSupplierPersonAddressInput) =>
	send<TSupplierPersonAddress>(`/suppliers/people/${supplierId}/addresses`, 'POST', input);
export const updateSupplierPersonAddress = (
	supplierId: string,
	addressId: string,
	input: Partial<TSupplierPersonAddressInput>,
) => send<TSupplierPersonAddress>(`/suppliers/people/${supplierId}/addresses/${addressId}`, 'PATCH', input);
export const removeSupplierPersonAddress = async (supplierId: string, addressId: string) => {
	await request(`/suppliers/people/${supplierId}/addresses/${addressId}`, { method: 'DELETE' });
};
