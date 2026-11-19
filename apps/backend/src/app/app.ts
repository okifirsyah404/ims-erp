import openapi from '@elysia/openapi';
import { auth } from '@providers/better-auth/auth';
import { OpenAPI } from '@providers/better-auth/open-api-extractor.auth';
import { realtimeGateway } from '@providers/realtime/realtime.gateway';
import Elysia from 'elysia';

import { accountingModule } from './accounting';
import { aftersalesModule } from './aftersales';
import { auditModule } from './audit';
import { automationModule } from './automation';
import { codeNumberModule } from './code-number';
import { companyModule } from './company';
import { supplierModule } from './supplier';
import { customerModule } from './customer';
import { documentModule } from './document';
import { hrModule } from './hr';
import { inventoryModule } from './inventory';
import { licensingModule } from './licensing';
import { locationModule } from './location';
import { notificationModule } from './notification';
import { organizationModule } from './organization';
import { paymentModule } from './payment';
import { procurementModule } from './procurement';
import { projectModule } from './project';
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
			// The single realtime socket (`/ws`). Mounted before the feature
			// modules so no module can shadow the upgrade path; the hub it
			// publishes into is registered by `registerProvider`.
			.use(realtimeGateway())
			.use(locationModule())
			.use(salesModule())
			// Online invoice checkout (ERP-0020). Owns `payment.*`; invoices and
			// receipts stay Sales' (ADR-0023).
			.use(paymentModule())
			.use(procurementModule())
			.use(projectsModule())
			.use(aftersalesModule())
			.use(licensingModule())
			.use(automationModule())
			// Admin surfaces share the `/admin` prefix, so their routes no longer
			// overlap the self-service `/users/*` routes: mount order is irrelevant
			// here (before the split, both modules registered `GET /users` and the
			// first registration silently won).
			.use(userModule())
			// Cross-cutting audit read surface (`GET /admin/audit`), mounted with
			// the `/admin` surfaces it shares a prefix with.
			.use(auditModule())
			// The caller's own inbox (`/notifications`). App-scope: session guard
			// only, so it does not sit under `/admin` and needs no organization
			// context.
			.use(notificationModule())
			.use(organizationModule())
			.use(companyModule())
			.use(supplierModule())
			.use(codeNumberModule())
			.use(documentModule())
			// Customer master and the customer portal (ADR-0024 Q28: `/customers/portal/v1`,
			// bearer sessions, own guard).
			.use(customerModule())
			// Leads and the website inquiry API (ADR-0024 Q12).
			.use(projectModule())
			.use(inventoryModule())
			.use(accountingModule())
			.use(hrModule())
	);
}
