import { z } from 'zod';
import { organizationRoleSchema } from '@ims-erp/common';

/**
 * Request/response contracts for the user-management invitation API.
 *
 * @remarks
 * Parsed at the controller boundary before any service call. The unified
 * invitation pipeline covers both paths:
 * - app-admin invite: `{ name, email }` — pre-creates a user with no
 *   organization, app role `user`.
 * - org invite: `{ email, organizationRole }` — pre-creates a user and (on
 *   claim) attaches the organization membership with the chosen role from
 *   the closed ERP role enum (defaults to `member` when omitted).
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
	/** Org path only: target organization. Required when organizationRole is set. */
	organizationId: z.string().min(1).optional(),
	/** Org path only: target role from the closed ERP role enum. Optional —
	 * the service defaults to `member` on the org path. */
	organizationRole: organizationRoleSchema.optional(),
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
 * Public claim body (form 1). No token in the body — the token travels in
 * the URL path and is validated before these fields are ever parsed.
 */
export const claimInvitationSchema = z.object({
	username: z
		.string()
		.min(3)
		.max(30)
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			'Use 3-30 letters, numbers, dashes or underscores',
		),
	password: z.string().min(8).max(72),
	phone: z
		.string()
		.min(6)
		.max(20)
		.regex(/^[+0-9()\-\s]+$/, 'Invalid phone number'),
});
export type TClaimInvitation = z.infer<typeof claimInvitationSchema>;

/** Username availability query. */
export const usernameAvailableQuerySchema = z.object({
	username: claimInvitationSchema.shape.username,
});
