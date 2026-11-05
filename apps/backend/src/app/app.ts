import openapi from '@elysia/openapi';
import { auth } from '@providers/better-auth/auth';
import { OpenAPI } from '@providers/better-auth/open-api-extractor.auth';
import Elysia from 'elysia';
import { LocationController } from './location/controllers/location.controller';
import {
	AdjustmentController,
	BorrowingController,
	ItemCategoryController,
	ItemController,
	StockController,
	WarehouseController,
} from './inventory';
import { QuotationController } from './sales/controllers/quotation.controller';
import { SalesController } from './sales/controllers/sales.controller';
import {
	InvitationClaimController,
	InvitationController,
	UsernameCheckController,
	UserAdminController,
} from './user';
import { UserController } from './user/controllers/user.controller';
import { AuditController } from './audit';
import { CustomerController, LeadController, PublicWebsiteController } from './crm';
import {
	CompanyProfileController,
	NumberingController,
	OrganizationBootstrapController,
	OrganizationController,
} from './organization';

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
 * Builds the root Elysia application with every controller mounted.
 *
 * @remarks
 * A factory, not a module-level instance: controllers resolve their services
 * via `container.resolve` inside `plugin()`, so the graph must be registered
 * *before* this runs. Building eagerly at import time would make correctness
 * depend on the import order between this module and `src/index.ts` — static
 * imports are hoisted, so a formatter or refactor could silently mount
 * controllers against an unregistered container.
 *
 * Two concerns are wired here before any feature controller is mounted:
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
			.use(LocationController.plugin())
			.use(QuotationController.plugin())
			.use(SalesController.plugin())
			// Admin surfaces share the `/admin` prefix, so their routes no longer
			// overlap the self-service `/users/*` routes: mount order is irrelevant
			// here (before the split, both modules registered `GET /users` and the
			// first registration silently won).
			.use(UserAdminController.plugin())
			.use(UserController.plugin())
			// Cross-cutting audit read surface (`GET /admin/audit`), mounted with the
			// other `/admin` plugins it shares a prefix with.
			.use(AuditController.plugin())
			.use(OrganizationController.plugin())
			// Creation mounts separately: it must accept an application admin with no
			// organization context (ADR-0007), so it cannot ride the org-scoped guard.
			.use(OrganizationBootstrapController.plugin())
			.use(CompanyProfileController.plugin())
			.use(NumberingController.plugin())
			.use(InvitationController.plugin())
			// Public, sessionless claim flow: token-gated, deliberately outside
			// `/admin`, so it must not inherit the admin guard. Mounted after the
			// admin plugins only for readability; the paths never overlap.
			.use(InvitationClaimController.plugin())
			.use(UsernameCheckController.plugin())
			// Inventory (items, warehouses, stock, borrowing) rides `erp`- or
			// `session`-guarded prefixes; mount order is irrelevant as none of its
			// paths overlap the modules above.
			.use(ItemController.plugin())
			.use(ItemCategoryController.plugin())
			.use(CustomerController.plugin())
			.use(LeadController.plugin())
			// Server-to-server website API: API-key guard, no session.
			.use(PublicWebsiteController.plugin())
			.use(WarehouseController.plugin())
			.use(StockController.plugin())
			.use(AdjustmentController.plugin())
			.use(BorrowingController.plugin())
	);
}
