/**
 * Public entry point of the customer module: composition-root registration,
 * the HTTP surface as a single Elysia factory, and the exported customer API
 * for other modules.
 *
 * @remarks
 * Replaces the former `crm` and `portal` modules (ADR-0024 P2). Leads and the
 * website inquiry surface moved to `project` (Q12).
 */
import Elysia from 'elysia';

import { CustomerCodeNumberingController } from './controllers/code-numbering.controller';
import { CustomerController } from './controllers/customer.controller';
import { PortalAccountController } from './controllers/portal-account.controller';
import { PortalAuthController, PortalController } from './controllers/portal.controller';

export { registerCustomer } from './container';
export { ExportedCustomerService } from './services/exported-customer.service';
export type { TCustomerSnapshot } from './services/exported-customer.service';
export { EXPORTED_CUSTOMER_SERVICE_TOKEN } from './constants/di';

/**
 * Elysia instance mounting every customer controller.
 *
 * @remarks
 * The portal routes share the `/customers` prefix with the admin master but
 * use a different guard (`portal`, bearer token), so the master's `erp` guard
 * never applies to them; the staff-facing portal-account routes live under
 * `/admin/customers/portal-accounts`.
 */
export function customerModule() {
	return new Elysia({ name: 'customer' })
		.use(CustomerController.plugin())
		.use(CustomerCodeNumberingController.plugin())
		.use(PortalAccountController.plugin())
		.use(PortalAuthController.plugin())
		.use(PortalController.plugin());
}
