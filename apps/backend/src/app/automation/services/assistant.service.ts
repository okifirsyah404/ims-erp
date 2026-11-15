import { CATALOG_SERVICE_TOKEN } from '@app/catalog/constants/di';
import type { CatalogService } from '@app/catalog/services/catalog.service';
import type { HandoffReason } from '@drizzle/schemas/automation.schema';
import { pinoLogger } from '@providers/logger/logger';
import { inject, injectable } from 'tsyringe';
import { ASSISTANT_MODEL_TOKEN, FAQ_REPOSITORY_TOKEN, WHATSAPP_REPOSITORY_TOKEN, WHATSAPP_SERVICE_TOKEN } from '../constants/di';
import type { IAssistantModel, IFaqRepository, IWhatsappRepository } from '../contracts/whatsapp.contract';
import { isRestricted, rankFaqs, wantsHuman, words } from '../utils/assistant';
import { MEDIA_BODY, type WhatsappService } from './whatsapp.service';

export type TAssistantOutcome = 'answered' | 'handoff' | 'skipped';

/**
 * Answers inbound WhatsApp messages (M04 stage 2, decisions of 2026-11-07).
 *
 * @remarks
 * Hard rules run before the AI: a request for a discount, a special price,
 * a payment or an order is refused and handed off; asking for a person is
 * handed off. With no AI provider configured every chat is handed off.
 * Otherwise the model sees only the matching active FAQ entries and
 * published products, and its answer is checked again — an answer that
 * talks about discounts or payments is not sent, the chat is handed off.
 * The model has no tools: it cannot change ERP data whatever it is told.
 * A chat with an admin (handoff) is never answered by the assistant.
 */
@injectable()
export class AssistantService {
	constructor(
		@inject(WHATSAPP_REPOSITORY_TOKEN) private readonly repository: IWhatsappRepository,
		@inject(WHATSAPP_SERVICE_TOKEN) private readonly whatsapp: Pick<WhatsappService, 'send' | 'handoff'>,
		@inject(FAQ_REPOSITORY_TOKEN) private readonly faqs: Pick<IFaqRepository, 'list'>,
		@inject(CATALOG_SERVICE_TOKEN) private readonly catalog: Pick<CatalogService, 'matchProducts'>,
		@inject(ASSISTANT_MODEL_TOKEN) private readonly model: IAssistantModel,
	) {}

	async process(messageId: string): Promise<TAssistantOutcome> {
		const message = await this.repository.findMessage(messageId);
		if (!message || message.direction !== 'inbound' || message.status !== 'received') return 'skipped';
		const conversation = await this.repository.findConversation(message.conversationId);
		if (!conversation) return 'skipped';
		try {
			if (conversation.status !== 'assistant') return 'skipped';
			const text = message.body.trim();
			const handoff = async (reason: HandoffReason) => {
				await this.whatsapp.handoff(conversation, reason, text);
				return 'handoff' as const;
			};
			if (!text || text === MEDIA_BODY) return await handoff('not_found');
			if (isRestricted(text)) return await handoff('restricted');
			if (wantsHuman(text)) return await handoff('human_requested');
			if (!this.model.configured) return await handoff('no_provider');

			const [faqs, products, history] = await Promise.all([
				this.faqs.list(false),
				this.catalog.matchProducts(words(text), 5),
				this.repository.listMessages(conversation.id, 13),
			]);
			const context = { faqs: rankFaqs(text, faqs, 5).map(({ id, question, answer }) => ({ id, question, answer })), products };
			const turns = history
				.filter((item) => item.id !== message.id && item.author !== 'system')
				.map((item) => ({ role: item.author === 'customer' ? ('customer' as const) : ('assistant' as const), text: item.body }));
			let answer: Awaited<ReturnType<IAssistantModel['answer']>>;
			try {
				answer = await this.model.answer(text, turns, context);
			} catch (error) {
				pinoLogger.warn({ err: error, conversationId: conversation.id }, 'assistant model failed; handing off');
				return await handoff('error');
			}
			if (answer.kind === 'unsure') return await handoff('not_found');
			if (isRestricted(answer.text)) return await handoff('restricted');
			await this.whatsapp.send(conversation, answer.text, 'assistant', { faqEntryId: answer.faqEntryId });
			return 'answered';
		} finally {
			await this.repository.updateMessage(message.id, { status: 'processed' });
		}
	}
}
