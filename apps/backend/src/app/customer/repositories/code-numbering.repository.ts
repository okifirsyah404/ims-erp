import { DRIZZLE_TOKEN } from '@di/provider';
import { customerCodeNumberings } from '@drizzle/schemas/customer.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** `customer.code_numberings` (ADR-0024 Q6): the customer and customer company code counters. */
@injectable()
export class CustomerCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = customerCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
