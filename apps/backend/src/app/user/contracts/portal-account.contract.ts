import { PORTAL_ROLES, type PortalRole, type TPortalIdentitySelect } from '@drizzle/schemas/portal.schema';
import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
const name = z.string().trim().min(1).max(200);

/**
 * `POST /admin/portal-accounts` — staff invite one person of a customer to the
 * customer portal (ERP-0022, owner decision D2: one login per contact). Without
 * `contactId` a new contact is created with this name and email.
 */
export const inviteCustomerPortalSchema = z.object({
	customerId: z.string().uuid(),
	contactId: z.string().uuid().optional(),
	name,
	email,
	role: z.enum(PORTAL_ROLES).default('owner'),
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
	password: z.string().min(8).max(128),
});
export type TPortalSignup = z.output<typeof portalSignupSchema>;

export const portalAccountQuerySchema = z.object({ customerId: z.string().uuid() });
export const portalAccountIdParamSchema = z.object({ id: z.string().uuid() });

/** One portal login of a customer, as staff and owners see it. */
export type TPortalAccountView = {
	id: string;
	customerId: string;
	contactId: string | null;
	role: PortalRole;
	status: TPortalIdentitySelect['status'];
	user: { id: string; name: string; email: string };
	/** False until the person has set a password from the emailed link. */
	passwordSet: boolean;
	lastLoginAt: Date | null;
	createdAt: Date;
};

/** The person and customer behind an active portal login — what `/portal/v1` routes are scoped to. */
export type TPortalCustomerIdentity = {
	identityId: string;
	userId: string;
	customerId: string;
	contactId: string | null;
	role: PortalRole;
	user: { id: string; name: string; email: string };
};

/** Persistence port for `auth.portal_identities`. */
export interface IPortalIdentityRepository {
	findLiveByContact(contactId: string): Promise<TPortalIdentitySelect | null>;
	findLiveByUser(userId: string): Promise<TPortalIdentitySelect | null>;
	findLiveById(id: string): Promise<TPortalIdentitySelect | null>;
	listLiveByCustomer(customerId: string): Promise<TPortalIdentitySelect[]>;
	create(data: {
		userId: string;
		portalType: 'customer';
		linkedEntityId: string;
		contactId: string;
		portalRole: PortalRole;
		createdBy: string | null;
	}): Promise<TPortalIdentitySelect>;
	/** Conditional: only a live, not yet revoked row. Returns `null` when nothing changed. */
	revoke(id: string): Promise<TPortalIdentitySelect | null>;
	touchLogin(id: string): Promise<void>;
}

export type TAuthUser = { id: string; name: string; email: string; emailVerified: boolean };

/** Better Auth port for portal logins (users, passwords, sessions). */
export interface IPortalAuthGateway {
	findUserByEmail(email: string): Promise<TAuthUser | null>;
	findUserById(id: string): Promise<TAuthUser | null>;
	/** A user without any organization membership; `emailVerified` as given. */
	createUser(input: { name: string; email: string; emailVerified: boolean }): Promise<TAuthUser>;
	/** Sets (or replaces) the credential password through Better Auth's hasher. */
	setPassword(userId: string, password: string): Promise<void>;
	markEmailVerified(userId: string): Promise<void>;
	hasPassword(userId: string): Promise<boolean>;
	/** Issues a one-time token accepted by Better Auth's reset-password endpoint. */
	issuePasswordToken(userId: string, ttlSeconds: number): Promise<string>;
	revokeSessions(userId: string): Promise<void>;
	isOrganizationMember(userId: string): Promise<boolean>;
}

/** Mail port: invitation, password reset and sign-up code emails. */
export interface IPortalMailer {
	sendInvitation(input: { to: string; name: string; url: string }): Promise<void>;
	sendPasswordReset(input: { to: string; name: string; url: string }): Promise<void>;
	sendSignupCode(input: { to: string; name: string; code: string }): Promise<void>;
}
