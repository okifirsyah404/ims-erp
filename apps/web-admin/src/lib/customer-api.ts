import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the customer master (`/customers`, ADR-0024).
 *
 * @remarks
 * Customers are company-wide. A *company* (`/customers/companies`) is the B2B
 * entity; a *customer* is a person (`/customers/people`): an individual buyer,
 * or the contact of a company (the old `customer_contacts` were merged into
 * people). Documents name the person (`customerId`) and, optionally, the
 * billed company (`companyId`). `customer:read|create|update|archive` decide
 * what the caller may do.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const CUSTOMER_TYPES = ['individual', 'contact'] as const;
export type TCustomerType = (typeof CUSTOMER_TYPES)[number];

export const COMPANY_TYPES = ['company', 'government', 'partner'] as const;
export type TCompanyType = (typeof COMPANY_TYPES)[number];

export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export type TCustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const COMPANY_ADDRESS_KINDS = ['billing', 'shipping', 'service', 'site', 'other'] as const;
export type TCompanyAddressKind = (typeof COMPANY_ADDRESS_KINDS)[number];

export const CUSTOMER_ADDRESS_KINDS = ['residence', 'office', 'billing', 'other'] as const;
export type TCustomerAddressKind = (typeof CUSTOMER_ADDRESS_KINDS)[number];

/** Server-side sort of the list endpoints. */
export const CUSTOMER_SORTS = ['code', 'name', 'status', 'createdAt'] as const;
export type TCustomerSort = (typeof CUSTOMER_SORTS)[number];
export type TSortOrder = 'asc' | 'desc';

/** Short reference to a company or person. */
export type TCustomerRef = { id: string; code: string; name: string };

/**
 * The Better Auth account of a person (ERP-0114): one account per person.
 * `image` is a short-lived presigned URL; a verified email is locked.
 */
export type TCustomerAccount = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	username: string | null;
	image: string | null;
};

/** A person: an individual customer, or a contact (owner or staff) of a company. */
export type TCustomer = {
	id: string;
	code: string;
	companyId: string | null;
	customerType: TCustomerType;
	name: string;
	position: string | null;
	/** E.164. The email lives on `account`. */
	phone: string | null;
	status: TCustomerStatus;
	userId: string | null;
	portalRole: string | null;
	portalStatus: string | null;
	portalPasswordChangeRequired: boolean;
	notes: string | null;
	createdAt: string;
	account: TCustomerAccount | null;
	company: TCustomerRef | null;
	/** Owns their company (or is an individual, who owns their own account). */
	isOwner: boolean;
};

/** Returned once by a create: shown to staff, also emailed to the customer. */
export type TCustomerCredentials = { username: string; password: string };

export type TCustomerAddress = {
	id: string;
	customerId: string;
	kind: TCustomerAddressKind;
	label: string | null;
	addressLine: string;
	villageId: string | null;
	postalCode: string | null;
	isPrimary: boolean;
};

export type TCustomerDetail = TCustomer & { addresses: TCustomerAddress[] };

export type TCustomerCreated = TCustomerDetail & { credentials: TCustomerCredentials };

/** A B2B customer company. */
export type TCompany = {
	id: string;
	code: string;
	name: string;
	legalName: string | null;
	companyType: TCompanyType;
	taxId: string | null;
	email: string | null;
	phone: string | null;
	website: string | null;
	status: TCustomerStatus;
	/** The one owner: a contact of this company (ERP-0114). */
	ownerCustomerId: string | null;
	owner: TCustomerRef | null;
	notes: string | null;
	createdAt: string;
};

export type TCompanyAddress = {
	id: string;
	companyId: string;
	kind: TCompanyAddressKind;
	label: string | null;
	contactName: string | null;
	contactPhone: string | null;
	addressLine: string;
	villageId: string | null;
	postalCode: string | null;
	isPrimary: boolean;
};

export type TCompanyDetail = TCompany & { addresses: TCompanyAddress[] };

/** A company created together with the person, who becomes its owner. */
export type TInlineCompanyInput = { code?: string; name: string; companyType: TCompanyType };

export type TCustomerInput = {
	/** Optional on create: omitted, the server generates it (`customer.code_numberings`). */
	code?: string;
	companyId: string | null;
	/** Create only. */
	newCompany?: TInlineCompanyInput | null;
	/** Make this contact the owner of its company. */
	isOwner: boolean;
	name: string;
	position: string | null;
	/** The email of the person's account; locked once verified. */
	email: string;
	phone: string | null;
	notes: string | null;
	/** Edit only. */
	status?: TCustomerStatus;
};

export type TCompanyInput = {
	/** Optional on create: omitted, the server generates it (`customer.code_numberings`). */
	code?: string;
	companyType: TCompanyType;
	name: string;
	legalName: string | null;
	taxId: string | null;
	email: string | null;
	phone: string | null;
	website: string | null;
	notes: string | null;
	/** Edit only. */
	status?: TCustomerStatus;
	/** Edit only: one of the company's contacts, or null. */
	ownerCustomerId?: string | null;
};

