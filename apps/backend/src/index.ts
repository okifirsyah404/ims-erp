import { appConfig } from '@config/providers/config';
import { registerProvider } from '@di/provider';
import { cors } from '@elysiajs/cors';
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, en, id } from '@ims-erp/locales';
import { pinoLogger } from '@providers/logger/logger';
import { requestLogger } from '@providers/logger/request-logger';
import { closeQueueConnection } from '@providers/queue/queue.connection';
import { Elysia } from 'elysia';
import { i18next } from 'elysia-i18next';
import { createInstance } from 'i18next';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { elysiaApp } from './app/app';
import { AuditController, registerAudit } from './app/audit';
import { ItemController, registerInventory } from './app/inventory';
import { registerLocation } from './app/location/container';
import { LocationController } from './app/location/controllers/location.controller';
import {
	OrganizationBootstrapController,
	OrganizationController,
	registerOrganization,
} from './app/organization';
import { registerSales } from './app/sales/container';
import { SalesController } from './app/sales/controllers/sales.controller';
import { registerUserManagement } from './app/user-management/container';
import {
	InvitationClaimController,
	InvitationController,
	UsernameCheckController,
} from './app/user-management/controllers/invitation.controller';
import { UserAdminController } from './app/user-management/controllers/user-admin.controller';
import { registerUser } from './app/user/container';
import { UserController } from './app/user/controllers/user.controller';
import { startAvatarWorker } from './app/user/queues/avatar.worker';
import { registerAuthorization } from './authorization/container';
registerProvider(container);
registerLocation(container);
registerSales(container);
registerInventory(container);
registerUser(container);
registerOrganization(container);
// Before user-management: its services inject AUDIT_SERVICE_TOKEN. tsyringe
// resolves lazily so the order is not load-bearing, but reading the graph
// top-down is easier when the ledger is registered before its writers.
registerAudit(container);
registerUserManagement(container);
registerAuthorization(container);

/**
 * Dedicated i18next instance for API messages.
 *
 * @remarks
 * An explicit instance, not the module singleton: `bun:test` files and any
 * additional Elysia app in the same process would otherwise share and mutate
 * the same instance. `fallbackLng` + `supportedLngs` make an unsupported
 * `Accept-Language` fall back to English instead of activating a language that
 * has no resources.
 */
const apiI18n = createInstance();

/**
 * Root Elysia application instance. The i18n plugin is mounted first so every
 * controller and guard below inherits request-scoped `t`.
 */
const bootstrap = new Elysia()
	// `elysia-i18next@4` ships declarations generated against a different
	// Elysia version; using it directly collapses every route handler's
	// context to `any`. This cast restores Elysia's own inference. The cost is
	// that `t` is untyped in handlers — key correctness is still guarded by
	// the locale parity test and the dead-key scan.
	.use(
		i18next({
			instance: apiI18n,
			initOptions: {
				fallbackLng: DEFAULT_LANGUAGE,
				supportedLngs: [...LANGUAGE_CODES],
				keySeparator: false,
				nsSeparator: ':',
				interpolation: { escapeValue: false },
				resources: { en, id } as never,
			},
		}) as unknown as (app: Elysia) => Elysia,
	)
	.use(requestLogger)
	.use(
		cors({
			// Browser cross-origin requests from the web-admin dev server need
			// credentialed CORS; never use a wildcard alongside credentials.
			origin: appConfig.app.corsOrigins?.length
				? appConfig.app.corsOrigins
				: [appConfig.app.url ?? 'http://localhost:5173'],
			credentials: true,
			allowedHeaders: ['Content-Type', 'x-organization-id', 'Accept-Language'],
			methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		}),
	)
	.use(elysiaApp)
	.use(LocationController.plugin())
	.use(SalesController.plugin())
	.use(ItemController.plugin())
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
	.use(InvitationController.plugin())
	// Public, sessionless claim flow: token-gated, deliberately outside
	// `/admin`, so it must not inherit the admin guard. Mounted after the
	// admin plugins only for readability; the paths never overlap.
	.use(InvitationClaimController.plugin())
	.use(UsernameCheckController.plugin())
	.listen(appConfig.app.port);

// Avatar generation worker: consumes the BullMQ 'avatar' queue filled by
// Better Auth's user.create.after hook, rendering each PNG through the DiceBear
// HTTP API. Non-fatal at boot: a Redis outage must not take the API down.
const avatarWorker = startAvatarWorker();
avatarWorker.on('error', (error) => {
	pinoLogger.error({ err: error }, 'avatar worker error');
});

process.on('SIGTERM', async () => {
	await avatarWorker.close();
	await closeQueueConnection();
});

pinoLogger.info(
	`🦊 Elysia is running at ${bootstrap.server?.hostname}:${bootstrap.server?.port}`,
);
