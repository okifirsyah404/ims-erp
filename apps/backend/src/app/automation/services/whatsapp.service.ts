import type { HandoffReason, MessageAuthor, TConversationSelect, TWhatsappMessageSelect } from '@drizzle/schemas/automation.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { pinoLogger } from '@providers/logger/logger';
import { inject, injectable } from 'tsyringe';
import {
	ASSISTANT_MODEL_TOKEN,
	INBOUND_DISPATCHER_TOKEN,
	OUTBOX_SERVICE_TOKEN,
	WHATSAPP_GATEWAY_TOKEN,
	WHATSAPP_REPOSITORY_TOKEN,
	WHATSAPP_SETTINGS_TOKEN,
} from '../constants/di';
import type {
	IAssistantModel,
	IInboundDispatcher,
	IWhatsappGateway,
	IWhatsappRepository,
	TConversationListQuery,
	TConversationRow,
	TWhatsappSettings,
} from '../contracts/whatsapp.contract';
import { WhatsappNotFoundError, WhatsappRetryError, WhatsappStateError, WhatsappWebhookError } from '../errors/automation.errors';
import { parseWahaWebhook, SYSTEM_REPLIES, verifyWahaSignature } from '../utils/assistant';
import type { OutboxService } from './outbox.service';

/** Body stored for a media message without text. */
export const MEDIA_BODY = '[media]';

export type TConversationDetail = TConversationSelect & { messages: TWhatsappMessageSelect[] };
export type TWhatsappStatus = {
	gateway: boolean;
	webhook: boolean;
	assistant: boolean;
	counts: Record<string, number>;
};

/**
 * WhatsApp chats through WAHA (M04 stage 2, decisions of 2026-11-07).
 *
 * @remarks
 * `receive` verifies WAHA's signature, stores the message once (deduped on
 * the WhatsApp message id) and queues it for the assistant; it answers WAHA
 * at once. `handoff` moves a chat to the admins: the assistant stays silent,
 * the customer gets one holding reply, and n8n gets a `whatsapp.handoff`
 * event to alert someone. Admins reply from the ERP; a reply takes the chat
 * over. Every message, failure and retry is on the log.
 */
@injectable()
export class WhatsappService {
	constructor(
		@inject(WHATSAPP_REPOSITORY_TOKEN) private readonly repository: IWhatsappRepository,
		@inject(WHATSAPP_GATEWAY_TOKEN) private readonly gateway: IWhatsappGateway,
		@inject(ASSISTANT_MODEL_TOKEN) private readonly model: Pick<IAssistantModel, 'configured'>,
		@inject(INBOUND_DISPATCHER_TOKEN) private readonly dispatcher: IInboundDispatcher,
		@inject(OUTBOX_SERVICE_TOKEN) private readonly outbox: Pick<OutboxService, 'publish'>,
		@inject(WHATSAPP_SETTINGS_TOKEN) private readonly settings: TWhatsappSettings,
	) {}

	/** Inbound WAHA webhook. Unsigned or badly signed calls are refused. */
	async receive(rawBody: string, signatureHeader: string | null): Promise<{ accepted: boolean }> {
		const secret = this.settings.webhookSecret;
		if (!secret) throw new WhatsappWebhookError('notConfigured');
		if (!verifyWahaSignature(secret, rawBody, signatureHeader)) throw new WhatsappWebhookError('badSignature');
		let body: unknown;
		try {
			body = JSON.parse(rawBody);
		} catch {
			return { accepted: false };
		}
		const inbound = parseWahaWebhook(body);
		if (!inbound) return { accepted: false };
		const now = new Date();
		const conversation = await this.repository.upsertConversation(
			{ chatId: inbound.chatId, phone: inbound.phone, contactName: inbound.contactName },
			now,
		);
		const message = await this.repository.insertMessage({
			conversationId: conversation.id,
			direction: 'inbound',
			author: 'customer',
			externalId: inbound.externalId,
			body: inbound.body || (inbound.hasMedia ? MEDIA_BODY : ''),
			status: 'received',
		});
		// Already stored: WAHA retried the same message.
		if (!message) return { accepted: true };
		await this.dispatcher.enqueue(message.id).catch((error: unknown) => {
			pinoLogger.warn({ err: error, messageId: message.id }, 'whatsapp enqueue failed; the chat waits for an admin');
		});
		return { accepted: true };
	}

