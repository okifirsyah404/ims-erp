import { DRIZZLE_TOKEN } from '@di/provider';
import { humanResourceCodeNumberings } from '@drizzle/schemas/human-resource.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** `human_resource.code_numberings` (ADR-0024 Q6): employee codes. */
@injectable()
export class HumanResourceCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = humanResourceCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
