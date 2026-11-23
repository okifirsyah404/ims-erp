import { z } from 'zod';
import { claimPersonalDataSchema } from './invitation-claim.port';
import {
	employmentTypeSchema,
	erpRoleNames,
	organizationRoleSchema,
} from '@ims-erp/common';
import { isValidPhoneNumber } from 'libphonenumber-js/min';

/**
 * Request/response contracts for the user-management invitation API.
 *
 * @remarks
 * Parsed at the controller boundary before any service call. The unified
 * invitation pipeline covers both paths:
 * - app-admin invite: `{ name, email }` — pre-creates a user with no
 *   organization, app role `user`.
 * - org invite: `{ email, organizationRoles }` — pre-creates a user and (on
 *   claim) attaches the organization membership with the chosen roles from
 *   the closed ERP role enum (defaults to `member` when omitted), stored
 *   comma-joined (Better Auth multi-role convention, ERP-0041).
 */

/** Path parameter shared by all id-targeted invitation routes. */
export const invitationIdParamsSchema = z.object({
	invitationId: z.string().min(1),
});
export type TInvitationIdParams = z.infer<typeof invitationIdParamsSchema>;

/**
 * Body for creating invitation(s). A single object or an array (bulk, cap
 * 100). `name` is required on both paths: it prefills the pre-created user
 * and the claim profile form, and it is what the invitation email greets.
 */
const invitationInputBase = z.object({
	email: z.email().max(320),
	/** Prefills the pre-created user and the claim profile form. */
	name: z.string().min(1).max(120),
	/** Org path only: target organization. Required when organizationRoles is set. */
	organizationId: z.string().min(1).optional(),
	/**
	 * Org path only: target roles from the closed ERP role enum. Optional —
	 * the service defaults to `['member']` on the org path. Stored
	 * comma-joined; duplicates removed, order preserved.
	 */
	organizationRoles: z.array(organizationRoleSchema).min(1).max(erpRoleNames.length).optional(),
	/** Bulk-file convenience: resolve the target org by its unique slug
	 * instead of a UUID. Ignored when `organizationId` is present. */
	organizationSlug: z.string().min(1).max(120).optional(),
	/**
	 * Employee profile created alongside the invitation (ERP-0034): the invite
	 * pipeline always inserts an `hr.employees` row, so the caller may choose
	 * permanent vs. temporary here instead of accepting the `permanent`
	 * default. Absent = `permanent`.
	 */
	employmentType: employmentTypeSchema.optional(),
});

export const createInvitationSchema = z.union([
	invitationInputBase,
	z.array(invitationInputBase).min(1).max(100),
]);
export type TCreateInvitationInput = z.infer<typeof invitationInputBase>;
export const invitationQuerySchema = z.object({
	status: z.enum(['pending', 'accepted', 'cancelled', 'expired']).optional(),
	organizationId: z.string().min(1).optional(),
	email: z.string().min(1).optional(),
});
export type TInvitationQuery = z.infer<typeof invitationQuerySchema>;

/**
 * Phone numbers are stored as E.164 (`+6281234567890`) so the unique index
 * and the planned phone login see one canonical form per subscriber.
 *
 * @remarks
 * The claim form normalizes before submitting, but the backend re-parses:
 * the browser is not a trust boundary. A number without a country prefix is
 * rejected rather than guessed - the caller picked the country explicitly.
 */
const e164PhoneSchema = z
	.string()
	.min(6)
	.max(20)
	.transform((value) => value.replace(/[\s()\-]/g, ''))
	.refine(
		(value) => value.startsWith('+') && isValidPhoneNumber(value),
		'Enter a valid phone number in international format',
	);

/**
 * Public claim body (form 1). No token in the body — the token travels in
 * the URL path and is validated before these fields are ever parsed.
 */
export const claimInvitationSchema = z.object({
	username: z
		.string()
		.min(3)
		.max(30)
		.regex(
			// Better Auth's username plugin (library default validator) accepts
			// alphanumerics + underscore only — no dashes, or the claim fails
			// downstream with a confusing "Username is invalid".
			/^[a-zA-Z0-9_]+$/,
			'Use 3-30 letters, numbers or underscores',
		),
	password: z.string().min(8).max(72),
	phone: e164PhoneSchema,
	/** ERP-0121: the invitee's personal data, stored by the HR module. */
	personal: claimPersonalDataSchema,
});
export type TClaimInvitation = z.infer<typeof claimInvitationSchema>;

/** Username availability query. */
export const usernameAvailableQuerySchema = z.object({
	username: claimInvitationSchema.shape.username,
});