	/** Sends a text to the chat and logs it (`sent`, or `failed` with the reason). */
	async send(
		conversation: TConversationSelect,
		text: string,
		author: Exclude<MessageAuthor, 'customer'>,
		extra: { faqEntryId?: string | null; sentBy?: string | null } = {},
	): Promise<TWhatsappMessageSelect> {
		const message = await this.repository.insertMessage({
			conversationId: conversation.id,
			direction: 'outbound',
			author,
			body: text,
			status: 'pending',
			faqEntryId: extra.faqEntryId ?? null,
			sentBy: extra.sentBy ?? null,
		});
		await this.repository.updateConversation(conversation.id, { lastMessageAt: new Date() });
		return this.deliver(message!);
	}

	private async deliver(message: TWhatsappMessageSelect): Promise<TWhatsappMessageSelect> {
		const conversation = await this.repository.findConversation(message.conversationId);
		if (!conversation) throw new WhatsappNotFoundError('conversation');
		const result = await this.gateway.sendText(conversation.chatId, message.body);
		const updated = await this.repository.updateMessage(
			message.id,
			result.ok
				? { status: 'sent', externalId: result.externalId, errorMessage: null, attempts: message.attempts + 1 }
				: { status: 'failed', errorMessage: result.error.slice(0, 500), attempts: message.attempts + 1 },
		);
		return updated ?? message;
	}

	/**
	 * Hands the chat to the admins: the assistant stops answering, the
	 * customer gets one holding reply and n8n a `whatsapp.handoff` event.
	 * A chat already with an admin is left as it is.
	 */
	async handoff(conversation: TConversationSelect, reason: HandoffReason, question: string): Promise<void> {
		if (conversation.status === 'handoff') return;
		// Conditional: only the first actor hands the chat off (one reply, one event).
		const updated = await this.repository.updateConversation(
			conversation.id,
			{ status: 'handoff', handoffReason: reason, handoffAt: new Date() },
			['assistant', 'closed'],
		);
		if (!updated) return;
		await this.send(updated, reason === 'restricted' ? SYSTEM_REPLIES.restricted : SYSTEM_REPLIES.handoff, 'system');
		await this.outbox.publish(
			'whatsapp.handoff',
			{ type: 'whatsapp_conversation', id: conversation.id },
			{
				conversationId: conversation.id,
				phone: conversation.phone,
				contactName: conversation.contactName,
				reason,
				question: question.slice(0, 500),
			},
		);
	}

	status = async (): Promise<TWhatsappStatus> => ({
		gateway: this.gateway.configured,
		webhook: Boolean(this.settings.webhookSecret),
		assistant: this.model.configured,
		counts: await this.repository.countByStatus(),
	});

	list(query: TConversationListQuery): Promise<TPaginationResult<TConversationRow>> {
		return this.repository.paginateConversations(query);
	}

	private async require(id: string): Promise<TConversationSelect> {
		const conversation = await this.repository.findConversation(id);
		if (!conversation) throw new WhatsappNotFoundError('conversation');
		return conversation;
	}

	async get(id: string): Promise<TConversationDetail> {
		const conversation = await this.require(id);
		return { ...conversation, messages: await this.repository.listMessages(id, 200) };
	}

	/** An admin's reply; the admin takes the chat over (the assistant goes quiet). */
	async reply(actorUserId: string, id: string, text: string): Promise<TWhatsappMessageSelect> {
		const conversation = await this.require(id);
		const taken =
			(await this.repository.updateConversation(id, {
				status: 'handoff',
				assignedUserId: actorUserId,
				handoffAt: conversation.status === 'handoff' ? conversation.handoffAt : new Date(),
			})) ?? conversation;
		return this.send(taken, text, 'admin', { sentBy: actorUserId });
	}

	/** Lets the assistant answer this chat again. */
	async resume(id: string): Promise<TConversationSelect> {
		await this.require(id);
		const resumed = await this.repository.updateConversation(
			id,
			{ status: 'assistant', handoffReason: null, handoffAt: null, assignedUserId: null },
			['handoff', 'closed'],
		);
		if (!resumed) throw new WhatsappStateError('resume');
		return resumed;
	}

	/** Done; the customer's next message reopens it with the assistant. */
	async close(id: string): Promise<TConversationSelect> {
		await this.require(id);
		const closed = await this.repository.updateConversation(id, { status: 'closed', assignedUserId: null }, ['assistant', 'handoff']);
		if (!closed) throw new WhatsappStateError('close');
		return closed;
	}

	/** Sends a failed outbound message again. */
	async retry(messageId: string): Promise<TWhatsappMessageSelect> {
		const message = await this.repository.findMessage(messageId);
		if (!message) throw new WhatsappNotFoundError('message');
		if (message.direction !== 'outbound' || message.status !== 'failed') throw new WhatsappRetryError();
		return this.deliver(message);
	}
}
