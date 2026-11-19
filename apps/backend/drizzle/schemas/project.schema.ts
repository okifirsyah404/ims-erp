/**
 * Project module schema — owns the `project` Postgres schema (was `projects`).
 *
 * @remarks
 * Absorbs the leads from `crm` (ADR-0024 Q12), the warranty certificates from
 * `aftersales` (Q13) and the licensing tables (Q11). Company-wide (ADR-0011).
 * Same-schema references between project tables are plain ids validated by the
 * service (module-ownership §9), except the ones the database can express.
 *
 * Target-only tables (`types`, `phases`, `task_dependencies`, `milestones`,
 * `daily_reports`, `site_assignments`, `kpi_definitions`, `kpi_evaluations`,
 * `changes`, `work_plans`) are defined in `docs.dbml` only (Q22).
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
	integer,
	jsonb,
	numeric,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const projectSchema = pgSchema('project');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

/** Work stages, in order. `warranty` is reached only by closing. */
export const PROJECT_STAGES = [
	'preparation',
	'delivery',
	'installation',
	'testing',
	'training',
	'handover',
	'warranty',
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_STATUSES = ['active', 'closed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EVIDENCE_KINDS = [
	'testing',
	'training',
	'bast',
	'photo',
	'other',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Closing needs a function test, a training and a signed BAST (2026-11-04). */
export const REQUIRED_EVIDENCE: readonly EvidenceKind[] = [
	'testing',
	'training',
	'bast',
];

export const COST_CATEGORIES = [
	'material',
	'transport',
	'accommodation',
	'subcontract',
	'other',
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const BAST_STATUSES = ['issued', 'cancelled'] as const;
export type BastStatus = (typeof BAST_STATUSES)[number];

/** One handed-over or covered row (BAST and warranty tables). */
export type TDocumentItem = {
	description: string;
	volume: string;
	remarks: string;
};

/** Lead pipeline (owner-approved M02 statuses); `won` = converted. */
export const LEAD_STATUSES = [
	'new',
	'contacted',
	'survey',
	'quotation',
	'won',
	'lost',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Statuses before conversion or loss; only these leads can still be converted or followed up. */
export const LEAD_OPEN_STATUSES = [
	'new',
	'contacted',
	'survey',
	'quotation',
] as const satisfies readonly LeadStatus[];

export const LEAD_SOURCES = [
	'website',
	'whatsapp',
	'instagram',
	'phone',
	'referral',
	'walk_in',
	'other',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_ACTIVITY_TYPES = [
	'call',
	'whatsapp',
	'email',
	'meeting',
	'survey',
	'note',
] as const;
export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];

/** Website form that created a lead. */
export const LEAD_CHANNELS = ['rfq', 'contact', 'demo'] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export const APPLICATION_SOURCES = ['third_party', 'own'] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const APPLICATION_STATUSES = ['active', 'retired'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const BILLING_CYCLES = [
	'monthly',
	'quarterly',
	'semi_annual',
	'annual',
	'one_time',
] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const CONTRACT_STATUSES = [
	'draft',
	'active',
	'suspended',
	'terminated',
	'renewed',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const KEY_SOURCES = ['vendor', 'generated'] as const;
export type KeySource = (typeof KEY_SOURCES)[number];

export const KEY_STATUSES = ['active', 'revoked'] as const;
export type KeyStatus = (typeof KEY_STATUSES)[number];

export const ACTIVATION_STATUSES = ['active', 'deactivated'] as const;
export type ActivationStatus = (typeof ACTIVATION_STATUSES)[number];

export const LICENSE_EVENT_TYPES = [
	'validated',
	'activated',
	'deactivated',
	'renewed',
	'suspended',
	'reactivated',
	'terminated',
	'key_revoked',
] as const;
export type LicenseEventType = (typeof LICENSE_EVENT_TYPES)[number];

export const API_KEY_STATUSES = ['active', 'revoked'] as const;
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];

const stageCheck = (column: string) =>
	sql.raw(
		`${column} IN ('preparation', 'delivery', 'installation', 'testing', 'training', 'handover', 'warranty')`,
	);

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * project.projects / tasks / evidence / costs / handover / addresses
 * ------------------------------------------------------------------------ */

export const projects = projectSchema.table(
	'projects',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		/** Logical reference to sale.orders.id — one live project per order. */
		orderId: uuid('order_id').notNull(),
		orderCode: varchar('order_code', { length: 32 }).notNull(),
		quotationCode: varchar('quotation_code', { length: 40 }),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id').notNull(),
		/** Logical reference to customer.companies.id — cross-module FK omitted. */
		companyId: uuid('company_id'),
		leadId: uuid('lead_id').references((): AnyPgColumn => leads.id, {
			onDelete: 'set null',
		}),
		customerName: text('customer_name').notNull(),
		title: text('title').notNull(),
		siteName: varchar('site_name', { length: 200 }),
		addressId: uuid('address_id').references((): AnyPgColumn => addresses.id, {
			onDelete: 'set null',
		}),
		contractValue: bigint('contract_value', { mode: 'number' })
			.notNull()
			.default(0),
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
		uniqueIndex('projects_live_order_uq')
			.on(table.orderId)
			.where(sql`deleted_at IS NULL AND status <> 'cancelled'`),
		index('projects_order_id_idx').on(table.orderId),
		index('projects_customer_id_idx').on(table.customerId),
		index('projects_company_id_idx').on(table.companyId),
		index('projects_lead_id_idx').on(table.leadId),
		index('projects_pic_user_id_idx').on(table.picUserId),
		index('projects_status_idx').on(table.status),
		check(
			'projects_status_check',
			sql`${table.status} IN ('active', 'closed', 'cancelled')`,
		),
		check('projects_stage_check', stageCheck('stage')),
		check('projects_contract_value_check', sql`${table.contractValue} >= 0`),
		check(
			'projects_dates_check',
			sql`${table.targetEndDate} IS NULL OR ${table.targetStartDate} IS NULL OR ${table.targetEndDate} >= ${table.targetStartDate}`,
		),
	],
);

export const tasks = projectSchema.table(
	'tasks',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Same-module reference to project.projects.id (no FK by design). */
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
		index('tasks_project_position_idx').on(table.projectId, table.position),
		index('tasks_assignee_user_id_idx').on(table.assigneeUserId),
		check(
			'tasks_status_check',
			sql`${table.status} IN ('todo', 'in_progress', 'done')`,
		),
		check('tasks_stage_check', stageCheck('stage')),
	],
);

export const evidence = projectSchema.table(
	'evidence',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		projectId: uuid('project_id').notNull(),
		/** Same-module reference to project.tasks.id (no FK by design). */
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
		index('evidence_project_kind_idx').on(table.projectId, table.kind),
		check(
			'evidence_kind_check',
			sql`${table.kind} IN ('testing', 'training', 'bast', 'photo', 'other')`,
		),
		check('evidence_size_check', sql`${table.sizeBytes} > 0`),
	],
);

export const costs = projectSchema.table(
	'costs',
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
		index('costs_project_date_idx').on(table.projectId, table.costDate),
		check(
			'costs_category_check',
			sql`${table.category} IN ('material', 'transport', 'accommodation', 'subcontract', 'other')`,
		),
		check('costs_amount_check', sql`${table.amount} > 0`),
	],
);

/**
 * Berita Acara Serah Terima. Several per project (owner decision 2026-11-06:
 * one per contract or work package).
 */
export const handover = projectSchema.table(
	'handover',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		projectId: uuid('project_id').notNull(),
		code: varchar('code', { length: 32 }).notNull(),
		bastDate: date('bast_date').notNull(),
		firstPartyCompany: varchar('first_party_company', { length: 200 }).notNull(),
		firstPartyName: varchar('first_party_name', { length: 120 }).notNull(),
		firstPartyTitle: varchar('first_party_title', { length: 120 }).notNull(),
		secondPartyCompany: varchar('second_party_company', {
			length: 200,
		}).notNull(),
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
		uniqueIndex('handover_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('handover_project_id_idx').on(table.projectId),
		check('handover_status_check', sql`${table.status} IN ('issued', 'cancelled')`),
	],
);

/** Project site address; only `village_id` is stored (ADR-0024 Q10). */
export const addresses = projectSchema.table(
	'addresses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull().default('site'),
		label: text('label'),
		addressLine: text('address_line').notNull(),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		villageId: uuid('village_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		latitude: numeric('latitude', { precision: 10, scale: 7 }),
		longitude: numeric('longitude', { precision: 10, scale: 7 }),
		isPrimary: boolean('is_primary').notNull().default(false),
		...timestamps,
	},
	(table) => [
		index('project_addresses_project_id_idx').on(table.projectId),
		check(
			'project_addresses_kind_check',
			sql`${table.kind} IN ('site', 'billing', 'other')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * project.leads / lead_activities / lead_attachments
 * ------------------------------------------------------------------------ */

/**
 * Prospect before a customer record exists (was `crm.leads`, ADR-0024 Q12).
 *
 * @remarks
 * Visibility is a service rule: `lead:assign` holders see all leads, others only
 * leads assigned to them (`owner_user_id`).
 */
export const leads = projectSchema.table(
	'leads',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		name: text('name').notNull(),
		companyName: text('company_name'),
		/** Logical reference to customer.companies.id — cross-module FK omitted. */
		companyId: uuid('company_id'),
		email: text('email'),
		phone: varchar('phone', { length: 30 }),
		whatsapp: varchar('whatsapp', { length: 30 }),
		source: text('source').notNull(),
		status: text('status').notNull().default('new'),
		needs: text('needs'),
		estimatedValue: bigint('estimated_value', { mode: 'number' }),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		/** Assigned salesperson. Logical reference to auth.users.id. */
		ownerUserId: text('owner_user_id'),
		nextFollowUpAt: unixTimestampNullable('next_follow_up_at'),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id'),
		convertedAt: unixTimestampNullable('converted_at'),
		lostReason: text('lost_reason'),
		channel: text('channel'),
		/** Public reference handed back to the website visitor. */
		reference: varchar('reference', { length: 40 }),
		submission: jsonb('submission').$type<Record<string, unknown>>(),
		idempotencyKey: varchar('idempotency_key', { length: 100 }),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		index('leads_owner_user_id_idx').on(table.ownerUserId),
		index('leads_company_id_idx').on(table.companyId),
		index('leads_status_idx').on(table.status),
		index('leads_next_follow_up_at_idx').on(table.nextFollowUpAt),
		uniqueIndex('leads_reference_uq')
			.on(table.reference)
			.where(sql`reference IS NOT NULL`),
		uniqueIndex('leads_idempotency_key_uq')
			.on(table.idempotencyKey)
			.where(sql`idempotency_key IS NOT NULL`),
		check(
			'leads_source_check',
			sql`${table.source} IN ('website', 'whatsapp', 'instagram', 'phone', 'referral', 'walk_in', 'other')`,
		),
		check(
			'leads_status_check',
			sql`${table.status} IN ('new', 'contacted', 'survey', 'quotation', 'won', 'lost')`,
		),
		check(
			'leads_channel_check',
			sql`${table.channel} IS NULL OR ${table.channel} IN ('rfq', 'contact', 'demo')`,
		),
	],
);

/** Follow-up log of a lead (calls, visits, surveys). */
export const leadActivities = projectSchema.table(
	'lead_activities',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		leadId: uuid('lead_id')
			.notNull()
			.references(() => leads.id, { onDelete: 'restrict' }),
		activityType: text('activity_type').notNull(),
		notes: text('notes').notNull(),
		occurredAt: unixTimestamp('occurred_at').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by').notNull(),
		...timestamps,
	},
	(table) => [
		index('lead_activities_lead_id_idx').on(table.leadId, table.occurredAt),
		check(
			'lead_activities_type_check',
			sql`${table.activityType} IN ('call', 'whatsapp', 'email', 'meeting', 'survey', 'note')`,
		),
	],
);

/** File sent with a website RFQ; the storage key never leaves the server. */
export const leadAttachments = projectSchema.table(
	'lead_attachments',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		leadId: uuid('lead_id')
			.notNull()
			.references(() => leads.id, { onDelete: 'restrict' }),
		fileName: varchar('file_name', { length: 255 }).notNull(),
		contentType: varchar('content_type', { length: 120 }).notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		storageKey: text('storage_key').notNull(),
		...timestamps,
	},
	(table) => [index('lead_attachments_lead_id_idx').on(table.leadId)],
);

/* ------------------------------------------------------------------------ *
 * project.warranties (was aftersales.warranty_certificates)
 * ------------------------------------------------------------------------ */

/** Surat Keterangan Garansi: one live certificate per project. */
export const warranties = projectSchema.table(
	'warranties',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 80 }).notNull(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'restrict' }),
		handoverId: uuid('handover_id')
			.notNull()
			.references(() => handover.id, { onDelete: 'restrict' }),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id').notNull(),
		/** Logical reference to customer.companies.id — cross-module FK omitted. */
		companyId: uuid('company_id'),
		issueDate: date('issue_date').notNull(),
		startDate: date('start_date').notNull(),
		months: integer('months').notNull().default(12),
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
		uniqueIndex('warranties_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('warranties_live_project_uq')
			.on(table.projectId)
			.where(sql`deleted_at IS NULL`),
		index('warranties_customer_id_idx').on(table.customerId),
		index('warranties_company_id_idx').on(table.companyId),
		check('warranties_months_check', sql`${table.months} BETWEEN 1 AND 120`),
		check('warranties_dates_check', sql`${table.endDate} >= ${table.startDate}`),
	],
);

/* ------------------------------------------------------------------------ *
 * Licensing (was licensing.*)
 * ------------------------------------------------------------------------ */

export const licenseApplications = projectSchema.table(
	'license_applications',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		vendor: text('vendor'),
		source: text('source')
			.$type<ApplicationSource>()
			.notNull()
			.default('third_party'),
		description: text('description'),
		status: text('status')
			.$type<ApplicationStatus>()
			.notNull()
			.default('active'),
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('license_applications_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		check(
			'license_applications_source_check',
			sql`${table.source} IN ('third_party', 'own')`,
		),
		check(
			'license_applications_status_check',
			sql`${table.status} IN ('active', 'retired')`,
		),
	],
);

export const licenseContracts = projectSchema.table(
	'license_contracts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id').notNull(),
		/** Logical reference to customer.companies.id — cross-module FK omitted. */
		companyId: uuid('company_id'),
		customerName: text('customer_name').notNull(),
		licenseApplicationId: uuid('license_application_id')
			.notNull()
			.references(() => licenseApplications.id, { onDelete: 'restrict' }),
		packageName: varchar('package_name', { length: 200 }),
		/** Logical reference to sale.orders.id — billing stays in the sales flow. */
		orderId: uuid('order_id'),
		startDate: date('start_date'),
		/** Null = perpetual. */
		endDate: date('end_date'),
		billingCycle: text('billing_cycle')
			.$type<BillingCycle>()
			.notNull()
			.default('annual'),
		contractValue: bigint('contract_value', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		status: text('status').$type<ContractStatus>().notNull().default('draft'),
		renewedFromContractId: uuid('renewed_from_contract_id').references(
			(): AnyPgColumn => licenseContracts.id,
			{ onDelete: 'set null' },
		),
		notes: text('notes'),
		createdBy: text('created_by'),
		activatedBy: text('activated_by'),
		activatedAt: unixTimestampNullable('activated_at'),
		terminatedBy: text('terminated_by'),
		terminatedAt: unixTimestampNullable('terminated_at'),
		terminationReason: text('termination_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('license_contracts_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('license_contracts_customer_id_idx').on(table.customerId),
		index('license_contracts_application_id_idx').on(
			table.licenseApplicationId,
		),
		index('license_contracts_status_idx').on(table.status),
		index('license_contracts_end_date_idx').on(table.endDate),
		check(
			'license_contracts_billing_cycle_check',
			sql`${table.billingCycle} IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'one_time')`,
		),
		check(
			'license_contracts_status_check',
			sql`${table.status} IN ('draft', 'active', 'suspended', 'terminated', 'renewed')`,
		),
		check('license_contracts_value_check', sql`${table.contractValue} >= 0`),
		check(
			'license_contracts_dates_check',
			sql`${table.endDate} IS NULL OR ${table.startDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
		),
	],
);

export const licenseKeys = projectSchema.table(
	'license_keys',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		licenseContractId: uuid('license_contract_id')
			.notNull()
			.references(() => licenseContracts.id, { onDelete: 'restrict' }),
		/** Readable with `license:read_key`; masked otherwise. */
		licenseKey: text('license_key').notNull(),
		keySource: text('key_source')
			.$type<KeySource>()
			.notNull()
			.default('vendor'),
		maxActivations: integer('max_activations').notNull().default(1),
		expiresOn: date('expires_on'),
		status: text('status').$type<KeyStatus>().notNull().default('active'),
		notes: text('notes'),
		createdBy: text('created_by'),
		revokedBy: text('revoked_by'),
		revokedAt: unixTimestampNullable('revoked_at'),
		revokeReason: text('revoke_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('license_keys_key_uq')
			.on(table.licenseKey)
			.where(sql`deleted_at IS NULL`),
		index('license_keys_contract_id_idx').on(table.licenseContractId),
		check(
			'license_keys_source_check',
			sql`${table.keySource} IN ('vendor', 'generated')`,
		),
		check(
			'license_keys_status_check',
			sql`${table.status} IN ('active', 'revoked')`,
		),
		check('license_keys_max_activations_check', sql`${table.maxActivations} > 0`),
	],
);

export const licenseApiKeys = projectSchema.table(
	'license_api_keys',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		licenseApplicationId: uuid('license_application_id')
			.notNull()
			.references(() => licenseApplications.id, { onDelete: 'restrict' }),
		/** Logical reference to auth.apikeys.id (config `licensing`). */
		apiKeyId: text('api_key_id').notNull(),
		name: varchar('name', { length: 100 }).notNull(),
		keyStart: varchar('key_start', { length: 20 }),
		status: text('status')
			.$type<ApiKeyStatus>()
			.notNull()
			.default('active'),
		createdBy: text('created_by'),
		revokedBy: text('revoked_by'),
		revokedAt: unixTimestampNullable('revoked_at'),
		lastUsedAt: unixTimestampNullable('last_used_at'),
		...timestamps,
	},
	(table) => [
		index('license_api_keys_application_id_idx').on(table.licenseApplicationId),
		uniqueIndex('license_api_keys_api_key_id_uq').on(table.apiKeyId),
		check(
			'license_api_keys_status_check',
			sql`${table.status} IN ('active', 'revoked')`,
		),
	],
);