export type TCompanyAddressInput = Omit<TCompanyAddress, 'id' | 'companyId'>;
export type TCustomerAddressInput = Omit<TCustomerAddress, 'id' | 'customerId'>;

export type TCustomerListParams = {
	page?: number;
	limit?: number;
	search?: string;
	status?: TCustomerStatus;
	customerType?: TCustomerType;
	companyId?: string;
	sort?: TCustomerSort;
	order?: TSortOrder;
};

export type TCompanyListParams = {
	page?: number;
	limit?: number;
	search?: string;
	status?: TCustomerStatus;
	companyType?: TCompanyType;
	sort?: TCustomerSort;
	order?: TSortOrder;
};

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			// Server error messages come back in the UI language.
			'Accept-Language': currentLanguage(),
			// A FormData body sets its own multipart boundary.
			...(init?.body != null && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
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

/* -------------------------------- people --------------------------------- */

export function customersQueryOptions(params: TCustomerListParams) {
	return queryOptions({
		queryKey: ['crm', 'customers', 'people', params] as const,
		queryFn: async () => {
			const envelope = (await request<TCustomer[]>(`/customers/people${query(params)}`)) as TApiPaginatedResponse<TCustomer>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function customerQueryOptions(id: string, enabled = true) {
	return queryOptions({
		queryKey: ['crm', 'customers', 'people', id] as const,
		queryFn: async () => (await request<TCustomerDetail>(`/customers/people/${id}`)).data as TCustomerDetail,
		enabled,
		retry: false,
	});
}

/** Creates the person and their account; the credentials come back once. */
export const createCustomer = (input: TCustomerInput) => send<TCustomerCreated>('/customers/people', 'POST', input);
export const updateCustomer = (id: string, input: Partial<TCustomerInput>) =>
	send<TCustomerDetail>(`/customers/people/${id}`, 'PATCH', input);

/** Uploads the person's photo (stored on their account); returns its URL. */
export async function uploadCustomerPhoto(id: string, file: File): Promise<{ image: string }> {
	const body = new FormData();
	body.set('file', file);
	return (await request<{ image: string }>(`/customers/people/${id}/photo`, { method: 'POST', body })).data as {
		image: string;
	};
}

export const removeCustomerPhoto = (id: string) => send<null>(`/customers/people/${id}/photo`, 'DELETE');
export const setCustomerActive = (id: string, active: boolean) =>
	send<TCustomer>(`/customers/people/${id}/${active ? 'activate' : 'deactivate'}`, 'POST');

/* ------------------------------- companies ------------------------------- */

export function companiesQueryOptions(params: TCompanyListParams) {
	return queryOptions({
		queryKey: ['crm', 'customers', 'companies', params] as const,
		queryFn: async () => {
			const envelope = (await request<TCompany[]>(`/customers/companies${query(params)}`)) as TApiPaginatedResponse<TCompany>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function companyQueryOptions(id: string, enabled = true) {
	return queryOptions({
		queryKey: ['crm', 'customers', 'companies', id] as const,
		queryFn: async () => (await request<TCompanyDetail>(`/customers/companies/${id}`)).data as TCompanyDetail,
		enabled,
		retry: false,
	});
}

export const createCompany = (input: TCompanyInput) => send<TCompany>('/customers/companies', 'POST', input);
export const updateCompany = (id: string, input: Partial<TCompanyInput>) =>
	send<TCompany>(`/customers/companies/${id}`, 'PATCH', input);
export const setCompanyActive = (id: string, active: boolean) =>
	send<TCompany>(`/customers/companies/${id}/${active ? 'activate' : 'deactivate'}`, 'POST');

export const addCompanyAddress = (companyId: string, input: TCompanyAddressInput) =>
	send<TCompanyAddress>(`/customers/companies/${companyId}/addresses`, 'POST', input);
export const updateCompanyAddress = (companyId: string, addressId: string, input: Partial<TCompanyAddressInput>) =>
	send<TCompanyAddress>(`/customers/companies/${companyId}/addresses/${addressId}`, 'PATCH', input);
export const removeCompanyAddress = (companyId: string, addressId: string) =>
	send<null>(`/customers/companies/${companyId}/addresses/${addressId}`, 'DELETE');

export const addCustomerAddress = (customerId: string, input: TCustomerAddressInput) =>
	send<TCustomerAddress>(`/customers/people/${customerId}/addresses`, 'POST', input);
export const updateCustomerAddress = (customerId: string, addressId: string, input: Partial<TCustomerAddressInput>) =>
	send<TCustomerAddress>(`/customers/people/${customerId}/addresses/${addressId}`, 'PATCH', input);
export const removeCustomerAddress = (customerId: string, addressId: string) =>
	send<null>(`/customers/people/${customerId}/addresses/${addressId}`, 'DELETE');
