import { DRIZZLE_TOKEN } from '@di/provider';
import { procurementCodeNumberings } from '@drizzle/schemas/procurement.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/**
 * `procurement.code_numberings` (ADR-0024 Q6): the counters of purchase request,
 * purchase order, goods receipt and purchase return codes.
 */
@injectable()
export class ProcurementCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = procurementCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
