import type { TPortalIdentitySelect } from '@drizzle/schemas/portal.schema';
import { z } from 'zod';

/** `POST /admin/portal-accounts` — invite a customer to the customer portal (ERP-0022). */
export const inviteCustomerPortalSchema = z.object({
	customerId: z.string().uuid(),
	name: z.string().trim().min(1).max(200),
	email: z.string().trim().toLowerCase().email().max(254),
});
export type TInviteCustomerPortalRequest = z.infer<typeof inviteCustomerPortalSchema>;

export const portalAccountQuerySchema = z.object({ customerId: z.string().uuid() });
export const portalAccountIdParamSchema = z.object({ id: z.string().uuid() });

/** What the admin screen shows about a customer's portal login. */
export type TPortalAccountView = {
	id: string;
	customerId: string;
	status: TPortalIdentitySelect['status'];
	user: { id: string; name: string; email: string };
	/** False until the customer has set a password from the emailed link. */
	passwordSet: boolean;
	lastLoginAt: Date | null;
	createdAt: Date;
};

/** The customer behind an active portal login — what `/portal/v1` routes are scoped to. */
export type TPortalCustomerIdentity = {
	identityId: string;
	userId: string;
	customerId: string;
	user: { id: string; name: string; email: string };
};

/** Persistence port for `auth.portal_identities`. */
export interface IPortalIdentityRepository {
	findLiveByEntity(portalType: 'customer', entityId: string): Promise<TPortalIdentitySelect | null>;
	findLiveByUser(userId: string): Promise<TPortalIdentitySelect | null>;
	findLiveById(id: string): Promise<TPortalIdentitySelect | null>;
	create(data: { userId: string; portalType: 'customer'; linkedEntityId: string; createdBy: string }): Promise<TPortalIdentitySelect>;
	/** Conditional: only a live, not yet revoked row. Returns `null` when nothing changed. */
	revoke(id: string): Promise<TPortalIdentitySelect | null>;
	touchLogin(id: string): Promise<void>;
}

/** Better Auth port for portal logins (users, passwords, sessions). */
export interface IPortalAuthGateway {
	findUserByEmail(email: string): Promise<{ id: string; name: string; email: string } | null>;
	findUserById(id: string): Promise<{ id: string; name: string; email: string } | null>;
	/** A verified user without a password and without any organization membership. */
	createUser(input: { name: string; email: string }): Promise<{ id: string; name: string; email: string }>;
	hasPassword(userId: string): Promise<boolean>;
	/** Issues a one-time token accepted by Better Auth's reset-password endpoint. */
	issuePasswordToken(userId: string, ttlSeconds: number): Promise<string>;
	revokeSessions(userId: string): Promise<void>;
	isOrganizationMember(userId: string): Promise<boolean>;
}

/** Mail port: the portal "set your password" and "reset your password" emails. */
export interface IPortalMailer {
	sendInvitation(input: { to: string; name: string; url: string }): Promise<void>;
	sendPasswordReset(input: { to: string; name: string; url: string }): Promise<void>;
}
