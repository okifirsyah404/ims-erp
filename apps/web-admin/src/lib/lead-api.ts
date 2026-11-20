import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { authClient } from './auth-client';
import { erpRoleGrants } from './permissions';
import type { TCustomerInput } from './customer-api';

/**
 * API client for leads (`/projects/leads`, owned by the project module, ADR-0024).
 *
 * @remarks
 * Leads are company-wide. The server decides visibility: `lead:assign`
 * holders see every lead, everyone else only leads assigned to them.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const LEAD_STATUSES = ['new', 'contacted', 'survey', 'quotation', 'won', 'lost'] as const;
export type TLeadStatus = (typeof LEAD_STATUSES)[number];
/** Badge look per status: open stages neutral, won highlighted, lost muted. */
export const LEAD_STATUS_VARIANT: Record<TLeadStatus, 'default' | 'secondary' | 'outline'> = {
	new: 'secondary',
	contacted: 'secondary',
	survey: 'secondary',
	quotation: 'secondary',
	won: 'default',
	lost: 'outline',
};

/** Statuses a person may move an open lead to (won only through conversion). */
export const LEAD_OPEN_STATUSES = ['new', 'contacted', 'survey', 'quotation'] as const;

export const LEAD_SOURCES = ['website', 'whatsapp', 'instagram', 'phone', 'referral', 'walk_in', 'other'] as const;
export type TLeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_ACTIVITY_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'survey', 'note'] as const;
export type TLeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];

export type TLeadChannel = 'rfq' | 'contact' | 'demo';
export type TPerson = { userId: string; name: string };

export type TLead = {
	id: string;
	name: string;
	companyName: string | null;
	email: string | null;
	phone: string | null;
	whatsapp: string | null;
	source: TLeadSource;
	status: TLeadStatus;
	needs: string | null;
	estimatedValue: number | null;
	ownerUserId: string | null;
	assignee: TPerson | null;
	nextFollowUpAt: string | null;
	/** Customer person the lead was converted into (`customer.customers`). */
	customerId: string | null;
	companyId: string | null;
	lostReason: string | null;
	channel: TLeadChannel | null;
	reference: string | null;
	createdAt: string;
};

export type TLeadActivity = {
	id: string;
	activityType: TLeadActivityType;
	notes: string;
	occurredAt: string;
	author: TPerson | null;
};

export type TLeadAttachment = { id: string; fileName: string; contentType: string; sizeBytes: number };

export type TLeadDetail = TLead & { activities: TLeadActivity[]; attachments: TLeadAttachment[] };

export type TLeadInput = {
	name: string;
	companyName: string | null;
	phone: string | null;
	whatsapp: string | null;
	email: string | null;
	source: TLeadSource;
	needs: string | null;
	/** Integer IDR minor units. */
	estimatedValue: number | null;
	/** Unix ms. */
	nextFollowUpAt: number | null;
};

export type TLeadListParams = {
	page?: number;
	limit?: number;
	search?: string;
	status?: TLeadStatus;
	source?: TLeadSource;
	assigned?: 'me' | 'unassigned';
	followUpDue?: boolean;
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

export function leadsQueryOptions(params: TLeadListParams) {
	return queryOptions({
		queryKey: ['crm', 'leads', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '' && value !== false) search.set(key, String(value));
			}
			const envelope = (await request<TLead[]>(`/projects/leads${search.size ? `?${search}` : ''}`)) as TApiPaginatedResponse<TLead>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function leadQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['crm', 'leads', id] as const,
		queryFn: async () => (await request<TLeadDetail>(`/projects/leads/${id}`)).data as TLeadDetail,
		retry: false,
	});
}

export const createLead = (input: TLeadInput & { assignedTo?: string | null }) => send<TLead>('/projects/leads', 'POST', input);
export const updateLead = (id: string, input: Partial<TLeadInput>) => send<TLead>(`/projects/leads/${id}`, 'PATCH', input);
export const setLeadStatus = (id: string, status: TLeadStatus, lostReason?: string) =>
	send<TLead>(`/projects/leads/${id}/status`, 'POST', { status, lostReason });
export const assignLead = (id: string, userId: string | null) => send<TLead>(`/projects/leads/${id}/assign`, 'POST', { userId });
export const addLeadActivity = (
	id: string,
	input: { activityType: TLeadActivityType; notes: string; nextFollowUpAt?: number | null },
) => send<TLeadActivity>(`/projects/leads/${id}/activities`, 'POST', input);
export const convertLead = (id: string, input: { customerId: string } | { customer: TCustomerInput }) =>
	send<TLead>(`/projects/leads/${id}/convert`, 'POST', input);
export const archiveLead = (id: string) => send<null>(`/projects/leads/${id}`, 'DELETE');
export const leadAttachmentUrl = (leadId: string, attachmentId: string) =>
	send<{ url: string; expiresIn: number }>(`/projects/leads/${leadId}/attachments/${attachmentId}/url`, 'GET');

/** Roles whose catalog grants include `lead:read` (UX filter only). */
function canReadLeads(role: string): boolean {
	return role
		.split(',')
		.map((name) => name.trim())
		.some((name) => (erpRoleGrants as Record<string, { lead?: readonly string[] }>)[name]?.lead?.includes('read'));
}

/**
 * Assignment candidates: members of the active organization whose role can
 * read leads. UX filter only — the server re-checks every assignment with
 * the organization's (possibly edited) roles.
 */
export function leadAssigneesQueryOptions(enabled: boolean) {
	return queryOptions({
		queryKey: ['crm', 'lead-assignees'] as const,
		enabled,
		staleTime: 60_000,
		queryFn: async (): Promise<TPerson[]> => {
			const { data } = await authClient.organization.listMembers({ query: { limit: 200 } });
			return (data?.members ?? [])
				.filter((member) => canReadLeads(member.role))
				.map((member) => ({ userId: member.userId, name: member.user.name }));
		},
	});
}
