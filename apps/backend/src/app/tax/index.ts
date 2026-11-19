/**
 * Public entry point of the tax module (`/taxes`, ADR-0024 P5).
 *
 * @remarks
 * Exports the HTTP surface as one Elysia factory, the composition-root
 * registration and the service token other modules use for rate lookups.
 */
import Elysia from 'elysia';

import { TaxController } from './controllers/tax.controller';

export { registerTax } from './container';
export { TAX_SERVICE_TOKEN } from './constants/di';
export type { TaxService } from './services/tax.service';

/** Elysia instance mounting every tax controller. */
export function taxModule() {
	return new Elysia({ name: 'tax' }).use(TaxController.plugin());
}
