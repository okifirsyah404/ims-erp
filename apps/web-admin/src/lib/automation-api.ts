import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/** API client for the n8n event log (`/automation/outbox`, M04). */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const OUTBOX_STATUSES = ['pending', 'published', 'failed'] as const;
export type TOutboxStatus = (typeof OUTBOX_STATUSES)[number];
export const OUTBOX_TOPICS = ['lead.created', 'invoice.issued', 'receipt.recorded', 'license.due', 'service_ticket.updated'] as const;
export type TOutboxTopic = (typeof OUTBOX_TOPICS)[number];

export const OUTBOX_STATUS_VARIANT: Record<TOutboxStatus, 'default' | 'secondary' | 'destructive'> = {
	pending: 'secondary',
	published: 'default',
	failed: 'destructive',
};

export type TOutboxMessage = {
	id: string;
	topic: TOutboxTopic;
	aggregateType: string | null;
	aggregateId: string | null;
	payload: Record<string, unknown>;
	status: TOutboxStatus;
	attempts: number;
	lastAttemptAt: string | null;
	publishedAt: string | null;
	responseStatus: number | null;
	errorMessage: string | null;
	createdAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: { 'Accept-Language': currentLanguage() },
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	return envelope;
}

export function outboxQueryOptions(params: { page?: number; status?: TOutboxStatus; topic?: TOutboxTopic }) {
	return queryOptions({
		queryKey: ['automation', 'outbox', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
			const envelope = (await request<TOutboxMessage[]>(`/automation/outbox${search.size ? `?${search}` : ''}`)) as TApiPaginatedResponse<TOutboxMessage>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export const outboxSummaryQueryOptions = () =>
	queryOptions({
		queryKey: ['automation', 'outbox', 'summary'] as const,
		queryFn: async () => (await request<{ counts: Record<string, number>; configured: boolean }>('/automation/outbox/summary')).data!,
	});

export const retryOutbox = async (id: string) => (await request<TOutboxMessage>(`/automation/outbox/${id}/retry`, { method: 'POST' })).data!;
