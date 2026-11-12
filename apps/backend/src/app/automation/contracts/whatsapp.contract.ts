import { z } from 'zod';
import {
	CONVERSATION_STATUSES,
	type HandoffReason,
	type TConversationInsert,
	type TConversationSelect,
	type TFaqEntryInsert,
	type TFaqEntrySelect,
	type TWhatsappMessageInsert,
	type TWhatsappMessageSelect,
} from '@drizzle/schemas/automation.schema';
import type { TPaginationResult } from '@ims-erp/common';

/**
 * The WhatsApp assistant (M04 stage 2, decisions of 2026-11-07): WAHA posts
 * chats to the ERP, the assistant answers from the FAQ and the published
 * catalog only or hands the chat to an admin, and every message is logged.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => value || null);

export const faqBodySchema = z.object({
	question: z.string().trim().min(1).max(300),
	answer: z.string().trim().min(1).max(4000),
	keywords: optionalText(500),
	isActive: z.boolean().default(true),
	sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export type TFaqBody = z.output<typeof faqBodySchema>;

export const conversationListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(CONVERSATION_STATUSES).optional(),
	search: z.string().trim().max(100).optional(),
});
export type TConversationListQuery = z.output<typeof conversationListQuerySchema>;

export const replyBodySchema = z.object({ text: z.string().trim().min(1).max(4000) });
export const idParamSchema = z.object({ id: z.uuid() });

/** One inbound chat message as read from a WAHA `message` webhook. */
export type TInboundMessage = {
	externalId: string;
	chatId: string;
	phone: string;
	contactName: string | null;
	body: string;
	hasMedia: boolean;
};

/** Server config the inbox needs (the HMAC key WAHA signs webhooks with). */
export type TWhatsappSettings = { webhookSecret: string | null };

/** Port to WAHA's send API. */
export interface IWhatsappGateway {
	/** URL and API key are set in server config. */
	readonly configured: boolean;
	sendText(chatId: string, text: string): Promise<{ ok: true; externalId: string | null } | { ok: false; error: string }>;
}

/** What the assistant may use to answer: approved FAQ entries and published products. */
export type TAssistantContext = {
	faqs: Pick<TFaqEntrySelect, 'id' | 'question' | 'answer'>[];
	products: { name: string; category: string; price: number | null; stock: string }[];
};

export type TAssistantAnswer = { kind: 'answer'; text: string; faqEntryId: string | null } | { kind: 'unsure' };

/**
 * Port to the AI provider (provider-neutral). It only produces text: it has
 * no tool that can change ERP data, so it cannot grant a discount or create
 * a transaction whatever the prompt says.
 */
export interface IAssistantModel {
	readonly configured: boolean;
	answer(question: string, history: { role: 'customer' | 'assistant'; text: string }[], context: TAssistantContext): Promise<TAssistantAnswer>;
}

/** Port to the queue that processes inbound messages in the background. */
export interface IInboundDispatcher {
	enqueue(messageId: string): Promise<void>;
}

export type TConversationRow = TConversationSelect & { lastMessage: string | null };

/** Persistence port of the WhatsApp conversations and messages. */
export interface IWhatsappRepository {
	/** The conversation of a chat, created or reopened with the assistant when closed. */
	upsertConversation(
		chat: { chatId: string; phone: string; contactName: string | null },
		at: Date,
	): Promise<TConversationSelect>;
	findConversation(id: string): Promise<TConversationSelect | null>;
	paginateConversations(query: TConversationListQuery): Promise<TPaginationResult<TConversationRow>>;
	countByStatus(): Promise<Record<string, number>>;
	/** Links a lead to a chat that has none yet; `null` when one is already linked (conditional update). */
	linkLead(id: string, leadId: string): Promise<TConversationSelect | null>;
	/**
	 * Updates a live conversation. With `from`, only when its status is one of
	 * them (a conditional update; `null` = another actor moved it first).
	 */
	updateConversation(
		id: string,
		data: Partial<TConversationInsert>,
		from?: TConversationSelect['status'][],
	): Promise<TConversationSelect | null>;
	/** `null` when an inbound message with the same external id was already stored. */
	insertMessage(data: Omit<TWhatsappMessageInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<TWhatsappMessageSelect | null>;
	findMessage(id: string): Promise<TWhatsappMessageSelect | null>;
	updateMessage(id: string, data: Partial<TWhatsappMessageInsert>): Promise<TWhatsappMessageSelect | null>;
	listMessages(conversationId: string, limit: number): Promise<TWhatsappMessageSelect[]>;
}

/** Persistence port of `automation.faq_entries`. */
export interface IFaqRepository {
	list(includeInactive: boolean): Promise<TFaqEntrySelect[]>;
	findById(id: string): Promise<TFaqEntrySelect | null>;
	create(data: Omit<TFaqEntryInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<TFaqEntrySelect>;
	update(id: string, data: Partial<TFaqEntryInsert>): Promise<TFaqEntrySelect | null>;
	softDelete(id: string): Promise<boolean>;
}

export type { HandoffReason };
