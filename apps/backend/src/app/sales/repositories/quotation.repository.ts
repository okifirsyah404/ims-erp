import { DRIZZLE_TOKEN } from '@di/provider';
import {
	TQuotationInsert,
	TQuotationSelect,
	quotations,
	QUOTATION_STATUSES,
} from '@drizzle/schemas/sales.schema';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	TApproveQuotationInput,
	TCreateQuotationInput,
	TQuotationRepository,
	TSubmitQuotationInput,
	TUpdateQuotationInput,
} from '../contracts/quotation.repository.interface';

/**
 * Drizzle implementation of the quotation repository.
 *
 * Tenant scoping: every query filters by organizationId. List/select
 * operations never run unscoped and filter afterwards.
 */
@injectable()
export class QuotationRepository implements TQuotationRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async create(input: TCreateQuotationInput): Promise<TQuotationSelect> {
		const now = new Date();
		const row: TQuotationInsert = {
			id: crypto.randomUUID(),
			organizationId: input.organizationId,
			code: input.code,
			title: input.title,
			amount: input.amount,
			status: 'draft',
			createdBy: input.createdBy,
			createdAt: now,
		};
		const [created] = await this.database
			.insert(quotations)
			.values(row)
			.returning();
		return created;
	}

	async findById(
		organizationId: string,
		id: string,
	): Promise<TQuotationSelect | null> {
		const [row] = await this.database
			.select()
			.from(quotations)
			.where(
				and(eq(quotations.id, id), eq(quotations.organizationId, organizationId)),
			)
			.limit(1);
		return row ?? null;
	}

	async list(
		organizationId: string,
		pagination: { page: number; limit: number },
	): Promise<{ data: TQuotationSelect[]; total: number }> {
		const where = eq(quotations.organizationId, organizationId);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(quotations)
			.where(where);
		const data = await this.database
			.select()
			.from(quotations)
			.where(where)
			.orderBy(asc(quotations.createdAt))
			.limit(pagination.limit)
			.offset((pagination.page - 1) * pagination.limit);
		return { data, total };
	}

	async update(
		organizationId: string,
		id: string,
		patch: TUpdateQuotationInput,
	): Promise<TQuotationSelect | null> {
		// Mass-assignment protection: only the whitelisted fields are taken
		// from the patch; organizationId/status/createdBy are never writable.
		const [row] = await this.database
			.update(quotations)
			.set({
				...(patch.title !== undefined ? { title: patch.title } : {}),
				...(patch.amount !== undefined ? { amount: patch.amount } : {}),
				updatedAt: new Date(),
			})
			.where(
				and(eq(quotations.id, id), eq(quotations.organizationId, organizationId)),
			)
			.returning();
		return row ?? null;
	}

	async transitionStatus(
		organizationId: string,
		id: string,
		from: TQuotationSelect['status'],
		to: TQuotationSelect['status'],
	): Promise<TQuotationSelect | null> {
		const [row] = await this.database
			.update(quotations)
			.set({ status: to, updatedAt: new Date() })
			.where(
				and(
					eq(quotations.id, id),
					eq(quotations.organizationId, organizationId),
					eq(quotations.status, from),
				),
			)
			.returning();
		return row ?? null;
	}
}

// keep the input type referenced for contract completeness
export type { TSubmitQuotationInput, TApproveQuotationInput };
export const quotationStatuses = QUOTATION_STATUSES;
