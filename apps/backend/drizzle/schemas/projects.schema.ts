/**
 * Projects domain schema — owns the `projects` Postgres schema (M07,
 * ADR-0011 step 6a).
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0011 §2, ADR-0012), like the
 *   deals (sales orders) projects come from.
 * - **No foreign keys inside the module** (module-ownership §9): tasks,
 *   evidence and costs carry a plain `project_id` the project service
 *   validates.
 * - Money is bigint IDR minor units (ADR-0002); business dates are Jakarta
 *   `date` strings; operational timestamps are unix ms.
 * - References to other modules (`sales`, `crm`, `auth`) are plain id
 *   columns, validated through those modules' services.
 */
import { sql } from 'drizzle-orm';
import { bigint, check, date, index, integer, jsonb, pgSchema, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const projectsSchema = pgSchema('projects');

/** Work stages, in order. `warranty` is reached only by closing. */
export const PROJECT_STAGES = ['preparation', 'delivery', 'installation', 'testing', 'training', 'handover', 'warranty'] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_STATUSES = ['active', 'closed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EVIDENCE_KINDS = ['testing', 'training', 'bast', 'photo', 'other'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Closing needs a function test, a training and a signed BAST (2026-11-04). */
export const REQUIRED_EVIDENCE: readonly EvidenceKind[] = ['testing', 'training', 'bast'];

export const COST_CATEGORIES = ['material', 'transport', 'accommodation', 'subcontract', 'other'] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

const stageCheck = (column: string) =>
	sql.raw(`${column} IN ('preparation', 'delivery', 'installation', 'testing', 'training', 'handover', 'warranty')`);

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * projects.projects
 * ------------------------------------------------------------------------ */

export const projects = projectsSchema.table(
	'projects',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		/** Logical reference to sales.sales_orders.id — one live project per order. */
		salesOrderId: uuid('sales_order_id').notNull(),
		salesOrderCode: varchar('sales_order_code', { length: 32 }).notNull(),
		quotationCode: varchar('quotation_code', { length: 40 }),
		/** Logical reference to crm.customers.id. */
		customerId: uuid('customer_id').notNull(),
		customerName: text('customer_name').notNull(),
		title: text('title').notNull(),
		siteName: varchar('site_name', { length: 200 }),
		/** The order's grand total incl. VAT at creation. */
		contractValue: bigint('contract_value', { mode: 'number' }).notNull().default(0),
		/** Logical reference to auth.users.id; must hold `project:update`. */
		picUserId: text('pic_user_id').notNull(),
		targetStartDate: date('target_start_date'),
		targetEndDate: date('target_end_date'),
		stage: text('stage').$type<ProjectStage>().notNull().default('preparation'),
		status: text('status').$type<ProjectStatus>().notNull().default('active'),
		notes: text('notes'),
		closedBy: text('closed_by'),
		closedAt: unixTimestampNullable('closed_at'),
		cancelledBy: text('cancelled_by'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
		cancelReason: text('cancel_reason'),
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('projects_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('projects_live_sales_order_uq')
			.on(table.salesOrderId)
			.where(sql`deleted_at IS NULL AND status <> 'cancelled'`),
		index('projects_sales_order_id_idx').on(table.salesOrderId),
		index('projects_customer_id_idx').on(table.customerId),
		index('projects_pic_user_id_idx').on(table.picUserId),
		index('projects_status_idx').on(table.status),
		check('projects_status_check', sql`${table.status} IN ('active', 'closed', 'cancelled')`),
		check('projects_stage_check', stageCheck('stage')),
		check('projects_contract_value_check', sql`${table.contractValue} >= 0`),
		check(
			'projects_dates_check',
			sql`${table.targetEndDate} IS NULL OR ${table.targetStartDate} IS NULL OR ${table.targetEndDate} >= ${table.targetStartDate}`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * projects.project_tasks
 * ------------------------------------------------------------------------ */

export const projectTasks = projectsSchema.table(
	'project_tasks',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Same-module reference to projects.projects.id (no FK by design). */
		projectId: uuid('project_id').notNull(),
		position: integer('position').notNull().default(0),
		title: text('title').notNull(),
		stage: text('stage').$type<ProjectStage>().notNull(),
		/** Logical reference to auth.users.id; must hold `task:update`. */
		assigneeUserId: text('assignee_user_id'),
		dueDate: date('due_date'),
		status: text('status').$type<TaskStatus>().notNull().default('todo'),
		doneBy: text('done_by'),
		doneAt: unixTimestampNullable('done_at'),
		createdBy: text('created_by'),
		deletedBy: text('deleted_by'),
		...timestamps,
	},
	(table) => [
		index('project_tasks_project_position_idx').on(table.projectId, table.position),
		index('project_tasks_assignee_user_id_idx').on(table.assigneeUserId),
		check('project_tasks_status_check', sql`${table.status} IN ('todo', 'in_progress', 'done')`),
		check('project_tasks_stage_check', stageCheck('stage')),
	],
);

/* ------------------------------------------------------------------------ *
 * projects.project_evidence
 * ------------------------------------------------------------------------ */

export const projectEvidence = projectsSchema.table(
	'project_evidence',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		projectId: uuid('project_id').notNull(),
		/** Same-module reference to projects.project_tasks.id (no FK by design). */
		taskId: uuid('task_id'),
		kind: text('kind').$type<EvidenceKind>().notNull(),
		storageKey: text('storage_key').notNull(),
		fileName: varchar('file_name', { length: 200 }).notNull(),
		/** Detected from the file content, never from the name. */
		contentType: varchar('content_type', { length: 100 }).notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		note: varchar('note', { length: 500 }),
		uploadedBy: text('uploaded_by').notNull(),
		deletedBy: text('deleted_by'),
		...timestamps,
	},
	(table) => [
		index('project_evidence_project_kind_idx').on(table.projectId, table.kind),
		check('project_evidence_kind_check', sql`${table.kind} IN ('testing', 'training', 'bast', 'photo', 'other')`),
		check('project_evidence_size_check', sql`${table.sizeBytes} > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * projects.project_costs
 * ------------------------------------------------------------------------ */

export const projectCosts = projectsSchema.table(
	'project_costs',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		projectId: uuid('project_id').notNull(),
		category: text('category').$type<CostCategory>().notNull(),
		costDate: date('cost_date').notNull(),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		description: varchar('description', { length: 300 }).notNull(),
		receiptStorageKey: text('receipt_storage_key'),
		receiptFileName: varchar('receipt_file_name', { length: 200 }),
		receiptContentType: varchar('receipt_content_type', { length: 100 }),
		createdBy: text('created_by'),
		voidedBy: text('voided_by'),
		voidedAt: unixTimestampNullable('voided_at'),
		voidReason: text('void_reason'),
		...timestamps,
	},
	(table) => [
		index('project_costs_project_date_idx').on(table.projectId, table.costDate),
		check(
			'project_costs_category_check',
			sql`${table.category} IN ('material', 'transport', 'accommodation', 'subcontract', 'other')`,
		),
		check('project_costs_amount_check', sql`${table.amount} > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * projects.project_handover (BAST, step 6b)
 * ------------------------------------------------------------------------ */

export const BAST_STATUSES = ['issued', 'cancelled'] as const;
export type BastStatus = (typeof BAST_STATUSES)[number];

/** One handed-over or covered row (BAST and warranty tables). */
export type TDocumentItem = { description: string; volume: string; remarks: string };

/**
 * Berita Acara Serah Terima. Several per project (owner decision
 * 2026-11-06: one per contract or work package).
 */
export const projectHandover = projectsSchema.table(
	'project_handover',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		projectId: uuid('project_id').notNull(),
		code: varchar('code', { length: 32 }).notNull(),
		/** Jakarta business date, printed in words. */
		bastDate: date('bast_date').notNull(),
		firstPartyCompany: varchar('first_party_company', { length: 200 }).notNull(),
		firstPartyName: varchar('first_party_name', { length: 120 }).notNull(),
		firstPartyTitle: varchar('first_party_title', { length: 120 }).notNull(),
		secondPartyCompany: varchar('second_party_company', { length: 200 }).notNull(),
		secondPartyName: varchar('second_party_name', { length: 120 }).notNull(),
		secondPartyTitle: varchar('second_party_title', { length: 120 }).notNull(),
		contractNumber: varchar('contract_number', { length: 120 }),
		workTitle: varchar('work_title', { length: 300 }).notNull(),
		projectName: varchar('project_name', { length: 200 }),
		items: jsonb('items').$type<TDocumentItem[]>().notNull(),
		scope: jsonb('scope').$type<string[]>().notNull(),
		status: text('status').$type<BastStatus>().notNull().default('issued'),
		createdBy: text('created_by'),
		cancelledBy: text('cancelled_by'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('project_handover_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('project_handover_project_id_idx').on(table.projectId),
		check('project_handover_status_check', sql`${table.status} IN ('issued', 'cancelled')`),
	],
);

export type TProjectInsert = typeof projects.$inferInsert;
export type TProjectSelect = typeof projects.$inferSelect;
export type TProjectTaskInsert = typeof projectTasks.$inferInsert;
export type TProjectTaskSelect = typeof projectTasks.$inferSelect;
export type TProjectEvidenceInsert = typeof projectEvidence.$inferInsert;
export type TProjectEvidenceSelect = typeof projectEvidence.$inferSelect;
export type TProjectCostInsert = typeof projectCosts.$inferInsert;
export type TProjectCostSelect = typeof projectCosts.$inferSelect;
export type TProjectHandoverInsert = typeof projectHandover.$inferInsert;
export type TProjectHandoverSelect = typeof projectHandover.$inferSelect;
