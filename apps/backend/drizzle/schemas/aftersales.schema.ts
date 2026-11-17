/**
 * After-sales domain schema — owns the `aftersales` Postgres schema (M07,
 * ADR-0011 steps 6b–6c): warranty certificates and service tickets.
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0011 §2, ADR-0012).
 * - Business dates are Jakarta `date` strings; operational timestamps unix ms.
 * - References to other modules (`projects`, `crm`, `auth`) are plain id
 *   columns, validated through those modules' services.
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, date, index, integer, jsonb, pgSchema, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
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

/* ------------------------------------------------------------------------ *
 * aftersales.service_tickets (step 6c)
 * ------------------------------------------------------------------------ */

export const TICKET_STATUSES = ['new', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** `portal` = opened (or confirmed) by the customer in the customer portal (ERP-0022). */
export const TICKET_CHANNELS = ['phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other'] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

/**
 * Tiket servis. `new → in_progress → resolved → closed` (resolved may
 * reopen); closing needs the customer's confirmation. The warranty check
 * made at the report time is stored on the ticket.
 */
export const serviceTickets = aftersalesSchema.table(
	'service_tickets',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		/** Logical reference to crm.customers.id. */
		customerId: uuid('customer_id').notNull(),
		customerName: text('customer_name').notNull(),
		/** Logical reference to projects.projects.id; must belong to the customer. */
		projectId: uuid('project_id'),
		serialNumber: varchar('serial_number', { length: 100 }),
		deviceDescription: varchar('device_description', { length: 300 }),
		channel: text('channel').$type<TicketChannel>().notNull().default('phone'),
		reporterName: varchar('reporter_name', { length: 200 }).notNull(),
		reporterContact: varchar('reporter_contact', { length: 200 }),
		complaint: text('complaint').notNull(),
		reportedAt: unixTimestamp('reported_at').notNull(),
		inWarranty: boolean('in_warranty').notNull().default(false),
		warrantyEndsOn: date('warranty_ends_on'),
		warrantyCode: varchar('warranty_code', { length: 80 }),
		status: text('status').$type<TicketStatus>().notNull().default('new'),
		/** Logical reference to auth.users.id; must hold `service_ticket:update`. */
		assigneeUserId: text('assignee_user_id'),
		resolution: text('resolution'),
		serviceCost: bigint('service_cost', { mode: 'number' }).notNull().default(0),
		resolvedBy: text('resolved_by'),
		resolvedAt: unixTimestampNullable('resolved_at'),
		confirmedByName: varchar('confirmed_by_name', { length: 200 }),
		confirmationChannel: text('confirmation_channel').$type<TicketChannel>(),
		confirmedAt: unixTimestampNullable('confirmed_at'),
		closedBy: text('closed_by'),
		closedAt: unixTimestampNullable('closed_at'),
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('service_tickets_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('service_tickets_customer_id_idx').on(table.customerId),
		index('service_tickets_project_id_idx').on(table.projectId),
		index('service_tickets_assignee_user_id_idx').on(table.assigneeUserId),
		index('service_tickets_status_idx').on(table.status),
		index('service_tickets_serial_number_idx').on(table.serialNumber),
		check('service_tickets_status_check', sql`${table.status} IN ('new', 'in_progress', 'resolved', 'closed')`),
		check('service_tickets_channel_check', sql`${table.channel} IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other')`),
		check(
			'service_tickets_confirmation_channel_check',
			sql`${table.confirmationChannel} IS NULL OR ${table.confirmationChannel} IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other')`,
		),
		check('service_tickets_service_cost_check', sql`${table.serviceCost} >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * aftersales.service_ticket_comments
 * ------------------------------------------------------------------------ */

export const COMMENT_VISIBILITIES = ['internal', 'customer'] as const;
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];
export const COMMENT_AUTHOR_TYPES = ['staff', 'customer'] as const;
export type CommentAuthorType = (typeof COMMENT_AUTHOR_TYPES)[number];

/**
 * Message thread of a service ticket (ERP-0022). Staff write internal notes
 * or customer-visible replies; the customer writes from the portal, always
 * customer-visible. Only `visibility = 'customer'` rows reach the portal.
 */
export const serviceTicketComments = aftersalesSchema.table(
	'service_ticket_comments',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		serviceTicketId: uuid('service_ticket_id')
			.notNull()
			.references(() => serviceTickets.id, { onDelete: 'cascade' }),
		authorType: text('author_type').$type<CommentAuthorType>().notNull().default('staff'),
		/** Logical reference to auth.users.id (staff, or the customer's portal login). */
		authorUserId: text('author_user_id'),
		authorName: varchar('author_name', { length: 200 }).notNull(),
		body: text('body').notNull(),
		visibility: text('visibility').$type<CommentVisibility>().notNull().default('internal'),
		...timestamps,
	},
	(table) => [
		index('service_ticket_comments_ticket_created_idx').on(table.serviceTicketId, table.createdAt),
		check('service_ticket_comments_visibility_check', sql`${table.visibility} IN ('internal', 'customer')`),
		check('service_ticket_comments_author_type_check', sql`${table.authorType} IN ('staff', 'customer')`),
		check('service_ticket_comments_customer_visible_check', sql`${table.authorType} = 'staff' OR ${table.visibility} = 'customer'`),
	],
);

export type TServiceTicketCommentInsert = typeof serviceTicketComments.$inferInsert;
export type TServiceTicketCommentSelect = typeof serviceTicketComments.$inferSelect;
export type TWarrantyCertificateInsert = typeof warrantyCertificates.$inferInsert;
export type TWarrantyCertificateSelect = typeof warrantyCertificates.$inferSelect;
export type TServiceTicketInsert = typeof serviceTickets.$inferInsert;
export type TServiceTicketSelect = typeof serviceTickets.$inferSelect;
