import { DRIZZLE_TOKEN } from '@di/provider';
import { financeCodeNumberings } from '@drizzle/schemas/finance.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/**
 * `finance.code_numberings` (ADR-0024 Q6): journal entry, supplier bill,
 * cash/bank transaction, bank reconciliation and depreciation codes.
 */
@injectable()
export class FinanceCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = financeCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
