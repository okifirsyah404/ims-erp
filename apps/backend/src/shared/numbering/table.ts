/**
 * Shared `<schema>.code_numberings` table factory.
 *
 * @remarks
 * One numbering table per schema that allocates codes (ADR-0024 Q6), replacing
 * the single `code_number.series`. The column set is identical everywhere, so
 * each module's schema file calls this instead of repeating 12 columns; the
 * per-table unique index and CHECKs travel with it.
 *
 * Allocation is one atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` in
 * the owning module's repository, so concurrent callers never get the same
 * number.
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { sql } from 'drizzle-orm';
import {
	bigint,
	check,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

type PgSchema = ReturnType<typeof pgSchema>;

export function createCodeNumberingTable(schema: PgSchema) {
	return schema.table(
		'code_numberings',
		{
			id: uuid('id')
				.primaryKey()
				.default(sql`uuidv7()`),
			/** Code type owned by this module, e.g. `quotation`, `order`. */
			codeType: varchar('code_type', { length: 32 }).notNull(),
			/** Token pattern; null = the code default for the type. */
			pattern: varchar('pattern', { length: 100 }),
			resetPolicy: text('reset_policy'),
			/** `2026`, `2026-11` or `all`; a new period restarts at 1. */
			periodKey: varchar('period_key', { length: 7 }).notNull(),
			nextNumber: bigint('next_number', { mode: 'number' })
				.notNull()
				.default(1),
			/** Logical reference to auth.users.id — cross-module FK omitted. */
			updatedBy: text('updated_by'),
			createdAt: unixTimestamp('created_at').notNull(),
			updatedAt: unixTimestamp('updated_at')
				.notNull()
				.$onUpdate(() => new Date()),
			deletedAt: unixTimestampNullable('deleted_at'),
		},
		(table) => [
			uniqueIndex(`${schema.schemaName}_code_numberings_type_uq`)
				.on(table.codeType)
				.where(sql`deleted_at IS NULL`),
			check(
				`${schema.schemaName}_code_numberings_reset_check`,
				sql`reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')`,
			),
			check(
				`${schema.schemaName}_code_numberings_next_check`,
				sql`next_number > 0`,
			),
		],
	);
}
