import { DRIZZLE_TOKEN } from '@di/provider';
import { warehouseCodeNumberings } from '@drizzle/schemas/warehouse.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/**
 * `warehouse.code_numberings` (ADR-0024 Q6, ADR-0026): the counter of the
 * warehouse code.
 */
@injectable()
export class WarehouseCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = warehouseCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
