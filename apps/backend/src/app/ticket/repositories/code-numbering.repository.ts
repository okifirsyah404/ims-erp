import { DRIZZLE_TOKEN } from '@di/provider';
import { ticketCodeNumberings } from '@drizzle/schemas/ticket.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** `ticket.code_numberings` (ADR-0024 Q6): ticket codes. */
@injectable()
export class TicketCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = ticketCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
