import { randomBytes } from 'node:crypto';

/**
 * Marks a session created by the customer portal's own sign-in (ERP-0022,
 * owner decision D2: the web admin refuses customer logins).
 *
 * The portal module's server-side Better Auth calls send this header with a
 * per-process random nonce; `session.create.before` refuses a session for a
 * user with a portal identity unless the header carries the nonce. A browser
 * hitting `/api/auth/sign-in/*` (the web admin) never knows it.
 */
export const PORTAL_SIGNIN_HEADER = 'x-erp-portal-signin';
export const PORTAL_SIGNIN_NONCE = randomBytes(32).toString('hex');
