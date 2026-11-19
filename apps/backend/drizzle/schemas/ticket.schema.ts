/**
 * Ticket module schema — owns the `ticket` Postgres schema (was `aftersales`
 * for the service tickets; ADR-0024 Q13/Q29).
 *
 * @remarks
 * Customer-facing issue tickets: the customer portal creates them, staff work
 * them, the customer tracks progress. A ticket may escalate into a warranty
 * service by logical reference to `project.warranties`. Company-wide.
 *
 * Target-only tables (`ticket_templates`, `sub_ticket_templates`) are defined in
 * `docs.dbml` only (Q22); `tickets.ticket_template_id` stays a plain uuid until
 * they exist.
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	date,
	index,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const ticketSchema = pgSchema('ticket');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

export const TICKET_STATUSES = [
	'new',
	'in_progress',
	'resolved',
	'closed',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_TYPES = [
	'installation',
	'repair',
	'maintenance',
	'warranty_service',
	'inspection',
	'other',
] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** `portal` = opened (or confirmed) by the customer in the customer portal. */
export const TICKET_CHANNELS = [
	'phone',
	'whatsapp',
	'email',
	'web',
	'onsite',
	'portal',
	'other',
] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

export const COMMENT_VISIBILITIES = ['internal', 'customer'] as const;
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];

export const COMMENT_AUTHOR_TYPES = ['staff', 'customer'] as const;
export type CommentAuthorType = (typeof COMMENT_AUTHOR_TYPES)[number];

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * ticket.tickets
 * ------------------------------------------------------------------------ */

/**
 * Service ticket (tiket servis), company-wide.
 *
 * @remarks
 * `new -> in_progress -> resolved -> closed` (resolved may reopen); closing
 * needs the customer's confirmation. The warranty check made at the report time
 * is stored on the ticket. A parent closes only when its children are closed.
 */
export const tickets = ticketSchema.table(
	'tickets',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		ticketType: text('ticket_type').$type<TicketType>().notNull().default('other'),
		parentTicketId: uuid('parent_ticket_id').references(
			(): AnyPgColumn => tickets.id,
			{ onDelete: 'set null' },
		),
		/** Plain uuid until project-relative templates exist (Q22). */
		ticketTemplateId: uuid('ticket_template_id'),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id').notNull(),
		/** Logical reference to customer.companies.id — cross-module FK omitted. */
		companyId: uuid('company_id'),
		customerName: text('customer_name').notNull(),
		/** Logical reference to project.projects.id — cross-module FK omitted. */
		projectId: uuid('project_id'),
		/** Logical reference to project.warranties.id — cross-module FK omitted. */
		warrantyId: uuid('warranty_id'),
		/** Logical reference to inventory.item_serials.id — FK omitted. */
		itemSerialId: uuid('item_serial_id'),
		serialNumber: varchar('serial_number', { length: 100 }),
		deviceDescription: varchar('device_description', { length: 300 }),
		channel: text('channel').$type<TicketChannel>().notNull().default('phone'),
		reporterName: varchar('reporter_name', { length: 200 }).notNull(),
		reporterContact: varchar('reporter_contact', { length: 200 }),
		complaint: text('complaint').notNull(),
		priority: text('priority')
			.$type<TicketPriority>()
			.notNull()
			.default('normal'),
		reportedAt: unixTimestamp('reported_at').notNull(),
		inWarranty: boolean('in_warranty').notNull().default(false),
		warrantyEndsOn: date('warranty_ends_on'),
		warrantyCode: varchar('warranty_code', { length: 80 }),
		status: text('status').$type<TicketStatus>().notNull().default('new'),
		/** Logical reference to auth.users.id; must hold `ticket:update`. */
		assigneeUserId: text('assignee_user_id'),
		resolution: text('resolution'),
		serviceCost: bigint('service_cost', { mode: 'number' })
			.notNull()
			.default(0),
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
		uniqueIndex('tickets_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('tickets_customer_id_idx').on(table.customerId),
		index('tickets_company_id_idx').on(table.companyId),
		index('tickets_project_id_idx').on(table.projectId),
		index('tickets_parent_ticket_id_idx').on(table.parentTicketId),
		index('tickets_assignee_user_id_idx').on(table.assigneeUserId),
		index('tickets_status_idx').on(table.status),
		index('tickets_serial_number_idx').on(table.serialNumber),
		check(
			'tickets_type_check',
			sql`ticket_type IN ('installation', 'repair', 'maintenance', 'warranty_service', 'inspection', 'other')`,
		),
		check(
			'tickets_status_check',
			sql`status IN ('new', 'in_progress', 'resolved', 'closed')`,
		),
		check(
			'tickets_priority_check',
			sql`priority IN ('low', 'normal', 'high', 'urgent')`,
		),
		check(
			'tickets_channel_check',
			sql`channel IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other')`,
		),
		check(
			'tickets_confirmation_channel_check',
			sql`confirmation_channel IS NULL OR confirmation_channel IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other')`,
		),
		check('tickets_service_cost_check', sql`service_cost >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * ticket.ticket_messages (was aftersales.service_ticket_comments)
 * ------------------------------------------------------------------------ */

/**
 * Message thread of a ticket.
 *
 * @remarks
 * Staff write internal notes or customer-visible replies; the customer writes
 * from the portal, always customer-visible. Only `visibility = 'customer'` rows
 * reach the portal.
 */
export const ticketMessages = ticketSchema.table(
	'ticket_messages',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		ticketId: uuid('ticket_id')
			.notNull()
			.references(() => tickets.id, { onDelete: 'cascade' }),
		authorType: text('author_type')
			.$type<CommentAuthorType>()
			.notNull()
			.default('staff'),
		/** Logical reference to auth.users.id (staff, or the customer's login). */
		authorUserId: text('author_user_id'),
		authorName: varchar('author_name', { length: 200 }).notNull(),
		body: text('body').notNull(),
		visibility: text('visibility')
			.$type<CommentVisibility>()
			.notNull()
			.default('internal'),
		...timestamps,
	},
	(table) => [
		index('ticket_messages_ticket_created_idx').on(
			table.ticketId,
			table.createdAt,
		),
		check(
			'ticket_messages_visibility_check',
			sql`visibility IN ('internal', 'customer')`,
		),
		check(
			'ticket_messages_author_type_check',
			sql`author_type IN ('staff', 'customer')`,
		),
		check(
			'ticket_messages_customer_visible_check',
			sql`author_type = 'staff' OR visibility = 'customer'`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * ticket.settings / ticket.code_numberings
 * ------------------------------------------------------------------------ */

export const ticketSettings = ticketSchema.table(
	'settings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		settingGroup: text('setting_group').notNull(),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		valueType: text('value_type').notNull().default('string'),
		description: text('description'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('ticket_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'ticket_settings_value_type_check',
			sql`value_type IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const ticketCodeNumberings = createCodeNumberingTable(ticketSchema);

export type TTicketSelect = typeof tickets.$inferSelect;
export type TTicketInsert = typeof tickets.$inferInsert;
export type TTicketMessageSelect = typeof ticketMessages.$inferSelect;
export type TTicketMessageInsert = typeof ticketMessages.$inferInsert;
export type TTicketSettingSelect = typeof ticketSettings.$inferSelect;
export type TTicketSettingInsert = typeof ticketSettings.$inferInsert;
export type TTicketCodeNumberingSelect = typeof ticketCodeNumberings.$inferSelect;
export type TTicketCodeNumberingInsert = typeof ticketCodeNumberings.$inferInsert;
