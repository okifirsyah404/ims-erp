/**
 * Public entry point of the customer portal module (ERP-0022): the API the
 * portal app (website repo, `apps/customer`) calls from its server.
 */
import Elysia from 'elysia';
import { PortalAuthController, PortalController } from './controllers/portal.controller';

export * from './container';

/** Mounts `/portal/v1/auth/*` (no session) and `/portal/v1/*` (portal guard). */
export function portalModule() {
	return new Elysia({ name: 'portal' }).use(PortalAuthController.plugin()).use(PortalController.plugin());
}
