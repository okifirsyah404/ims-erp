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

/** Two-step sign-in (ERP-0106): the challenge from `/auth/login` and the emailed code. */
export const portalLoginCodeSchema = z.object({ challenge: z.string().min(16).max(128), code: z.string().trim().regex(/^\d{6}$/) });
export const portalLoginResendSchema = z.object({ challenge: z.string().min(16).max(128) });

/** Deleting one's own login asks for the password again (ERP-0106). */
export const portalCloseAccountSchema = z.object({ password: z.string().min(1).max(128) });

/** A signed-in device is a Better Auth session id (not a uuid). */
export const portalDeviceParamSchema = z.object({ id: z.string().min(1).max(128) });

/**
 * The login's portal settings (ERP-0106, port plan D3: columns on
 * `customer.customers`). Only push, two-step and language are stored; other
 * channels are not settings on main.
 */
export const portalSettingsSchema = z.object({
	notifications: z.object({ push: z.boolean() }).partial().optional(),
	security: z.object({ twoStep: z.boolean() }).partial().optional(),
	preferences: z.object({ language: z.enum(['en', 'id']) }).partial().optional(),
});
export type TPortalSettingsPatch = z.output<typeof portalSettingsSchema>;

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

/** A signed-in device of the login (ERP-0106); the session token never leaves the ERP. */
export type TPortalDeviceSession = { id: string; token: string; userAgent: string | null; ipAddress: string | null; createdAt: Date; updatedAt: Date };

/** Better Auth port for portal sessions and passwords. */
export interface IPortalSessionGateway {
	/** Email + password sign-in; `null` on wrong credentials. */
	signIn(email: string, password: string, headers: Headers): Promise<TPortalSession | null>;
	/** A session for a user who just verified a code; `from` (request headers) names the device. */
	createSession(userId: string, from?: Headers): Promise<TPortalSession | null>;
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
	/** `false` when the password of the session's user is wrong (ERP-0106). */
	verifyPassword(token: string, password: string): Promise<boolean>;
	/** Every live session of the session's user. */
	listSessions(token: string): Promise<TPortalDeviceSession[]>;
	/** Ends one session of the session's user, by its (raw) session token. */
	revokeSession(token: string, sessionToken: string): Promise<void>;
	/** Ends every session of the user except this one. */
	revokeOtherSessions(token: string): Promise<void>;
}

/** Failed sign-in counter per email (Redis); the lock lasts {@link PORTAL_LOCK_SECONDS}. */
export const PORTAL_MAX_FAILED_LOGINS = 5;
export const PORTAL_LOCK_SECONDS = 15 * 60;
