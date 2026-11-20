import { DRIZZLE_TOKEN } from '@di/provider';
import { saleCodeNumberings } from '@drizzle/schemas/sale.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/**
 * `sale.code_numberings` (ADR-0024 Q6): the counters of quotation, order,
 * delivery note, invoice, receipt and return codes.
 */
@injectable()
export class SaleCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = saleCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
