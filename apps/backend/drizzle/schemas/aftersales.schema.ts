/**
 * After-sales domain schema — owns the `aftersales` Postgres schema (M07,
 * ADR-0011 step 6b): warranty certificates; service tickets follow in 6c.
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0011 §2, ADR-0012).
 * - Business dates are Jakarta `date` strings; operational timestamps unix ms.
 * - References to other modules (`projects`, `crm`, `auth`) are plain id
 *   columns, validated through those modules' services.
 */
import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, pgSchema, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';
import type { TDocumentItem } from './projects.schema';

export const aftersalesSchema = pgSchema('aftersales');

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * aftersales.warranty_certificates
 * ------------------------------------------------------------------------ */

/** Surat Keterangan Garansi: one live certificate per project. */
export const warrantyCertificates = aftersalesSchema.table(
	'warranty_certificates',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 80 }).notNull(),
		/** Logical reference to projects.projects.id. */
		projectId: uuid('project_id').notNull(),
		/** Logical reference to projects.project_handover.id — the warranty starts at its date. */
		bastId: uuid('bast_id').notNull(),
		/** Logical reference to crm.customers.id. */
		customerId: uuid('customer_id').notNull(),
		issueDate: date('issue_date').notNull(),
		startDate: date('start_date').notNull(),
		months: integer('months').notNull().default(12),
		/** The last covered day. */
		endDate: date('end_date').notNull(),
		productSummary: varchar('product_summary', { length: 300 }).notNull(),
		projectName: varchar('project_name', { length: 300 }).notNull(),
		projectLocation: varchar('project_location', { length: 200 }),
		projectOwner: varchar('project_owner', { length: 200 }).notNull(),
		items: jsonb('items').$type<TDocumentItem[]>().notNull(),
		/** One item per line; `o ` / `- ` lines are sub-items; `**…**` is bold. */
		coverage: text('coverage').notNull(),
		exclusions: text('exclusions').notNull(),
		serviceTerms: text('service_terms').notNull(),
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('warranty_certificates_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('warranty_certificates_live_project_uq')
			.on(table.projectId)
			.where(sql`deleted_at IS NULL`),
		index('warranty_certificates_customer_id_idx').on(table.customerId),
		check('warranty_certificates_months_check', sql`${table.months} BETWEEN 1 AND 120`),
		check('warranty_certificates_dates_check', sql`${table.endDate} >= ${table.startDate}`),
	],
);

export type TWarrantyCertificateInsert = typeof warrantyCertificates.$inferInsert;
export type TWarrantyCertificateSelect = typeof warrantyCertificates.$inferSelect;
