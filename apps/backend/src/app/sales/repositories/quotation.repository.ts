import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	type QuotationStatus,
	quotationItems,
	quotations,
	quotationStatusHistory,
	type TQuotationItemSelect,
	type TQuotationSelect,
	type TQuotationStatusHistorySelect,
} from '@drizzle/schemas/sales.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IQuotationRepository,
	TQuotationHeaderData,
	TQuotationItemData,
	TQuotationPaginationRequest,
	TQuotationTransitionPatch,
} from '../contracts/quotation.repository.interface';

/** Drizzle implementation of {@link IQuotationRepository}. */
@injectable()
export class QuotationRepository implements IQuotationRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(quotations.id, id), isNull(quotations.deletedAt));
	}

	private async insertItems(tx: TTx, quotationId: string, items: TQuotationItemData[], now: Date) {
		await tx.insert(quotationItems).values(
			items.map((item, index) => ({
				...item,
				quotationId,
				sortOrder: index,
				createdAt: now,
				updatedAt: now,
			})),
		);
	}

	private async log(
		tx: TTx,
		quotationId: string,
		fromStatus: QuotationStatus | null,
		toStatus: QuotationStatus,
		changedBy: string,
		now: Date,
		note: string | null = null,
	) {
		await tx.insert(quotationStatusHistory).values({
			quotationId,
			fromStatus,
			toStatus,
			changedBy,
			changedAt: now,
			note,
			createdAt: now,
			updatedAt: now,
		});
	}

	async paginate(request: TQuotationPaginationRequest): Promise<TPaginationResult<TQuotationSelect>> {
		const { page, limit, search, status, customerId, createdBy, includeWon, excludeSuperseded } = request;
		const where = and(
			isNull(quotations.deletedAt),
			status ? eq(quotations.status, status) : undefined,
			excludeSuperseded && status !== 'superseded' ? ne(quotations.status, 'superseded') : undefined,
			customerId ? eq(quotations.customerId, customerId) : undefined,
			createdBy
				? includeWon
					? or(eq(quotations.createdBy, createdBy), eq(quotations.status, 'won'))
					: eq(quotations.createdBy, createdBy)
				: undefined,
			search
				? or(
						ilike(quotations.code, likePattern(search)),
						ilike(quotations.title, likePattern(search)),
						ilike(sql`${quotations.customerSnapshot}->>'name'`, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(quotations).where(where);
		const data = await this.database
			.select()
			.from(quotations)
			.where(where)
			.orderBy(desc(quotations.createdAt), desc(quotations.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TQuotationSelect | null> {
		const [row] = await this.database.select().from(quotations).where(this.live(id)).limit(1);
		return row ?? null;
	}

	listSentForFollowUp(): Promise<TQuotationSelect[]> {
		return this.database
			.select()
			.from(quotations)
			.where(and(isNull(quotations.deletedAt), eq(quotations.status, 'sent')))
			.orderBy(asc(quotations.sentAt));
	}

	findItems(quotationId: string): Promise<TQuotationItemSelect[]> {
		return this.database
			.select()
			.from(quotationItems)
			.where(and(eq(quotationItems.quotationId, quotationId), isNull(quotationItems.deletedAt)))
			.orderBy(asc(quotationItems.sortOrder));
	}

	findRevisions(baseCode: string): Promise<TQuotationSelect[]> {
		return this.database
			.select()
			.from(quotations)
			.where(and(eq(quotations.baseCode, baseCode), isNull(quotations.deletedAt)))
			.orderBy(asc(quotations.revision));
	}

	findHistory(quotationId: string): Promise<TQuotationStatusHistorySelect[]> {
		return this.database
			.select()
			.from(quotationStatusHistory)
			.where(eq(quotationStatusHistory.quotationId, quotationId))
			.orderBy(asc(quotationStatusHistory.changedAt), asc(quotationStatusHistory.id));
	}

	create(
		header: TQuotationHeaderData & { code: string; createdBy: string },
		items: TQuotationItemData[],
	): Promise<TQuotationSelect> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.insert(quotations)
				.values({ ...header, baseCode: header.code, revision: 0, status: 'draft', createdAt: now, updatedAt: now })
				.returning();
			await this.insertItems(tx, row.id, items, now);
			await this.log(tx, row.id, null, 'draft', header.createdBy, now);
			return row;
		});
	}

	replaceDraft(id: string, header: TQuotationHeaderData, items: TQuotationItemData[]): Promise<TQuotationSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.update(quotations)
				.set({ ...header, updatedAt: now })
				.where(and(this.live(id), eq(quotations.status, 'draft')))
				.returning();
			if (!row) return null;
			// Draft lines are replaced as a whole; nothing references them yet.
			await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
			await this.insertItems(tx, id, items, now);
			return row;
		});
	}

	transition(
		id: string,
		from: readonly QuotationStatus[],
		to: QuotationStatus,
		patch: TQuotationTransitionPatch,
		actor: { userId: string; note?: string | null },
	): Promise<TQuotationSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [current] = await tx
				.select({ status: quotations.status })
				.from(quotations)
				.where(this.live(id))
				.for('update');
			if (!current || !from.includes(current.status)) return null;
			const [row] = await tx
				.update(quotations)
				.set({ ...patch, status: to, updatedAt: now })
				.where(and(this.live(id), inArray(quotations.status, [...from])))
				.returning();
			if (!row) return null;
			await this.log(tx, id, current.status, to, actor.userId, now, actor.note ?? null);
			return row;
		});
	}

	createRevision(id: string, from: readonly QuotationStatus[], actorUserId: string): Promise<TQuotationSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [current] = await tx
				.select({ status: quotations.status })
				.from(quotations)
				.where(this.live(id))
				.for('update');
			if (!current || !from.includes(current.status)) return null;
			const [old] = await tx
				.update(quotations)
				.set({ status: 'superseded', updatedAt: now })
				.where(this.live(id))
				.returning();
			await this.log(tx, id, current.status, 'superseded', actorUserId, now);

			const [{ value: latest }] = await tx
				.select({ value: sql<number>`max(${quotations.revision})` })
				.from(quotations)
				.where(eq(quotations.baseCode, old.baseCode));
			const revision = Number(latest) + 1;
			const {
				id: _id,
				createdAt: _createdAt,
				updatedAt: _updatedAt,
				deletedAt: _deletedAt,
				...copy
			} = old;
			const [row] = await tx
				.insert(quotations)
				.values({
					...copy,
					code: `${old.baseCode}-R${revision}`,
					revision,
					previousRevisionId: old.id,
					status: 'draft',
					// The SPH keeps its owner; the history records who revised it.
					createdBy: old.createdBy,
					submittedAt: null,
					approvedBy: null,
					approvedAt: null,
					rejectedReason: null,
					sentBy: null,
					sentAt: null,
					closedBy: null,
					closedAt: null,
					lostReason: null,
					lostNote: null,
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			const items = await tx
				.select()
				.from(quotationItems)
				.where(and(eq(quotationItems.quotationId, id), isNull(quotationItems.deletedAt)))
				.orderBy(asc(quotationItems.sortOrder));
			await this.insertItems(
				tx,
				row.id,
				items.map(({ id: _i, quotationId: _q, sortOrder: _s, createdAt: _c, updatedAt: _u, deletedAt: _d, ...item }) => item),
				now,
			);
			await this.log(tx, row.id, null, 'draft', actorUserId, now, `revision of ${old.code}`);
			return row;
		});
	}
}
