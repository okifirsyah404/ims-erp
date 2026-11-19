import { DRIZZLE_TOKEN } from '@di/provider';
import {
	LEAD_OPEN_STATUSES,
	type LeadStatus,
	leads,
	type TLeadSelect,
} from '@drizzle/schemas/project.schema';
import type { TTx } from '@drizzle/types';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, ilike, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	ILeadRepository,
	TInquiryCreateData,
	TLeadCreateData,
	TLeadPaginationRequest,
	TLeadUpdateData,
} from '../contracts/lead.repository.interface';

/**
 * Drizzle implementation of {@link ILeadRepository}.
 *
 * @remarks
 * Converted (`won`) leads are closed: `update` and `setStatus` match only
 * leads that are not `won`, so a concurrent conversion cannot be undone.
 */
@injectable()
export class LeadRepository implements ILeadRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(leads.id, id), isNull(leads.deletedAt));
	}

	async paginate(request: TLeadPaginationRequest): Promise<TPaginationResult<TLeadSelect>> {
		const { page, limit, search, status, source, ownerUserId, followUpDueBefore } = request;
		const where = and(
			isNull(leads.deletedAt),
			status ? eq(leads.status, status) : undefined,
			source ? eq(leads.source, source) : undefined,
			ownerUserId === null
				? isNull(leads.ownerUserId)
				: ownerUserId !== undefined
					? eq(leads.ownerUserId, ownerUserId)
					: undefined,
			followUpDueBefore
				? and(lte(leads.nextFollowUpAt, followUpDueBefore), inArray(leads.status, [...LEAD_OPEN_STATUSES]))
				: undefined,
			search
				? or(
						ilike(leads.name, likePattern(search)),
						ilike(leads.companyName, likePattern(search)),
						ilike(leads.phone, likePattern(search)),
						ilike(leads.whatsapp, likePattern(search)),
						ilike(leads.email, likePattern(search)),
						ilike(leads.reference, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(leads).where(where);
		const data = await this.database
			.select()
			.from(leads)
			.where(where)
			.orderBy(followUpDueBefore ? asc(leads.nextFollowUpAt) : desc(leads.createdAt), asc(leads.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TLeadSelect | null> {
		const [row] = await this.database.select().from(leads).where(this.live(id)).limit(1);
		return row ?? null;
	}

	listFollowUpsDue(until: Date): Promise<TLeadSelect[]> {
		return this.database
			.select()
			.from(leads)
			.where(
				and(
					isNull(leads.deletedAt),
					inArray(leads.status, ['new', 'contacted', 'survey', 'quotation']),
					lte(leads.nextFollowUpAt, until),
				),
			)
			.orderBy(asc(leads.nextFollowUpAt));
	}

	async findByIdempotencyKey(idempotencyKey: string): Promise<TLeadSelect | null> {
		const [row] = await this.database.select().from(leads).where(eq(leads.idempotencyKey, idempotencyKey)).limit(1);
		return row ?? null;
	}

	async create(data: TLeadCreateData): Promise<TLeadSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(leads)
			.values({ ...data, status: 'new', createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async createInquiry(data: TInquiryCreateData, tx?: TTx): Promise<TLeadSelect> {
		const now = new Date();
		const [row] = await (tx ?? this.database)
			.insert(leads)
			.values({ ...data, source: 'website', status: 'new', ownerUserId: null, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, patch: TLeadUpdateData): Promise<TLeadSelect | null> {
		const [row] = await this.database
			.update(leads)
			.set({ ...patch, updatedAt: new Date() })
			.where(and(this.live(id), ne(leads.status, 'won')))
			.returning();
		return row ?? null;
	}

	async setStatus(id: string, status: LeadStatus, lostReason: string | null): Promise<TLeadSelect | null> {
		const [row] = await this.database
			.update(leads)
			.set({ status, lostReason: status === 'lost' ? lostReason : null, updatedAt: new Date() })
			.where(and(this.live(id), ne(leads.status, 'won')))
			.returning();
		return row ?? null;
	}

	async markQuoted(id: string): Promise<TLeadSelect | null> {
		const [row] = await this.database
			.update(leads)
			.set({ status: 'quotation', updatedAt: new Date() })
			.where(and(this.live(id), inArray(leads.status, ['new', 'contacted', 'survey'])))
			.returning();
		return row ?? null;
	}

	async assign(id: string, ownerUserId: string | null): Promise<TLeadSelect | null> {
		const [row] = await this.database
			.update(leads)
			.set({ ownerUserId, updatedAt: new Date() })
			.where(this.live(id))
			.returning();
		return row ?? null;
	}

	async markConverted(id: string, customerId: string): Promise<TLeadSelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(leads)
			.set({ status: 'won', customerId, convertedAt: now, nextFollowUpAt: null, updatedAt: now })
			.where(and(this.live(id), inArray(leads.status, [...LEAD_OPEN_STATUSES]), isNull(leads.customerId)))
			.returning();
		return row ?? null;
	}

	async softDelete(id: string): Promise<boolean> {
		const now = new Date();
		const rows = await this.database
			.update(leads)
			.set({ deletedAt: now, updatedAt: now })
			.where(this.live(id))
			.returning({ id: leads.id });
		return rows.length > 0;
	}
}
