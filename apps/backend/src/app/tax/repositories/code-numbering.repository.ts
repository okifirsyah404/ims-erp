import { DRIZZLE_TOKEN } from '@di/provider';
import { taxCodeNumberings } from '@drizzle/schemas/tax.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** `tax.code_numberings` (ADR-0024 Q6): tax record and withholding codes. */
@injectable()
export class TaxCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = taxCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
