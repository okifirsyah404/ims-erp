import { DRIZZLE_TOKEN } from '@di/provider';
import { fixedAssetBooks, type TFixedAssetBookSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IFixedAssetBookRepository } from '../contracts/fixed-asset.contract';

/** Drizzle implementation of {@link IFixedAssetBookRepository} (ERP-0145). */
@injectable()
export class FixedAssetBookRepository implements IFixedAssetBookRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	list(organizationId: string, tx?: TTx) {
		return (tx ?? this.database)
			.select()
			.from(fixedAssetBooks)
			.where(and(eq(fixedAssetBooks.organizationId, organizationId), isNull(fixedAssetBooks.deletedAt)))
			.orderBy(asc(fixedAssetBooks.capitalizedOn));
	}

	async findByItem(organizationId: string, itemId: string, tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.select()
			.from(fixedAssetBooks)
			.where(and(eq(fixedAssetBooks.organizationId, organizationId), eq(fixedAssetBooks.itemId, itemId), isNull(fixedAssetBooks.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async insert(row: Parameters<IFixedAssetBookRepository['insert']>[0], tx?: TTx) {
		const now = new Date();
		const [created] = await (tx ?? this.database).insert(fixedAssetBooks).values({ ...row, createdAt: now, updatedAt: now }).returning();
		return created as TFixedAssetBookSelect;
	}

	async update(organizationId: string, id: string, patch: Partial<TFixedAssetBookSelect>, tx?: TTx) {
		const [updated] = await (tx ?? this.database)
			.update(fixedAssetBooks)
			.set({ ...patch, updatedAt: new Date() })
			.where(and(eq(fixedAssetBooks.organizationId, organizationId), eq(fixedAssetBooks.id, id)))
			.returning();
		return updated ?? null;
	}
}
