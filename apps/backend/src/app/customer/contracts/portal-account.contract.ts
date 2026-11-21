import { PORTAL_ROLES, type PortalRole, type PortalStatus } from '@drizzle/schemas/customer.schema';
import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
const name = z.string().trim().min(1).max(200);

/**
 * `POST /admin/customers/portal-accounts` — staff invite one person of a
 * customer to the customer portal (ERP-0022, owner decision D2: one login per
 * person, ADR-0024 Q5: the login lives on `customer.customers`).
 *
 * @remarks
 * Name an existing person with `customerId`, or give a `companyId` and the
 * invite creates a new contact person under that company with this name and
 * email. When both are given the person must belong to the company.
 */
export const inviteCustomerPortalSchema = z
	.object({
		customerId: z.string().uuid().optional(),
		companyId: z.string().uuid().optional(),
		name,
		email,
		role: z.enum(PORTAL_ROLES).default('owner'),
	})
	.refine((value) => value.customerId || value.companyId, {
		message: 'customerId or companyId is required',
	});
export type TInviteCustomerPortalRequest = z.output<typeof inviteCustomerPortalSchema>;

/** An owner invites a colleague from the portal (never as another owner). */
export const portalMemberInviteSchema = z.object({
	email,
	name: name.optional(),
	role: z.enum(['approver', 'finance', 'viewer']),
});
export type TPortalMemberInvite = z.output<typeof portalMemberInviteSchema>;

/** Owner decision D1: individuals sign up themselves; businesses are invited. */
export const portalSignupSchema = z.object({
	accountType: z.enum(['individual', 'business']),
	name,
	email,
	phone: z
		.string()
		.trim()
		.max(30)
		.regex(/^[0-9+()\-\s]*$/)
		.optional()
		.transform((value) => (value ? value : null)),
	/** Same rule as `portalNewPasswordSchema` and the portal's form (ERP-0094). */
	password: z.string().min(12).max(128),
});
export type TPortalSignup = z.output<typeof portalSignupSchema>;

/** Staff list filter: the logins of one company, or of one individual customer. */
export const portalAccountQuerySchema = z
	.object({
		customerId: z.string().uuid().optional(),
		companyId: z.string().uuid().optional(),
	})
	.refine((value) => value.customerId || value.companyId, {
		message: 'customerId or companyId is required',
	});
export const portalAccountIdParamSchema = z.object({ id: z.string().uuid() });

/** One portal login, as staff and owners see it. `id` is the person's id. */
export type TPortalAccountView = {
	id: string;
	customerId: string;
	companyId: string | null;
	role: PortalRole;
	status: PortalStatus;
	user: { id: string; name: string; email: string };
	/** False until the person has set a password from the emailed link. */
	passwordSet: boolean;
	lastLoginAt: Date | null;
	createdAt: Date;
};

/**
 * The person (and company) behind an active portal login — what the portal
 * routes are scoped to. `customerId` is the person; `companyId` is `null` for
 * an individual customer.
 */
export type TPortalCustomerIdentity = {
	userId: string;
	customerId: string;
	companyId: string | null;
	role: PortalRole;
	user: { id: string; name: string; email: string };
};

/** Mail port: invitation, password reset and sign-up code emails. */
export interface IPortalMailer {
	sendInvitation(input: { to: string; name: string; url: string }): Promise<void>;
	sendPasswordReset(input: { to: string; name: string; url: string }): Promise<void>;
	sendSignupCode(input: { to: string; name: string; code: string }): Promise<void>;
}
