import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import { creditMemos, type TCreditMemoSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	ICreditMemoRepository,
	TCreditMemoPaginationRequest,
} from '../contracts/credit-memo.repository.interface';

/** Drizzle implementation of {@link ICreditMemoRepository} (ERP-0135). */
@injectable()
export class CreditMemoRepository implements ICreditMemoRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async insert(row: {
		organizationId: string;
		code: string;
		invoiceId: string;
		customerId: string | null;
		memoDate: string;
		amount: number;
		taxAmount: number;
		reason: string;
		createdBy: string;
	}): Promise<TCreditMemoSelect> {
		const now = new Date();
		const [created] = await this.database
			.insert(creditMemos)
			.values({ ...row, status: 'draft', currencyCode: 'IDR', createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async findById(organizationId: string, id: string, tx?: TTx): Promise<TCreditMemoSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(creditMemos)
			.where(and(eq(creditMemos.id, id), eq(creditMemos.organizationId, organizationId), isNull(creditMemos.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async paginate(request: TCreditMemoPaginationRequest): Promise<TPaginationResult<TCreditMemoSelect>> {
		const conditions = [eq(creditMemos.organizationId, request.organizationId), isNull(creditMemos.deletedAt)];
		if (request.invoiceId) conditions.push(eq(creditMemos.invoiceId, request.invoiceId));
		if (request.status) conditions.push(eq(creditMemos.status, request.status));
		const where = and(...conditions);
		const [{ value: total }] = await this.database.select({ value: count() }).from(creditMemos).where(where);
		const data = await this.database
			.select()
			.from(creditMemos)
			.where(where)
			.orderBy(desc(creditMemos.createdAt))
			.limit(request.limit)
			.offset((request.page - 1) * request.limit);
		return paginationResult(request, total, data);
	}

	async update(
		organizationId: string,
		id: string,
		patch: Partial<Pick<TCreditMemoSelect, 'status' | 'journalEntryId' | 'issuedBy' | 'issuedAt'>>,
		tx?: TTx,
	): Promise<TCreditMemoSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(creditMemos)
			.set({ ...patch, updatedAt: new Date() })
			.where(and(eq(creditMemos.id, id), eq(creditMemos.organizationId, organizationId)))
			.returning();
		return updated ?? null;
	}
}
