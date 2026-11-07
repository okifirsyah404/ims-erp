import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	invoiceItems,
	invoices,
	type TInvoiceItemSelect,
	type TInvoiceSelect,
} from '@drizzle/schemas/sales.schema';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';

/**
 * Drizzle implementation of the invoice repository (M09 F4).
 *
 * @remarks
 * Tenant-scoped on every query; items are replaced wholesale on draft edits
 * (delete + insert inside the caller's transaction).
 */
@injectable()
export class InvoiceRepository implements TInvoiceRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async findById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TInvoiceSelect | null> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const [row] = await db
			.select()
			.from(invoices)
			.where(
				and(
					eq(invoices.id, id),
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findByCode(
		organizationId: string,
		code: string,
		tx?: TTx,
	): Promise<TInvoiceSelect | null> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const [row] = await db
			.select()
			.from(invoices)
			.where(
				and(
					eq(invoices.code, code),
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async list(
		organizationId: string,
		filters: { status?: string; customerId?: string },
		pagination: { page: number; limit: number },
	): Promise<{
		data: TInvoiceSelect[];
		meta: { page: number; limit: number; total: number; totalPages: number };
	}> {
		const conditions = [
			eq(invoices.organizationId, organizationId),
			isNull(invoices.deletedAt),
		];
		if (filters.status) conditions.push(eq(invoices.status, filters.status));
		if (filters.customerId) {
			conditions.push(eq(invoices.customerId, filters.customerId));
		}
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(invoices)
			.where(where);
		const data = await this.database
			.select()
			.from(invoices)
			.where(where)
			.orderBy(desc(invoices.createdAt))
			.limit(pagination.limit)
			.offset((pagination.page - 1) * pagination.limit);
		return {
			data,
			meta: {
				page: pagination.page,
				limit: pagination.limit,
				total,
				totalPages: Math.ceil(total / pagination.limit) || 1,
			},
		};
	}

	async insert(
		row: Record<string, unknown>,
		tx?: TTx,
	): Promise<TInvoiceSelect> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const now = new Date();
		const [created] = await db
			.insert(invoices)
			.values({ ...row, createdAt: now, updatedAt: now } as never)
			.returning();
		return created;
	}

	async update(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<TInvoiceSelect | null> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const [updated] = await db
			.update(invoices)
			.set({ ...patch, updatedAt: new Date() } as never)
			.where(
				and(
					eq(invoices.id, id),
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async listItems(
		organizationId: string,
		invoiceId: string,
		tx?: TTx,
	): Promise<TInvoiceItemSelect[]> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		return db
			.select()
			.from(invoiceItems)
			.where(
				and(
					eq(invoiceItems.invoiceId, invoiceId),
					eq(invoiceItems.organizationId, organizationId),
					isNull(invoiceItems.deletedAt),
				),
			)
			.orderBy(asc(invoiceItems.createdAt));
	}

	async replaceItems(
		organizationId: string,
		invoiceId: string,
		rows: Array<Record<string, unknown>>,
		tx?: TTx,
	): Promise<TInvoiceItemSelect[]> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const now = new Date();
		await db
			.update(invoiceItems)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(invoiceItems.invoiceId, invoiceId),
					eq(invoiceItems.organizationId, organizationId),
					isNull(invoiceItems.deletedAt),
				),
			);
		if (rows.length === 0) return [];
		return db
			.insert(invoiceItems)
			.values(
				rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })) as never,
			)
			.returning() as unknown as TInvoiceItemSelect[];
	}
}
