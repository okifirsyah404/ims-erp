import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/** API client for the WhatsApp assistant inbox and FAQ (`/automation/whatsapp`, `/automation/faq`, M04 stage 2). */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const CONVERSATION_STATUSES = ['handoff', 'assistant', 'closed'] as const;
export type TConversationStatus = (typeof CONVERSATION_STATUSES)[number];
export const HANDOFF_REASONS = ['no_provider', 'not_found', 'human_requested', 'restricted', 'error'] as const;
export type THandoffReason = (typeof HANDOFF_REASONS)[number];
export type TMessageAuthor = 'customer' | 'assistant' | 'admin' | 'system';
export type TMessageStatus = 'received' | 'processed' | 'pending' | 'sent' | 'failed';

export const CONVERSATION_STATUS_VARIANT: Record<TConversationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
	handoff: 'destructive',
	assistant: 'default',
	closed: 'outline',
};

export type TConversation = {
	id: string;
	chatId: string;
	phone: string;
	contactName: string | null;
	status: TConversationStatus;
	handoffReason: THandoffReason | null;
	handoffAt: string | null;
	assignedUserId: string | null;
	lastMessageAt: string;
	lastMessage?: string | null;
};

export type TWhatsappMessage = {
	id: string;
	direction: 'inbound' | 'outbound';
	author: TMessageAuthor;
	body: string;
	status: TMessageStatus;
	errorMessage: string | null;
	faqEntryId: string | null;
	attempts: number;
	createdAt: string;
};

export type TConversationDetail = TConversation & { messages: TWhatsappMessage[] };
export type TWhatsappStatus = { gateway: boolean; webhook: boolean; assistant: boolean; counts: Record<string, number> };

export type TFaqEntry = {
	id: string;
	question: string;
	answer: string;
	keywords: string | null;
	isActive: boolean;
	sortOrder: number;
	updatedAt: string;
};
export type TFaqInput = Pick<TFaqEntry, 'question' | 'answer' | 'keywords' | 'isActive' | 'sortOrder'>;

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

export const whatsappStatusQueryOptions = () =>
	queryOptions({
		queryKey: ['whatsapp', 'status'] as const,
		queryFn: async () => (await request<TWhatsappStatus>('/automation/whatsapp/status')).data!,
	});

export function conversationsQueryOptions(params: { page?: number; status?: TConversationStatus; search?: string }) {
	return queryOptions({
		queryKey: ['whatsapp', 'conversations', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
			const envelope = (await request<TConversation[]>(
				`/automation/whatsapp/conversations${search.size ? `?${search}` : ''}`,
			)) as TApiPaginatedResponse<TConversation>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
		refetchInterval: 15_000,
	});
}

export const conversationQueryOptions = (id: string) =>
	queryOptions({
		queryKey: ['whatsapp', 'conversation', id] as const,
		queryFn: async () => (await request<TConversationDetail>(`/automation/whatsapp/conversations/${id}`)).data!,
		refetchInterval: 10_000,
	});

const post = async <T>(path: string, body?: unknown) =>
	(await request<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).data!;

export const replyToConversation = (id: string, text: string) => post<TWhatsappMessage>(`/automation/whatsapp/conversations/${id}/reply`, { text });
export const resumeConversation = (id: string) => post<TConversation>(`/automation/whatsapp/conversations/${id}/resume`);
export const closeConversation = (id: string) => post<TConversation>(`/automation/whatsapp/conversations/${id}/close`);
export const retryMessage = (id: string) => post<TWhatsappMessage>(`/automation/whatsapp/messages/${id}/retry`);

export const faqQueryOptions = () =>
	queryOptions({
		queryKey: ['whatsapp', 'faq'] as const,
		queryFn: async () => (await request<TFaqEntry[]>('/automation/faq')).data!,
	});

export const createFaq = (input: TFaqInput) => post<TFaqEntry>('/automation/faq', input);
export const updateFaq = async (id: string, input: TFaqInput) =>
	(await request<TFaqEntry>(`/automation/faq/${id}`, { method: 'PUT', body: JSON.stringify(input) })).data!;
export const removeFaq = async (id: string) => {
	await request(`/automation/faq/${id}`, { method: 'DELETE' });
};
