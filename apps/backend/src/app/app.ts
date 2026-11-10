import openapi from '@elysia/openapi';
import { auth } from '@providers/better-auth/auth';
import { OpenAPI } from '@providers/better-auth/open-api-extractor.auth';
import Elysia from 'elysia';

import { accountingModule } from './accounting';
import { aftersalesModule } from './aftersales';
import { assetsModule } from './assets';
import { auditModule } from './audit';
import { crmModule } from './crm';
import { inventoryModule } from './inventory';
import { licensingModule } from './licensing';
import { locationModule } from './location';
import { organizationModule } from './organization';
import { procurementModule } from './procurement';
import { projectsModule } from './projects';
import { salesModule } from './sales';
import { userModule } from './user';

/**
 * Better Auth's aggregated OpenAPI document, extracted once at module load.
 *
 * @remarks
 * Hoisted out of {@link createApp} so the factory stays synchronous while the
 * schema remains a static snapshot rather than recomputed per call. Only the
 * aggregated schema is awaited here — no container access — so this is safe to
 * evaluate at import time, before `registerProvider` runs.
 */
const betterAuthOpenApiDocument = {
	components: await OpenAPI.components,
	paths: await OpenAPI.getPaths(),
};

/**
 * Builds the root Elysia application with every module mounted.
 *
 * @remarks
 * A factory, not a module-level instance: controllers resolve their services
 * via `container.resolve` inside `plugin()`, so the graph must be registered
 * *before* this runs. Building eagerly at import time would make correctness
 * depend on the import order between this module and `src/index.ts` — static
 * imports are hoisted, so a formatter or refactor could silently mount
 * controllers against an unregistered container.
 *
 * Each feature module owns its own entry point (`<module>/<module>Module()`)
 * which mounts all of its controllers in a single Elysia instance; this file
 * only composes the modules and never lists individual controllers. Cross-
 * module mount-order concerns are documented at each `.use()` below.
 *
 * Two concerns are wired here before any feature module is mounted:
 * the Better Auth handler is mounted raw so its own routes keep Better Auth's
 * exact request/response shape, and `@elysia/openapi` publishes the aggregated
 * Better Auth schema at `/docs`. The schema is extracted once at module load
 * (see `betterAuthOpenApiDocument`) so the OpenAPI document is a static
 * snapshot rather than recomputed per request.
 *
 * Request-scoped concerns that must wrap every route (i18n, logging, CORS) live
 * in `src/index.ts` and are applied before this app is mounted.
 *
 * @returns The root application, ready for `.listen()`
 */
export function createApp() {
	return (
		new Elysia()
			.mount(auth.handler)
			.use(
				openapi({
					path: '/docs',
					documentation: betterAuthOpenApiDocument,
				}),
			)
			.use(locationModule())
			.use(salesModule())
			.use(procurementModule())
			.use(projectsModule())
			.use(aftersalesModule())
			.use(licensingModule())
			// Admin surfaces share the `/admin` prefix, so their routes no longer
			// overlap the self-service `/users/*` routes: mount order is irrelevant
			// here (before the split, both modules registered `GET /users` and the
			// first registration silently won).
			.use(userModule())
			// Cross-cutting audit read surface (`GET /admin/audit`), mounted with
			// the `/admin` surfaces it shares a prefix with.
			.use(auditModule())
			.use(organizationModule())
			.use(crmModule())
			.use(inventoryModule())
			// Assets owns equipment and borrowing (ERP-0036); `/borrowings`
			// moved here from inventory.
			.use(assetsModule())
			.use(accountingModule())
	);
}
