import { DRIZZLE_TOKEN } from '@di/provider';
import {
	inventoryDocuments,
	type TInventoryDocumentInsert,
	type TInventoryDocumentSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IInventoryDocumentRepository } from '../contracts/item-operations.repository.interface';

/** Drizzle implementation of {@link IInventoryDocumentRepository} on `inventory.documents`. */
@injectable()
export class InventoryDocumentRepository implements IInventoryDocumentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async create(data: TInventoryDocumentInsert, tx?: TTx): Promise<TInventoryDocumentSelect> {
		const [row] = await (tx ?? this.database).insert(inventoryDocuments).values(data).returning();
		return row;
	}

	listByItem(itemId: string, organizationId: string): Promise<TInventoryDocumentSelect[]> {
		return this.database
			.select()
			.from(inventoryDocuments)
			.where(
				and(
					eq(inventoryDocuments.itemId, itemId),
					eq(inventoryDocuments.organizationId, organizationId),
					isNull(inventoryDocuments.deletedAt),
				),
			)
			.orderBy(desc(inventoryDocuments.createdAt));
	}

	listByProduct(productId: string): Promise<TInventoryDocumentSelect[]> {
		return this.database
			.select()
			.from(inventoryDocuments)
			.where(and(eq(inventoryDocuments.productId, productId), isNull(inventoryDocuments.deletedAt)))
			.orderBy(desc(inventoryDocuments.createdAt));
	}
}
