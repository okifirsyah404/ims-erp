/**
 * Public entry point of the CRM module: composition-root registration, the
 * HTTP surface as a single Elysia factory, and the exported customer API
 * for other modules.
 */
import Elysia from 'elysia';

import { CustomerController } from './controllers/customer.controller';
import { LeadController } from './controllers/lead.controller';
import { PublicWebsiteController } from './controllers/public-website.controller';

export { registerCrm } from './container';
export { CUSTOMER_SERVICE_TOKEN } from './constants/di';
export type { CustomerService } from './services/customer.service';

/** Elysia instance mounting every CRM controller, in route order. */
export function crmModule() {
	return new Elysia({ name: 'crm' })
		.use(CustomerController.plugin())
		.use(LeadController.plugin())
		// Server-to-server website API: API-key guard, no session.
		.use(PublicWebsiteController.plugin());
}
