import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for service tickets (`/service-tickets`, ADR-0011 step 6c).
 * The warranty is checked when a ticket is opened and stored on it.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const TICKET_STATUSES = ['new', 'in_progress', 'resolved', 'closed'] as const;
export type TTicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_CHANNELS = ['phone', 'whatsapp', 'email', 'web', 'onsite', 'other'] as const;
export type TTicketChannel = (typeof TICKET_CHANNELS)[number];

export const TICKET_STATUS_VARIANT: Record<TTicketStatus, 'default' | 'secondary' | 'outline'> = {
	new: 'default',
	in_progress: 'secondary',
	resolved: 'secondary',
	closed: 'outline',
};

export type TServiceTicket = {
	id: string;
	code: string;
	customerId: string;
	customerName: string;
	projectId: string | null;
	serialNumber: string | null;
	deviceDescription: string | null;
	channel: TTicketChannel;
	reporterName: string;
	reporterContact: string | null;
	complaint: string;
	reportedAt: string;
	inWarranty: boolean;
	warrantyEndsOn: string | null;
	warrantyCode: string | null;
	status: TTicketStatus;
	assigneeUserId: string | null;
	assignee: { userId: string; name: string } | null;
	resolution: string | null;
	serviceCost: number;
	resolvedAt: string | null;
	confirmedByName: string | null;
	confirmationChannel: TTicketChannel | null;
	confirmedAt: string | null;
	closedAt: string | null;
};

export type TWarrantyCheck = {
	customerId: string | null;
	projectId: string | null;
	projectCode: string | null;
	deviceDescription: string | null;
	inWarranty: boolean;
	warrantyEndsOn: string | null;
	warrantyCode: string | null;
};

export type TTicketInput = {
	customerId: string;
	projectId: string | null;
	serialNumber: string | null;
	deviceDescription: string | null;
	channel: TTicketChannel;
	reporterName: string;
	reporterContact: string | null;
	complaint: string;
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

export function ticketsQueryOptions(params: { page?: number; search?: string; status?: TTicketStatus }) {
	return queryOptions({
		queryKey: ['tickets', 'list', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TServiceTicket[]>(`/service-tickets${search.size ? `?${search}` : ''}`)) as TApiPaginatedResponse<TServiceTicket>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function ticketQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['tickets', 'detail', id] as const,
		queryFn: async () => (await request<TServiceTicket>(`/service-tickets/${id}`)).data as TServiceTicket,
		retry: false,
	});
}

export function techniciansQueryOptions(enabled: boolean) {
	return queryOptions({
		queryKey: ['tickets', 'technicians'] as const,
		queryFn: async () => (await request<{ userId: string; name: string }[]>('/service-tickets/technicians')).data as { userId: string; name: string }[],
		enabled,
	});
}

export async function checkWarranty(query: { serialNumber?: string; projectId?: string }): Promise<TWarrantyCheck> {
	const search = new URLSearchParams();
	if (query.serialNumber) search.set('serialNumber', query.serialNumber);
	if (query.projectId) search.set('projectId', query.projectId);
	return (await request<TWarrantyCheck>(`/service-tickets/warranty-check?${search}`)).data as TWarrantyCheck;
}

export const createTicket = (input: TTicketInput) => send<TServiceTicket>('/service-tickets', 'POST', input);
export const assignTicket = (id: string, assigneeUserId: string) => send<TServiceTicket>(`/service-tickets/${id}/assign`, 'POST', { assigneeUserId });
export const startTicket = (id: string) => send<TServiceTicket>(`/service-tickets/${id}/start`, 'POST');
export const resolveTicket = (id: string, input: { resolution: string; serviceCost: number }) => send<TServiceTicket>(`/service-tickets/${id}/resolve`, 'POST', input);
export const reopenTicket = (id: string) => send<TServiceTicket>(`/service-tickets/${id}/reopen`, 'POST');
export const closeTicket = (id: string, input: { confirmedByName: string; confirmationChannel: TTicketChannel }) =>
	send<TServiceTicket>(`/service-tickets/${id}/close`, 'POST', input);
