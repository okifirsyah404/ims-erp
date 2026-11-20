import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from './organization-store';

/**
 * API client for the license register (`/projects/licenses`, M03 stage 1). Billing
 * stays in the sales flow (SPH → SO → invoice); a contract may point to its
 * sales order. "Due" and "expired" are derived by the server from the end
 * date.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const CONTRACT_STATUSES = ['draft', 'active', 'suspended', 'terminated', 'renewed'] as const;
export type TContractStatus = (typeof CONTRACT_STATUSES)[number];
export const BILLING_CYCLES = ['monthly', 'quarterly', 'semi_annual', 'annual', 'one_time'] as const;
export type TBillingCycle = (typeof BILLING_CYCLES)[number];
export const APPLICATION_SOURCES = ['third_party', 'own'] as const;
export type TApplicationSource = (typeof APPLICATION_SOURCES)[number];

/** Days ahead the due list looks (the server's default window). */
export const DUE_WITHIN_DAYS = 30;

/** Days an ended license keeps working with a warning (owner decision, M03 stage 2). */
export const GRACE_DAYS = 7;

export const CONTRACT_STATUS_VARIANT: Record<TContractStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
	draft: 'outline',
	active: 'default',
	suspended: 'secondary',
	terminated: 'destructive',
	renewed: 'outline',
};

export type TLicensableApplication = {
	id: string;
	code: string;
	name: string;
	vendor: string | null;
	source: TApplicationSource;
	description: string | null;
	status: 'active' | 'retired';
};

export type TLicenseContract = {
	id: string;
	code: string;
	customerId: string;
	customerName: string;
	licenseApplicationId: string;
	applicationCode: string;
	applicationName: string;
	applicationSource: TApplicationSource;
	packageName: string | null;
	orderId: string | null;
	/** `YYYY-MM-DD` (Asia/Jakarta). */
	startDate: string | null;
	/** Null = perpetual. */
	endDate: string | null;
	billingCycle: TBillingCycle;
	/** Integer IDR minor units. */
	contractValue: number;
	status: TContractStatus;
	renewedFromContractId: string | null;
	notes: string | null;
	terminationReason: string | null;
	isExpired: boolean;
	isDue: boolean;
	daysLeft: number | null;
	/** End date + the grace days; null when perpetual. */
	graceEndsOn: string | null;
};

export type TLicenseActivation = {
	id: string;
	licenseKeyId: string;
	instanceId: string;
	deviceName: string | null;
	activatedAt: string;
	lastSeenAt: string;
	lastIp: string | null;
	status: 'active' | 'deactivated';
	deactivatedAt: string | null;
};

export type TLicenseEvent = {
	id: string;
	eventType: 'validated' | 'activated' | 'deactivated' | 'renewed' | 'suspended' | 'reactivated' | 'terminated' | 'key_revoked';
	result: string;
	licenseKeyId: string | null;
	licenseContractId: string | null;
	contractCode: string | null;
	customerName: string | null;
	applicationApiKeyId: string | null;
	instanceId: string | null;
	ipAddress: string | null;
	actorUserId: string | null;
	description: string | null;
	eventAt: string;
};

export type TApplicationApiKey = {
	id: string;
	licenseApplicationId: string;
	name: string;
	keyStart: string | null;
	status: 'active' | 'revoked';
	createdAt: string;
	revokedAt: string | null;
	lastUsedAt: string | null;
	/** Who issued / revoked the key (the API key is issued as that member). */
	createdByName: string | null;
	revokedByName: string | null;
};

export type TLicenseKey = {
	id: string;
	/** Masked (`••••-WXYZ`) when the caller lacks `license:read_key`. */
	licenseKey: string;
	masked: boolean;
	keySource: 'vendor' | 'generated';
	maxActivations: number;
	expiresOn: string | null;
	status: 'active' | 'revoked';
	notes: string | null;
	revokeReason: string | null;
	activations: TLicenseActivation[];
};

export type TLicenseContractDetail = TLicenseContract & {
	keys: TLicenseKey[];
	renewedFrom: { id: string; code: string } | null;
	renewal: { id: string; code: string; status: TContractStatus; orderId: string | null } | null;
	events: TLicenseEvent[];
};

export type TContractInput = {
	customerId: string;
	licenseApplicationId: string;
	packageName: string | null;
	orderId: string | null;
	startDate: string | null;
	endDate: string | null;
	billingCycle: TBillingCycle;
	contractValue: number;
	notes: string | null;
};

