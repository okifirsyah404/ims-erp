import { z } from 'zod';
import {
	LEAD_ACTIVITY_TYPES,
	LEAD_OPEN_STATUSES,
	LEAD_SOURCES,
	LEAD_STATUSES,
} from '@drizzle/schemas/project.schema';
import { createCustomerSchema } from '@app/customer/contracts/customer.contract';

/**
 * Request schemas for the lead endpoints (`/leads`, ADR-0011 step 3b).
 *
 * @remarks
 * Timestamps are unix milliseconds; money is integer IDR minor units.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const phone = z
	.string()
	.trim()
	.max(30)
	.regex(/^[0-9+()\-\s]*$/)
	.nullish()
	.transform((value) => (value ? value : null));

const email = z
	.union([z.literal(''), z.email().max(254)])
	.nullish()
	.transform((value) => (value ? value.toLowerCase() : null));

const timestamp = z.number().int().positive();

const leadFields = {
	name: z.string().trim().min(1).max(200),
	companyName: optionalText(200),
	phone,
	whatsapp: phone,
	email,
	source: z.enum(LEAD_SOURCES),
	needs: optionalText(2000),
	/** Integer IDR minor units (ADR-0002). */
	estimatedValue: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullish(),
	nextFollowUpAt: timestamp.nullish(),
};

export const createLeadSchema = z
	.object({
		...leadFields,
		/** Honoured only for callers with `lead:assign`; ignored otherwise. */
		assignedTo: z.string().min(1).nullish(),
	})
	.strict()
	.refine((value) => value.phone || value.whatsapp || value.email, {
		message: 'At least one of phone, WhatsApp, or email is required',
		path: ['phone'],
	});

export const updateLeadSchema = z.object(leadFields).partial().strict();

export const leadStatusSchema = z
	.object({
		status: z.enum([...LEAD_OPEN_STATUSES, 'lost']),
		lostReason: z.string().trim().max(1000).optional(),
	})
	.strict()
	.refine((value) => value.status !== 'lost' || (value.lostReason?.length ?? 0) > 0, {
		message: 'A reason is required when marking a lead as lost',
		path: ['lostReason'],
	});

/** `userId: null` unassigns. */
export const assignLeadSchema = z.object({ userId: z.string().min(1).nullable() }).strict();

export const leadActivitySchema = z
	.object({
		activityType: z.enum(LEAD_ACTIVITY_TYPES),
		notes: z.string().trim().min(1).max(4000),
		occurredAt: timestamp.optional(),
		/** Sets (or with null clears) the lead's next follow-up. */
		nextFollowUpAt: timestamp.nullish(),
	})
	.strict();

/** Link an existing active customer OR create a new one from the lead. */
export const convertLeadSchema = z.union([
	z.object({ customerId: z.uuid() }).strict(),
	z.object({ customer: createCustomerSchema }).strict(),
]);

export const leadListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(LEAD_STATUSES).optional(),
	source: z.enum(LEAD_SOURCES).optional(),
	/** `me`, `unassigned`, or a user id (the latter two: managers only). */
	assigned: z.string().min(1).optional(),
	/** Only open leads whose next follow-up is due now or earlier. */
	followUpDue: z
		.enum(['true', 'false'])
		.transform((value) => value === 'true')
		.optional(),
});

export const leadIdParamSchema = z.object({ id: z.uuid() });
export const leadAttachmentParamSchema = z.object({ id: z.uuid(), attachmentId: z.uuid() });

export type TCreateLeadInput = z.output<typeof createLeadSchema>;
export type TUpdateLeadInput = z.output<typeof updateLeadSchema>;
export type TLeadStatusInput = z.output<typeof leadStatusSchema>;
export type TLeadActivityInput = z.output<typeof leadActivitySchema>;
export type TConvertLeadInput = z.output<typeof convertLeadSchema>;
export type TLeadListQuery = z.output<typeof leadListQuerySchema>;
