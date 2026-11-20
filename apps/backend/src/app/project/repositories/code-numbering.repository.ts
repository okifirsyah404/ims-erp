import { DRIZZLE_TOKEN } from '@di/provider';
import { projectCodeNumberings } from '@drizzle/schemas/project.schema';
import { CodeNumberingRepositoryBase } from '@shared/numbering';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/**
 * `project.code_numberings` (ADR-0024 Q6): the counters of project, BAST,
 * warranty, lead, website-reference and licence-contract codes.
 */
@injectable()
export class ProjectCodeNumberingRepository extends CodeNumberingRepositoryBase {
	protected readonly table = projectCodeNumberings;

	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {
		super(database);
	}
}
