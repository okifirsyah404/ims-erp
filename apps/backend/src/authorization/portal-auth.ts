/**
 * Customer-portal guard (ERP-0022; session transport ERP-0094, ADR-0027).
 *
 * One plugin, one macro: `portalGuard()` registers the `portal` macro. A
 * route with `portal: true`:
 *
 *   1. hands the request headers to the {@link IPortalSessionResolver} (the
 *      customer module), which reads Better Auth's session cookie from them -
 *      the cookie the portal's server stored after
 *      `POST /customers/portal/v1/auth/login` and forwards on every call (the
 *      browser never holds it);
 *   2. gets back the caller only when the session is live, its user carries
 *      the global `customer` role AND an active portal login exists
 *      (`customer.customers.portal_status = 'active'`);
 *   3. answers 401 otherwise. `Authorization: Bearer` is not accepted.
 *
 * Staff never pass: they have no `customer` role and no portal login, and a
 * customer never passes the ERP guards (no organization membership).
 */
import { Elysia } from 'elysia';
import type { InjectionToken } from 'tsyringe';
import { container } from 'tsyringe';
import { AppError } from '@http/errors';

/** What a portal route knows about its caller. */
export type PortalContext = {
	userId: string;
	/** The person (`customer.customers` row) behind the login (owner decision D2). */
	customerId: string;
	/** The company the person belongs to; `null` for an individual customer. */
	companyId: string | null;
	role: 'owner' | 'approver' | 'finance' | 'viewer';
	user: { id: string; name: string; email: string };
	/** The Better Auth session token of this request (for logout / password change). */
	sessionToken: string;
};

/** Implemented by the customer module: request headers (session cookie) → portal context, or `null`. */
export interface IPortalSessionResolver {
	resolve(headers: Headers): Promise<PortalContext | null>;
}

export const PORTAL_SESSION_RESOLVER_TOKEN: InjectionToken<IPortalSessionResolver> = Symbol('PORTAL_SESSION_RESOLVER');

/** No valid portal session (missing, expired or revoked session, no `customer` role, or no active portal login). */
export class PortalUnauthenticatedError extends AppError {
	constructor() {
		super(401, 'portal.unauthenticated', 'Portal session required');
	}
}

export function portalGuard() {
	const resolver = container.resolve(PORTAL_SESSION_RESOLVER_TOKEN);
	return new Elysia({ name: 'portal-guard' }).macro({
		portal: (enabled: boolean) => ({
			resolve: async ({ request }: { request: Request }): Promise<{ portal: PortalContext }> => {
				if (!enabled) return { portal: undefined as never };
				const portal = await resolver.resolve(request.headers);
				if (!portal) throw new PortalUnauthenticatedError();
				return { portal };
			},
		}),
	});
}
