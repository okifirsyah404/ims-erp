import { z } from 'zod';

/**
 * Request schemas and ports of the customer portal API
 * (`/customers/portal/v1`, ERP-0022). The portal app (`apps/web-customer-portal`) calls these from
 * its server only; the shapes follow its `PortalSource` contract.
 */

/**
 * A new portal password: the same rule the portal's own form validation
 * applies (`apps/web-customer-portal`, ERP-0094), so the two never disagree.
 */
export const portalNewPasswordSchema = z.string().min(12).max(128);

export const portalLoginSchema = z.object({
	email: z.string().trim().toLowerCase().email().max(254),
	password: z.string().min(1).max(128),
	/** Sent by the portal; ignored (one login per customer). */
	accountType: z.enum(['individual', 'business']).optional(),
});

export const portalPasswordResetSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const portalPasswordConfirmSchema = z.object({
	token: z.string().min(16).max(256),
	password: portalNewPasswordSchema,
});

export const portalChangePasswordSchema = z.object({
	current: z.string().min(1).max(128),
	next: portalNewPasswordSchema,
});

export const portalTicketSchema = z.object({
	category: z.enum(['hardware', 'software', 'installation', 'billing', 'warranty', 'other']).default('other'),
	priority: z.enum(['low', 'normal', 'urgent']).default('normal'),
	/** A device from `GET /products` (`<certificate id>:<line>`). */
	productId: z.string().max(80).optional(),
	subject: z.string().trim().min(1).max(200),
	description: z.string().trim().min(1).max(3500),
});

export const portalMessageSchema = z.object({ text: z.string().trim().min(1).max(4000) });

/** `verifyEmail` / `resendVerification` of the sign-up (owner decision D1). */
export const portalVerifySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), code: z.string().trim().regex(/^\d{6}$/) });
export const portalResendSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const portalIdParamSchema = z.object({ id: z.string().uuid() });
/** Devices are certificate lines: `<certificate uuid>:<line index>`. */
export const portalProductParamSchema = z.object({ id: z.string().regex(/^[0-9a-f-]{36}:\d{1,3}$/i) });

export type TPortalLoginRequest = z.output<typeof portalLoginSchema>;
export type TPortalTicketInput = z.output<typeof portalTicketSchema>;

/**
 * A Better Auth session issued for the portal. `token` is the signed session
 * cookie value; `roles` are the user's global (admin plugin) roles.
 */
export type TPortalSession = { token: string; userId: string; roles: string[]; expiresAt: Date };

/** The global role every portal login carries (ADR-0027); nothing else passes the portal guard. */
export const PORTAL_CUSTOMER_ROLE = 'customer';

/** Better Auth port for portal sessions and passwords. */
export interface IPortalSessionGateway {
	/** Email + password sign-in; `null` on wrong credentials. */
	signIn(email: string, password: string, headers: Headers): Promise<TPortalSession | null>;
	/** A session for a user who just verified a sign-up code. */
	createSession(userId: string): Promise<TPortalSession | null>;
	/** The live session behind a session token, or `null`. */
	getSession(token: string): Promise<TPortalSession | null>;
	/** The session token carried by a request's `Cookie` header, or `null`. */
	tokenFromHeaders(headers: Headers): Promise<string | null>;
	/** A `Set-Cookie` value that hands the session to the portal's server. */
	sessionCookie(session: TPortalSession): Promise<string>;
	/** A `Set-Cookie` value that clears the session cookie. */
	clearedSessionCookie(): Promise<string>;
	signOut(token: string): Promise<void>;
	/** `false` when the current password is wrong. */
	changePassword(token: string, current: string, next: string): Promise<boolean>;
	/** `false` when the token is invalid or expired. */
	resetPassword(token: string, password: string): Promise<boolean>;
}

/** Failed sign-in counter per email (Redis); the lock lasts {@link PORTAL_LOCK_SECONDS}. */
export const PORTAL_MAX_FAILED_LOGINS = 5;
export const PORTAL_LOCK_SECONDS = 15 * 60;
