/**
 * Lead (Prospek) input schema shared by the backend contract and the web
 * form (P7-6 TF-A, form FU1).
 *
 * @remarks
 * One rule set, two callers: `apps/backend/src/app/project/contracts/
 * lead.contract.ts` validates requests with it and the web lead dialog
 * validates the same payload before sending it. Custom rules report a shared
 * key from `forms/form-error.ts` (`contactRequired`, `notPast`) so both sides
 * show the same Indonesian message.
 *
 * Timestamps are unix milliseconds; money is integer IDR minor units
 * (ADR-0002).
 */
import { z } from 'zod';

import { formRule } from '../forms/form-error.js';

/** Lead sources; mirrors `LEAD_SOURCES` in the backend Drizzle schema. */
export const LEAD_SOURCE_VALUES = [
	'website',
	'whatsapp',
	'instagram',
	'phone',
	'referral',
	'walk_in',
	'other',
] as const;

/** Grace for "not in the past": a time picked this minute is still valid. */
const FOLLOW_UP_GRACE_MS = 60_000;

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

/** Field rules of a lead (FU1). */
export const leadFields = {
	name: z.string().trim().min(1).max(200),
	companyName: optionalText(120),
	phone,
	whatsapp: phone,
	email,
	source: z.enum(LEAD_SOURCE_VALUES),
	needs: optionalText(2000),
	/** Integer IDR minor units (ADR-0002). */
	estimatedValue: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullish(),
	nextFollowUpAt: timestamp.nullish(),
};

type TContactShape = {
	phone?: string | null;
	whatsapp?: string | null;
	email?: string | null;
} | null | undefined;

/** At least one of phone, WhatsApp, or email (FU1). */
const hasContact = (value: TContactShape) =>
	Boolean(value?.phone || value?.whatsapp || value?.email);

/** The follow-up, when given, is not in the past (FU1 [27/11]). */
const followUpNotPast = (value: { nextFollowUpAt?: number | null } | null | undefined) =>
	typeof value?.nextFollowUpAt !== 'number' ||
	value.nextFollowUpAt >= Date.now() - FOLLOW_UP_GRACE_MS;

/**
 * Full lead form: every field plus the contact rule.
 *
 * @remarks
 * Used by the web dialog when editing, where an already-passed follow-up the
 * user did not touch must not block saving other fields.
 */
export const leadFormSchema = z
	.object(leadFields)
	.strict()
	.refine(hasContact, formRule('contactRequired', ['contact']));

/** `POST /projects/leads`: the form rules plus a follow-up that is not past. */
export const createLeadSchema = z
	.object({
		...leadFields,
		/** Honoured only for callers with `lead:assign`; ignored otherwise. */
		assignedTo: z.string().min(1).nullish(),
	})
	.strict()
	.refine(hasContact, formRule('contactRequired', ['contact']))
	.refine(followUpNotPast, formRule('notPast', ['nextFollowUpAt']));

/** `PATCH /projects/leads/:id`: any subset of the fields. */
export const updateLeadSchema = z.object(leadFields).partial().strict();

export type TLeadFormInput = z.input<typeof leadFormSchema>;
export type TCreateLeadInput = z.output<typeof createLeadSchema>;
export type TUpdateLeadInput = z.output<typeof updateLeadSchema>;
