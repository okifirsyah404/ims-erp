/**
 * Public entry point of the aftersales module.
 *
 * @remarks
 * Exports the module's HTTP surface as a single Elysia factory
 * (`aftersalesModule()`) plus the composition-root registration, so
 * `src/app/app.ts` only mounts `.use(aftersalesModule())` and never lists
 * the module's controllers individually. Mirrors every other module
 * entry point.
 */
import Elysia from 'elysia';

import { ServiceTicketController } from './controllers/service-ticket.controller';
import { WarrantyController } from './controllers/warranty.controller';
import { WarrantyRenderController } from './controllers/warranty-render.controller';

export { registerAftersales } from './container';

/** Elysia instance mounting every aftersales controller, in route order. */
export function aftersalesModule() {
	return new Elysia({ name: 'aftersales' })
		.use(WarrantyController.plugin())
		.use(WarrantyRenderController.plugin())
		.use(ServiceTicketController.plugin());
}
