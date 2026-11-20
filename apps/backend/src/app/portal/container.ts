import { PORTAL_SESSION_RESOLVER_TOKEN } from '@authorization/portal-auth';
import type { DependencyContainer } from 'tsyringe';
import { BetterAuthPortalSessionGateway } from './adapters/better-auth-portal-session';
import {
	PORTAL_ACCOUNT_PAGES_SERVICE_TOKEN,
	PORTAL_AUTH_SERVICE_TOKEN,
	PORTAL_RFQ_SERVICE_TOKEN,
	PORTAL_SALES_SERVICE_TOKEN,
	PORTAL_SERVICE_TOKEN,
	PORTAL_SESSION_GATEWAY_TOKEN,
	PUBLIC_TRACKING_SERVICE_TOKEN,
} from './constants/di';
import { PortalAuthService } from './services/portal-auth.service';
import { PortalService } from './services/portal.service';
import { PortalSalesService } from './services/portal-sales.service';
import { PortalRfqService } from './services/portal-rfq.service';
import { PublicTrackingService } from './services/public-tracking.service';
import { PortalAccountPagesService } from './services/portal-account-pages.service';

export * from './constants/di';

/**
 * Registers the customer portal module (ERP-0022). It owns no tables: the
 * portal identities belong to Identity (`user`), the data to projects,
 * after-sales and CRM. It also provides the portal guard's session resolver.
 *
 * @param container - The tsyringe container to populate
 */
export function registerPortal(container: DependencyContainer): void {
	container.register(PORTAL_SESSION_GATEWAY_TOKEN, { useClass: BetterAuthPortalSessionGateway });
	container.register(PORTAL_AUTH_SERVICE_TOKEN, { useClass: PortalAuthService });
	container.register(PORTAL_SESSION_RESOLVER_TOKEN, { useToken: PORTAL_AUTH_SERVICE_TOKEN });
	container.register(PORTAL_SERVICE_TOKEN, { useClass: PortalService });
	container.register(PORTAL_SALES_SERVICE_TOKEN, { useClass: PortalSalesService });
	container.register(PORTAL_RFQ_SERVICE_TOKEN, { useClass: PortalRfqService });
	container.register(PUBLIC_TRACKING_SERVICE_TOKEN, { useClass: PublicTrackingService });
	container.register(PORTAL_ACCOUNT_PAGES_SERVICE_TOKEN, { useClass: PortalAccountPagesService });
}
