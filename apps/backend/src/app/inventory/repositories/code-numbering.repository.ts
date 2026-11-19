import { DRIZZLE_TOKEN } from '@di/provider';
import { inventoryCodeNumberings } from '@drizzle/schemas/inventory.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/**
 * `inventory.code_numberings` (ADR-0024 Q6): the counters of product, material,
 * component, asset, movement, adjustment, borrowing, maintenance, disposal,
 * warehouse and tool-set codes.
 */
@injectable()
export class InventoryCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = inventoryCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
