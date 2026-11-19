/**
 * Public entry point of the customer portal module (ERP-0022): the API the
 * portal app (`apps/web-customer-portal`) calls from its server.
 */
import Elysia from 'elysia';
import { PortalAuthController, PortalController } from './controllers/portal.controller';
import { PortalSalesController } from './controllers/portal-sales.controller';
import { PublicTrackingController } from './controllers/public-tracking.controller';

export * from './container';

/**
 * Mounts `/portal/v1/auth/*` (no session), `/portal/v1/*` (portal guard; ordering and
 * sales ERP-0070) and `/public/v1/orders/*` (public order tracking, ERP-0073).
 */
export function portalModule() {
	return new Elysia({ name: 'portal' })
		.use(PortalAuthController.plugin())
		.use(PortalController.plugin())
		.use(PortalSalesController.plugin())
		.use(PublicTrackingController.plugin());
}
