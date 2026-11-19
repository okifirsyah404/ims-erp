import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the supplier master (`/suppliers`, ADR-0024 `supplier`
 * module): companies (the B2B entity a purchase order is issued to) and
 * people (the supplier-side PIC). Company-wide. The backend has no address
 * endpoints yet, so addresses are neither shown nor edited here.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const SUPPLIER_TYPES = ['company', 'government'] as const;
export type TSupplierType = (typeof SUPPLIER_TYPES)[number];

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
	whatsapp: string | null;
	website: string | null;
	paymentTermsDays: number;
	paymentTermNote: string | null;
	bankName: string | null;
	bankAccountNumber: string | null;
	bankAccountHolder: string | null;
	status: 'active' | 'inactive';
	notes: string | null;
};

/** `supplier.suppliers` row: the supplier-side person in charge. */
export type TSupplierPerson = {
	id: string;
	companyId: string | null;
	name: string;
	title: string | null;
	phone: string | null;
	email: string | null;
	whatsapp: string | null;
	isPrimary: boolean;
	status: 'active' | 'inactive';
};

export type TSupplierCompanyDetail = TSupplierCompany & { people: TSupplierPerson[] };

export type TSupplierCompanyInput = Omit<TSupplierCompany, 'id' | 'status'>;

export type TSupplierPersonInput = {
	companyId: string | null;
	name: string;
	title: string | null;
	phone: string | null;
	email: string | null;
	whatsapp: string | null;
	isPrimary: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
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

export function supplierCompaniesQueryOptions(params: {
	page?: number;
	limit?: number;
	search?: string;
	status?: 'active' | 'inactive';
}) {
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
export const removeSupplierPerson = async (id: string) => {
	await request(`/suppliers/people/${id}`, { method: 'DELETE' });
};
