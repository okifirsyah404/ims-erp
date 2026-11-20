/**
 * Customer-portal guard (ERP-0022).
 *
 * One plugin, one macro: `portalGuard()` registers the `portal` macro. A
 * route with `portal: true`:
 *
 *   1. reads `Authorization: Bearer <access token>` (the token the portal's
 *      server received from `POST /portal/v1/auth/login`);
 *   2. asks the {@link IPortalSessionResolver} (the customer module) for the
 *      Better Auth session behind it AND an active customer portal identity;
 *   3. answers 401 otherwise.
 *
 * The bearer token is honoured only here: Better Auth's `bearer` plugin is
 * deliberately not installed, so the same token is useless on every ERP
 * route (and a portal user is never an organization member anyway).
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
	/** The access token of this request (for logout / password change). */
	accessToken: string;
};

/** Implemented by the customer module: bearer token → portal context, or `null`. */
export interface IPortalSessionResolver {
	resolve(accessToken: string): Promise<PortalContext | null>;
}

export const PORTAL_SESSION_RESOLVER_TOKEN: InjectionToken<IPortalSessionResolver> = Symbol('PORTAL_SESSION_RESOLVER');

/** No valid portal session (missing, expired or revoked token, or no active customer identity). */
export class PortalUnauthenticatedError extends AppError {
	constructor() {
		super(401, 'portal.unauthenticated', 'Portal session required');
	}
}

/** The bearer token of a request, or `null`. */
export function bearerToken(headers: Headers): string | null {
	const header = headers.get('authorization');
	if (!header || header.slice(0, 7).toLowerCase() !== 'bearer ') return null;
	const token = header.slice(7).trim();
	return token.length > 0 && token.length <= 8192 ? token : null;
}

export function portalGuard() {
	const resolver = container.resolve(PORTAL_SESSION_RESOLVER_TOKEN);
	return new Elysia({ name: 'portal-guard' }).macro({
		portal: (enabled: boolean) => ({
			resolve: async ({ request }: { request: Request }): Promise<{ portal: PortalContext }> => {
				if (!enabled) return { portal: undefined as never };
				const token = bearerToken(request.headers);
				const portal = token ? await resolver.resolve(token) : null;
				if (!portal) throw new PortalUnauthenticatedError();
				return { portal };
			},
		}),
	});
}
