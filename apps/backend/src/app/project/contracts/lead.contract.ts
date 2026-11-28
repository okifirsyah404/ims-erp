import { z } from 'zod';
import {
	LEAD_ACTIVITY_TYPES,
	LEAD_OPEN_STATUSES,
	LEAD_SOURCES,
	LEAD_STATUSES,
} from '@drizzle/schemas/project.schema';
import { createCustomerSchema } from '@app/customer/contracts/customer.contract';
import { createLeadSchema, updateLeadSchema } from '@ims-erp/common';

/**
 * Request schemas for the lead endpoints (`/leads`, ADR-0011 step 3b).
 *
 * @remarks
 * Timestamps are unix milliseconds; money is integer IDR minor units. The
 * create/update rules are the shared `@ims-erp/common` lead schema
 * (`crm/lead.schema.ts`), the same one the web lead form validates with
 * (P7-6, TF-A).
 */

const timestamp = z.number().int().positive();

export { createLeadSchema, updateLeadSchema };

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
