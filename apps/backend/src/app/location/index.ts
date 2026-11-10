/**
 * Public entry point of the location module.
 *
 * @remarks
 * Exports the module's HTTP surface as a single Elysia factory
 * (`locationModule()`) plus the composition-root registration, so
 * `src/app/app.ts` only mounts `.use(locationModule())` and never lists
 * the module's controllers individually. Mirrors every other module
 * entry point.
 */
import Elysia from 'elysia';

import { LocationController } from './controllers/location.controller';

export { registerLocation } from './container';

/** Elysia instance mounting every location controller, in route order. */
export function locationModule() {
	return new Elysia({ name: 'location' }).use(LocationController.plugin());
}
