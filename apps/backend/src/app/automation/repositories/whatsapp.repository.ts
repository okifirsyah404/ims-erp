import { DRIZZLE_TOKEN } from '@di/provider';
import { whatsappConversations, whatsappMessages } from '@drizzle/schemas/automation.schema';
import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IWhatsappRepository, TConversationListQuery } from '../contracts/whatsapp.contract';

/** Drizzle implementation of {@link IWhatsappRepository}. */
@injectable()
export class WhatsappRepository implements IWhatsappRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async upsertConversation(chat: { chatId: string; phone: string; contactName: string | null }, at: Date) {
		const [row] = await this.database
			.insert(whatsappConversations)
			.values({ ...chat, status: 'assistant', lastMessageAt: at, lastInboundAt: at, createdAt: at, updatedAt: at })
			.onConflictDoUpdate({
				target: whatsappConversations.chatId,
				set: {
					contactName: sql`coalesce(excluded.contact_name, ${whatsappConversations.contactName})`,
					// A closed chat comes back to the assistant; a handoff stays with the admin.
					status: sql`case when ${whatsappConversations.status} = 'closed' then 'assistant' else ${whatsappConversations.status} end`,
					handoffReason: sql`case when ${whatsappConversations.status} = 'closed' then null else ${whatsappConversations.handoffReason} end`,
					lastMessageAt: at,
					lastInboundAt: at,
					deletedAt: null,
					updatedAt: at,
				},
			})
			.returning();
		return row;
	}

	async findConversation(id: string) {
		const [row] = await this.database
			.select()
			.from(whatsappConversations)
			.where(and(eq(whatsappConversations.id, id), isNull(whatsappConversations.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async paginateConversations({ page, limit, status, search }: TConversationListQuery) {
		const where = and(
			isNull(whatsappConversations.deletedAt),
			status ? eq(whatsappConversations.status, status) : undefined,
			search ? or(ilike(whatsappConversations.phone, `%${search}%`), ilike(whatsappConversations.contactName, `%${search}%`)) : undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(whatsappConversations).where(where);
		const lastMessage = sql<string | null>`(
			select ${whatsappMessages.body} from ${whatsappMessages}
			where ${whatsappMessages.conversationId} = ${whatsappConversations.id} and ${whatsappMessages.deletedAt} is null
			order by ${whatsappMessages.createdAt} desc, ${whatsappMessages.id} desc limit 1
		)`;
		const rows = await this.database
			.select({ conversation: whatsappConversations, lastMessage })
			.from(whatsappConversations)
			.where(where)
			.orderBy(desc(whatsappConversations.lastMessageAt), desc(whatsappConversations.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data: rows.map((row) => ({ ...row.conversation, lastMessage: row.lastMessage })),
		};
	}

	async countByStatus() {
		const rows = await this.database
			.select({ status: whatsappConversations.status, value: count() })
			.from(whatsappConversations)
			.where(isNull(whatsappConversations.deletedAt))
			.groupBy(whatsappConversations.status);
		return Object.fromEntries(rows.map((row) => [row.status, row.value]));
	}

	async updateConversation(id: string, data: Parameters<IWhatsappRepository['updateConversation']>[1]) {
		const [row] = await this.database
			.update(whatsappConversations)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(whatsappConversations.id, id), isNull(whatsappConversations.deletedAt)))
			.returning();
		return row ?? null;
	}

	async insertMessage(data: Parameters<IWhatsappRepository['insertMessage']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(whatsappMessages)
			.values({ ...data, createdAt: now, updatedAt: now })
			.onConflictDoNothing({ target: [whatsappMessages.direction, whatsappMessages.externalId] })
			.returning();
		return row ?? null;
	}

	async findMessage(id: string) {
		const [row] = await this.database
			.select()
			.from(whatsappMessages)
			.where(and(eq(whatsappMessages.id, id), isNull(whatsappMessages.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async updateMessage(id: string, data: Parameters<IWhatsappRepository['updateMessage']>[1]) {
		const [row] = await this.database
			.update(whatsappMessages)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(whatsappMessages.id, id), isNull(whatsappMessages.deletedAt)))
			.returning();
		return row ?? null;
	}

	/** The latest `limit` messages, oldest first. */
	async listMessages(conversationId: string, limit: number) {
		const rows = await this.database
			.select()
			.from(whatsappMessages)
			.where(and(eq(whatsappMessages.conversationId, conversationId), isNull(whatsappMessages.deletedAt)))
			.orderBy(desc(whatsappMessages.createdAt), desc(whatsappMessages.id))
			.limit(limit);
		return rows.reverse();
	}
}