export type TApplicationInput = Pick<TLicensableApplication, 'code' | 'name' | 'vendor' | 'source' | 'description'>;
export type TKeyInput = { licenseKey: string | null; maxActivations: number; expiresOn: string | null; notes: string | null };
export type TLicenseSummary = { endingWithinDays: number; endingSoon: number; ended: number };

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			...organizationHeaders(),
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

export function contractsQueryOptions(params: { page?: number; search?: string; status?: TContractStatus; dueWithinDays?: number }) {
	return queryOptions({
		queryKey: ['licenses', 'list', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TLicenseContract[]>(`/projects/licenses${search.size ? `?${search}` : ''}`)) as TApiPaginatedResponse<TLicenseContract>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function contractQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['licenses', 'detail', id] as const,
		queryFn: async () => (await request<TLicenseContractDetail>(`/projects/licenses/${id}`)).data as TLicenseContractDetail,
		retry: false,
	});
}

export function applicationsQueryOptions(includeRetired = false) {
	return queryOptions({
		queryKey: ['licenses', 'applications', includeRetired] as const,
		queryFn: async () =>
			(await request<TLicensableApplication[]>(`/projects/licenses/applications?includeRetired=${includeRetired}`)).data as TLicensableApplication[],
	});
}

export function licenseSummaryQueryOptions(enabled: boolean) {
	return queryOptions({
		queryKey: ['licenses', 'summary'] as const,
		queryFn: async () => (await request<TLicenseSummary>('/projects/licenses/summary')).data as TLicenseSummary,
		enabled,
	});
}

export function eventsQueryOptions(params: { page?: number; contractId?: string }) {
	return queryOptions({
		queryKey: ['licenses', 'events', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TLicenseEvent[]>(`/projects/licenses/events${search.size ? `?${search}` : ''}`)) as TApiPaginatedResponse<TLicenseEvent>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function apiKeysQueryOptions(applicationId: string) {
	return queryOptions({
		queryKey: ['licenses', 'api-keys', applicationId] as const,
		queryFn: async () => (await request<TApplicationApiKey[]>(`/projects/licenses/applications/${applicationId}/api-keys`)).data as TApplicationApiKey[],
	});
}

export const issueApiKey = (applicationId: string, name: string) =>
	send<{ apiKey: TApplicationApiKey; secret: string }>(`/projects/licenses/applications/${applicationId}/api-keys`, 'POST', { name });
export const revokeApiKey = (applicationId: string, apiKeyId: string) =>
	send<TApplicationApiKey>(`/projects/licenses/applications/${applicationId}/api-keys/${apiKeyId}/revoke`, 'POST');
export const releaseSeat = (contractId: string, activationId: string) =>
	send<TLicenseActivation>(`/projects/licenses/${contractId}/activations/${activationId}/release`, 'POST');

export const createApplication = (input: TApplicationInput) => send<TLicensableApplication>('/projects/licenses/applications', 'POST', input);
export const updateApplication = (id: string, input: TApplicationInput) => send<TLicensableApplication>(`/projects/licenses/applications/${id}`, 'PUT', input);
export const retireApplication = (id: string) => send<TLicensableApplication>(`/projects/licenses/applications/${id}/retire`, 'POST');
export const restoreApplication = (id: string) => send<TLicensableApplication>(`/projects/licenses/applications/${id}/restore`, 'POST');

export const createContract = (input: TContractInput) => send<TLicenseContract>('/projects/licenses', 'POST', input);
export const updateContract = (id: string, input: TContractInput) => send<TLicenseContract>(`/projects/licenses/${id}`, 'PUT', input);
export const activateContract = (id: string) => send<TLicenseContract>(`/projects/licenses/${id}/activate`, 'POST');
export const suspendContract = (id: string, reason: string) => send<TLicenseContract>(`/projects/licenses/${id}/suspend`, 'POST', { reason });
export const reactivateContract = (id: string) => send<TLicenseContract>(`/projects/licenses/${id}/reactivate`, 'POST');
export const terminateContract = (id: string, reason: string) => send<TLicenseContract>(`/projects/licenses/${id}/terminate`, 'POST', { reason });
export const renewContract = (id: string) => send<TLicenseContract>(`/projects/licenses/${id}/renew`, 'POST');
export const addLicenseKey = (id: string, input: TKeyInput) => send<TLicenseKey>(`/projects/licenses/${id}/keys`, 'POST', input);
export const revokeLicenseKey = (id: string, keyId: string, reason: string) =>
	send<TLicenseKey>(`/projects/licenses/${id}/keys/${keyId}/revoke`, 'POST', { reason });
