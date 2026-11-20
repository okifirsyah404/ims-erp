import { DRIZZLE_TOKEN } from '@di/provider';
import { productCodeNumberings } from '@drizzle/schemas/product.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/**
 * `product.code_numberings` (ADR-0024 Q6, ADR-0026): the counters of the
 * product, material and component codes.
 */
@injectable()
export class ProductCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = productCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
