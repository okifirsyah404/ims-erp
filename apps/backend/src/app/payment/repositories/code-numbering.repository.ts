import { DRIZZLE_TOKEN } from '@di/provider';
import { paymentCodeNumberings } from '@drizzle/schemas/payment.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** `payment.code_numberings` (ADR-0024 Q6): payment codes. */
@injectable()
export class PaymentCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = paymentCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