export const licenseActivations = projectSchema.table(
	'license_activations',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		licenseKeyId: uuid('license_key_id')
			.notNull()
			.references(() => licenseKeys.id, { onDelete: 'restrict' }),
		instanceId: varchar('instance_id', { length: 200 }).notNull(),
		deviceName: varchar('device_name', { length: 200 }),
		activatedAt: unixTimestamp('activated_at').notNull(),
		lastSeenAt: unixTimestamp('last_seen_at').notNull(),
		lastIp: text('last_ip'),
		status: text('status')
			.$type<ActivationStatus>()
			.notNull()
			.default('active'),
		deactivatedAt: unixTimestampNullable('deactivated_at'),
		/** Null when the application released the seat itself. */
		deactivatedBy: text('deactivated_by'),
		...timestamps,
	},
	(table) => [
		index('license_activations_key_id_idx').on(table.licenseKeyId),
		uniqueIndex('license_activations_active_uq')
			.on(table.licenseKeyId, table.instanceId)
			.where(sql`status = 'active' AND deleted_at IS NULL`),
		check(
			'license_activations_status_check',
			sql`${table.status} IN ('active', 'deactivated')`,
		),
	],
);

export const licenseEvents = projectSchema.table(
	'license_events',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		licenseKeyId: uuid('license_key_id').references(() => licenseKeys.id, {
			onDelete: 'restrict',
		}),
		licenseContractId: uuid('license_contract_id').references(
			() => licenseContracts.id,
			{ onDelete: 'restrict' },
		),
		licenseApiKeyId: uuid('license_api_key_id').references(
			() => licenseApiKeys.id,
			{ onDelete: 'restrict' },
		),
		eventType: text('event_type').$type<LicenseEventType>().notNull(),
		/** `ok`, `grace`, or the rejection code. */
		result: text('result').notNull(),
		instanceId: varchar('instance_id', { length: 200 }),
		ipAddress: text('ip_address'),
		actorUserId: text('actor_user_id'),
		description: text('description'),
		eventAt: unixTimestamp('event_at').notNull(),
		...timestamps,
	},
	(table) => [
		index('license_events_key_id_idx').on(table.licenseKeyId),
		index('license_events_contract_id_idx').on(table.licenseContractId),
		index('license_events_event_at_idx').on(table.eventAt),
		check(
			'license_events_event_type_check',
			sql`${table.eventType} IN ('validated', 'activated', 'deactivated', 'renewed', 'suspended', 'reactivated', 'terminated', 'key_revoked')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * project.settings / project.code_numberings
 * ------------------------------------------------------------------------ */

export const projectSettings = projectSchema.table(
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
		uniqueIndex('project_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'project_settings_value_type_check',
			sql`value_type IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const projectCodeNumberings = createCodeNumberingTable(projectSchema);

export type TProjectSelect = typeof projects.$inferSelect;
export type TProjectInsert = typeof projects.$inferInsert;
export type TTaskSelect = typeof tasks.$inferSelect;
export type TTaskInsert = typeof tasks.$inferInsert;
export type TEvidenceSelect = typeof evidence.$inferSelect;
export type TEvidenceInsert = typeof evidence.$inferInsert;
export type TCostSelect = typeof costs.$inferSelect;
export type TCostInsert = typeof costs.$inferInsert;
export type THandoverSelect = typeof handover.$inferSelect;
export type THandoverInsert = typeof handover.$inferInsert;
export type TProjectAddressSelect = typeof addresses.$inferSelect;
export type TProjectAddressInsert = typeof addresses.$inferInsert;
export type TLeadSelect = typeof leads.$inferSelect;
export type TLeadInsert = typeof leads.$inferInsert;
export type TLeadActivitySelect = typeof leadActivities.$inferSelect;
export type TLeadActivityInsert = typeof leadActivities.$inferInsert;
export type TLeadAttachmentSelect = typeof leadAttachments.$inferSelect;
export type TLeadAttachmentInsert = typeof leadAttachments.$inferInsert;
export type TWarrantySelect = typeof warranties.$inferSelect;
export type TWarrantyInsert = typeof warranties.$inferInsert;
export type TLicenseApplicationSelect = typeof licenseApplications.$inferSelect;
export type TLicenseApplicationInsert = typeof licenseApplications.$inferInsert;
export type TLicenseContractSelect = typeof licenseContracts.$inferSelect;
export type TLicenseContractInsert = typeof licenseContracts.$inferInsert;
export type TLicenseKeySelect = typeof licenseKeys.$inferSelect;
export type TLicenseKeyInsert = typeof licenseKeys.$inferInsert;
export type TLicenseApiKeySelect = typeof licenseApiKeys.$inferSelect;
export type TLicenseApiKeyInsert = typeof licenseApiKeys.$inferInsert;
export type TLicenseActivationSelect = typeof licenseActivations.$inferSelect;
export type TLicenseActivationInsert = typeof licenseActivations.$inferInsert;
export type TLicenseEventSelect = typeof licenseEvents.$inferSelect;
export type TLicenseEventInsert = typeof licenseEvents.$inferInsert;
export type TProjectSettingSelect = typeof projectSettings.$inferSelect;
export type TProjectSettingInsert = typeof projectSettings.$inferInsert;
export type TProjectCodeNumberingSelect =
	typeof projectCodeNumberings.$inferSelect;
export type TProjectCodeNumberingInsert =
	typeof projectCodeNumberings.$inferInsert;
