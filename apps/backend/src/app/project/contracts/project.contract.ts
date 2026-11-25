import { z } from 'zod';
import {
	COST_CATEGORIES, COST_PAYMENT_SOURCES,
	EVIDENCE_KINDS,
	PROJECT_STAGES,
	PROJECT_STATUSES,
	TASK_STATUSES,
} from '@drizzle/schemas/project.schema';

/**
 * Request schemas for projects (`/projects`, M07, ADR-0011 step 6a).
 * Business dates are Jakarta `YYYY-MM-DD` strings; money is IDR minor units.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const businessDate = z.iso.date();

export const createProjectSchema = z.object({
	orderId: z.uuid(),
	picUserId: z.string().min(1),
	siteName: optionalText(200),
	targetStartDate: businessDate.nullish(),
	targetEndDate: businessDate.nullish(),
	notes: optionalText(4000),
});

export const updateProjectSchema = z.object({
	picUserId: z.string().min(1),
	siteName: optionalText(200),
	targetStartDate: businessDate.nullish(),
	targetEndDate: businessDate.nullish(),
	stage: z.enum(PROJECT_STAGES),
	notes: optionalText(4000),
});

export const projectListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(PROJECT_STATUSES).optional(),
	stage: z.enum(PROJECT_STAGES).optional(),
});

export const taskBodySchema = z.object({
	title: z.string().trim().min(1).max(300),
	stage: z.enum(PROJECT_STAGES),
	assigneeUserId: z.string().min(1).nullish(),
	dueDate: businessDate.nullish(),
});

export const taskStatusSchema = z.object({ status: z.enum(TASK_STATUSES) });

/** Multipart: `file`, `kind`, optional `taskId` and `note`. */
export const evidenceUploadSchema = z.object({
	file: z.instanceof(File),
	kind: z.enum(EVIDENCE_KINDS),
	taskId: z.uuid().optional().or(z.literal('').transform(() => undefined)),
	note: z.string().trim().max(500).optional(),
});

/** Multipart: the cost fields and an optional receipt (`nota`). */
export const costBodySchema = z.object({
	category: z.enum(COST_CATEGORIES),
	costDate: businessDate,
	amount: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
	description: z.string().trim().min(1).max(300),
	receipt: z.instanceof(File).optional(),
	/** Who paid; decides the credit side of the journal (ERP-0141). */
	paymentSource: z.enum(COST_PAYMENT_SOURCES).default('employee_claim'),
	reference: z.string().trim().max(100).optional(),
});

export const reasonSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export const projectIdParamSchema = z.object({ id: z.uuid() });
export const projectChildParamSchema = z.object({ id: z.uuid(), childId: z.uuid() });

export type TCreateProjectRequest = z.output<typeof createProjectSchema>;
export type TUpdateProjectRequest = z.output<typeof updateProjectSchema>;
export type TProjectListQuery = z.output<typeof projectListQuerySchema>;
export type TTaskBodyRequest = z.output<typeof taskBodySchema>;
export type TEvidenceUploadRequest = z.output<typeof evidenceUploadSchema>;
export type TCostBodyRequest = z.output<typeof costBodySchema>;
