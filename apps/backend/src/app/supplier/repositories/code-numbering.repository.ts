import { DRIZZLE_TOKEN } from '@di/provider';
import { supplierCodeNumberings } from '@drizzle/schemas/supplier.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** `supplier.code_numberings` (ADR-0024 Q6): the supplier company code counter. */
@injectable()
export class SupplierCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = supplierCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
