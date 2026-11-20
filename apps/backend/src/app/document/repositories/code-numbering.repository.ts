import { DRIZZLE_TOKEN } from '@di/provider';
import { documentCodeNumberings } from '@drizzle/schemas/document.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** `document.code_numberings` (ADR-0024 Q6): document codes. */
@injectable()
export class DocumentCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = documentCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
