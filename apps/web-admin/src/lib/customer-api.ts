import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for customers and contacts (`/customers`, ADR-0011 step 3a).
 *
 * @remarks
 * Customers are company-wide: every organization (department) sees the same
 * list. `customer:read|create|update|archive` decide what the caller may do.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const CUSTOMER_TYPES = ['company', 'individual', 'government', 'partner'] as const;
export type TCustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export type TCustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export type TCustomer = {
	id: string;
	code: string;
	customerType: TCustomerType;
	name: string;
	legalName: string | null;
	taxId: string | null;
	email: string | null;
	phone: string | null;
	whatsapp: string | null;
	addressLine: string | null;
	villageId: string | null;
	postalCode: string | null;
	status: TCustomerStatus;
	notes: string | null;
	createdAt: string;
};

export type TCustomerContact = {
	id: string;
	customerId: string;
	name: string;
	position: string | null;
	email: string | null;
	phone: string | null;
	whatsapp: string | null;
	isPrimary: boolean;
};

export type TCustomerDetail = TCustomer & { contacts: TCustomerContact[] };

export type TCustomerInput = {
	code: string;
	customerType: TCustomerType;
	name: string;
	legalName: string | null;
	taxId: string | null;
	email: string | null;
	phone: string | null;
	whatsapp: string | null;
	addressLine: string | null;
	villageId: string | null;
	postalCode: string | null;
	notes: string | null;
};

export type TContactInput = Omit<TCustomerContact, 'id' | 'customerId'>;

export type TCustomerListParams = {
	page?: number;
	limit?: number;
	search?: string;
	status?: TCustomerStatus;
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

export function customersQueryOptions(params: TCustomerListParams) {
	return queryOptions({
		queryKey: ['crm', 'customers', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TCustomer[]>(
				`/customers${search.size ? `?${search}` : ''}`,
			)) as TApiPaginatedResponse<TCustomer>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function customerQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['crm', 'customers', id] as const,
		queryFn: async () => (await request<TCustomerDetail>(`/customers/${id}`)).data as TCustomerDetail,
		retry: false,
	});
}

export async function createCustomer(input: TCustomerInput) {
	return (await request<TCustomer>('/customers', { method: 'POST', body: JSON.stringify(input) })).data as TCustomer;
}

export async function updateCustomer(id: string, input: Partial<TCustomerInput>) {
	return (await request<TCustomer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(input) }))
		.data as TCustomer;
}

export async function setCustomerActive(id: string, active: boolean) {
	return (await request<TCustomer>(`/customers/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }))
		.data as TCustomer;
}

export async function addContact(customerId: string, input: TContactInput) {
	return (
		await request<TCustomerContact>(`/customers/${customerId}/contacts`, {
			method: 'POST',
			body: JSON.stringify(input),
		})
	).data as TCustomerContact;
}

export async function updateContact(customerId: string, contactId: string, input: Partial<TContactInput>) {
	return (
		await request<TCustomerContact>(`/customers/${customerId}/contacts/${contactId}`, {
			method: 'PATCH',
			body: JSON.stringify(input),
		})
	).data as TCustomerContact;
}

export async function removeContact(customerId: string, contactId: string) {
	await request<null>(`/customers/${customerId}/contacts/${contactId}`, { method: 'DELETE' });
}
