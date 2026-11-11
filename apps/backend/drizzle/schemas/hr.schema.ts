/**
 * HR module schema — the `hr` Postgres schema.
 *
 * @remarks
 * ERP-0034 introduces only `hr.employees`; the remaining HR tables in
 * `docs/database/docs.dbml` (addresses, contracts, attendance, leave, …)
 * are reserved for later ERP-00xx slices and stay out of the migration
 * until their feature lands.
 *
 * Cross-module references are plain columns (elysia-module rule 3.2):
 * `organization_id` logically references `auth.organizations.id` and
 * `user_id` logically references `auth.users.id` — validated at the
 * service layer through the organization/user/invitation contracts, never
 * by a cross-schema foreign key. `manager_employee_id` is an internal
 * self-reference, so a real FK is allowed.
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { sql } from 'drizzle-orm';
import {
	check,
	index,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const hrSchema = pgSchema('hr');

export const EMPLOYMENT_STATUSES = ['active', 'inactive', 'terminated'] as const;
export type TEmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYMENT_TYPES = [
	'permanent',
	'contract',
	'probation',
	'internship',
	'outsourced',
] as const;
export type TEmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORK_TYPES = ['onsite', 'remote', 'hybrid'] as const;
export type TWorkType = (typeof WORK_TYPES)[number];

/** Shared soft-delete + audit columns (same shape as other schemas). */
const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

export const employees = hrSchema.table(
	'employees',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/**
		 * Logical reference to auth.organizations.id — cross-module FK
		 * intentionally omitted (rule 3.2). `NULL` is a permanent,
		 * valid state: a company-level employee (ADR-0011 global-master-data
		 * pattern) that every `employee:read` holder can see and only app
		 * admins/owners can manage.
		 */
		organizationId: text('organization_id'),
		/**
		 * Logical reference to auth.users.id — cross-module FK intentionally
		 * omitted. Set only by the invite-first creation flow; a user is
		 * linked to at most one alive employee (partial unique index below).
		 */
		userId: text('user_id'),
		/** Auto-issued from `document_sequences` (`employee` series), editable. */
		employeeCode: varchar('employee_code', { length: 32 }).notNull(),
		fullName: text('full_name').notNull(),
		legalName: text('legal_name'),
		nickname: text('nickname'),
		gender: text('gender'),
		birthDate: unixTimestampNullable('birth_date'),
		birthPlace: text('birth_place'),
		/** National identity number (NIK). */
		nationalId: varchar('national_id', { length: 32 }),
		maritalStatus: text('marital_status'),
		email: varchar('email', { length: 320 }),
		phone: varchar('phone', { length: 100 }),
		whatsapp: varchar('whatsapp', { length: 100 }),
		/** Object-storage key of the profile photo. */
		photoObjectKey: text('photo_object_key'),
		employmentStatus: text('employment_status').notNull().default('active'),
		employmentType: text('employment_type').notNull().default('permanent'),
		workType: text('work_type').notNull().default('onsite'),
		hireDate: unixTimestampNullable('hire_date'),
		terminationDate: unixTimestampNullable('termination_date'),
		/** Internal self-reference within the `hr` schema — FK allowed. */
		managerEmployeeId: uuid('manager_employee_id').references((): AnyPgColumn => employees.id, {
			onDelete: 'set null',
		}),
		...timestamps,
	},
	(table) => [
		uniqueIndex('hr_employees_code_uq')
			.on(table.organizationId, table.employeeCode)
			.where(sql`deleted_at IS NULL`),
		/**
		 * One login ↔ one alive employee. Partial so company-level employees
		 * and historical rows keep working; `NULL` user_id is unconstrained.
		 */
		uniqueIndex('hr_employees_user_uq')
			.on(table.userId)
			.where(sql`user_id IS NOT NULL AND deleted_at IS NULL`),
		index('hr_employees_organization_idx').on(table.organizationId),
		index('hr_employees_user_idx').on(table.userId),
		index('hr_employees_full_name_idx').on(table.fullName),
		check(
			'hr_employees_employment_status_check',
			sql`${table.employmentStatus} IN ('active', 'inactive', 'terminated')`,
		),
		check(
			'hr_employees_employment_type_check',
			sql`${table.employmentType} IN ('permanent', 'contract', 'probation', 'internship', 'outsourced')`,
		),
		check(
			'hr_employees_work_type_check',
			sql`${table.workType} IN ('onsite', 'remote', 'hybrid')`,
		),
	],
);

export type TEmployeeInsert = typeof employees.$inferInsert;
export type TEmployeeSelect = typeof employees.$inferSelect;
