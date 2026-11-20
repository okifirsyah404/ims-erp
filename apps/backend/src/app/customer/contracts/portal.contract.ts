import { z } from 'zod';

/**
 * Request schemas and ports of the customer portal API (`/portal/v1`,
 * ERP-0022). The portal app (`apps/web-customer-portal`) calls these from
 * its server only; the shapes follow its `PortalSource` contract.
 */

export const portalLoginSchema = z.object({
	email: z.string().trim().toLowerCase().email().max(254),
	password: z.string().min(1).max(128),
	/** Sent by the portal; ignored (one login per customer). */
	accountType: z.enum(['individual', 'business']).optional(),
});

export const portalPasswordResetSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const portalPasswordConfirmSchema = z.object({
	token: z.string().min(16).max(256),
	password: z.string().min(8).max(128),
});

export const portalChangePasswordSchema = z.object({
	current: z.string().min(1).max(128),
	next: z.string().min(8).max(128),
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

/** A Better Auth session issued for the portal. */
export type TPortalSession = { token: string; userId: string; expiresAt: Date };

/** Better Auth port for portal sessions and passwords. */
export interface IPortalSessionGateway {
	/** Email + password sign-in; `null` on wrong credentials. */
	signIn(email: string, password: string, headers: Headers): Promise<TPortalSession | null>;
	/** A session for a user who just verified a sign-up code. */
	createSession(userId: string): Promise<TPortalSession | null>;
	/** The live session behind an access token, or `null`. */
	getSession(token: string): Promise<TPortalSession | null>;
	signOut(token: string): Promise<void>;
	/** `false` when the current password is wrong. */
	changePassword(token: string, current: string, next: string): Promise<boolean>;
	/** `false` when the token is invalid or expired. */
	resetPassword(token: string, password: string): Promise<boolean>;
}

/** Failed sign-in counter per email (Redis); the lock lasts {@link PORTAL_LOCK_SECONDS}. */
export const PORTAL_MAX_FAILED_LOGINS = 5;
export const PORTAL_LOCK_SECONDS = 15 * 60;
