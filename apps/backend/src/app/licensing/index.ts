/**
 * Public entry point of the licensing module.
 *
 * @remarks
 * Exports the module's HTTP surface as a single Elysia factory
 * (`licensingModule()`) plus the composition-root registration, so
 * `src/app/app.ts` only mounts `.use(licensingModule())` and never lists
 * the module's controllers individually. Mirrors every other module
 * entry point.
 */
import Elysia from 'elysia';

import { LicenseApiController } from './controllers/license-api.controller';
import { LicensingController } from './controllers/licensing.controller';

export { registerLicensing } from './container';

/** Elysia instance mounting every licensing controller, in route order. */
export function licensingModule() {
	return new Elysia({ name: 'licensing' })
		.use(LicensingController.plugin())
		.use(LicenseApiController.plugin());
}

export { registerLicenseDueSchedule } from './queues/license-due.queue';
export { startLicenseDueWorker } from './queues/license-due.worker';
