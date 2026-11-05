import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	pgSchema,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '../datatypes/unix-timestamp';

/**
 * Organization-module tables.
 *
 * @remarks
 * The Better Auth core tables (including `auth.organizations`) are folded into
 * the `auth` schema to keep the adapter contract intact — see the note on
 * `auth.schema.ts`. Everything the Organization module owns *beyond* Better
 * Auth lives here, per `docs/database/module-ownership.md` §3. The first
 * resident is `document_sequences`, the ERP-0009 numbering authority.
 */
export const organizationSchema = pgSchema('organization');

/**
 * Per-organization, per-document-type number sequences (ERP-0009).
 *
 * @remarks
 * **The numbering authority** (module-ownership.md §3): the owning module
 * calls the Organization contract to allocate the next number inside a
 * locked row update — specifically inside the *document's own transaction*,
 * so the allocation commits or rolls back with the document.
 *
 * **Allocation is a single statement** (`DocumentNumberingService.allocate`):
 * `INSERT … ON CONFLICT (organization_id, doc_type) DO UPDATE SET
 * next_number = document_sequences.next_number + 1 RETURNING next_number`.
 * The upsert lazily seeds the row on first use AND takes the row lock for
 * the duration of the caller's transaction — two concurrent allocations
 * serialize on this row and receive strictly consecutive numbers.
 *
 * **Gaps are acceptable and expected.** If the document's transaction rolls
 * back (validation failure, insufficient stock, crash), the allocated number
 * rolls back with it — but other transactions may already have allocated
 * higher numbers, leaving a gap. Documents are unique, not gapless; this is
 * the documented trade (hardening plan D4).
 *
 * Codes embed the allocated number as the serial part (e.g.
 * `MV-20261104120000-000042`), so uniqueness follows from the sequence: a
 * number is never handed out twice for the same `(organization, doc_type)`.
 */
export const documentSequences = organizationSchema.table(
	'document_sequences',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical ref to `auth.organizations.id` — cross-module FK omitted. */
		organizationId: varchar('organization_id', { length: 64 }).notNull(),
		/** Document family, e.g. `stock_movement`, `stock_adjustment`, `asset_borrowing`. */
		docType: varchar('doc_type', { length: 32 }).notNull(),
		/** Code prefix the allocating domain uses, informational. */
		prefix: varchar('prefix', { length: 16 }).notNull().default(''),
		/** Next number to hand out (the last allocated is `next_number - 1`). */
		nextNumber: integer('next_number').notNull().default(1),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('document_sequences_org_type_uq').on(
			table.organizationId,
			table.docType,
		),
		index('document_sequences_org_idx').on(table.organizationId),
	],
);

/** Row shape of `organization.document_sequences`. */
export type TDocumentSequenceSelect = typeof documentSequences.$inferSelect;
/** Insert shape of `organization.document_sequences`. */
export type TDocumentSequenceInsert = typeof documentSequences.$inferInsert;
