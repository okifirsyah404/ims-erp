// Required on Bun too: tsyringe's CJS entry throws at load if `Reflect.getMetadata`
// is missing, and this project has `emitDecoratorMetadata: true`. Must stay the
// first import — before `tsyringe` itself is pulled in.
import 'reflect-metadata';
import { cors } from '@elysiajs/cors';
import { wrap } from '@bogeychan/elysia-logger';
import { appConfig } from '@config/providers/config';
import { registerProvider } from '@di/provider';
import { pinoLogger } from '@providers/logger/logger';
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, en, id } from '@ims-erp/locales';
import { Elysia } from 'elysia';
import { i18next } from 'elysia-i18next';
import { createInstance } from 'i18next';
import { container } from 'tsyringe';
import { createApp } from './app/app';
import { startAvatarWorker } from './app/user/queues/avatar.worker';
import {
	closeQueueConnection,
} from '@providers/queue/queue.connection';
import { registerLocation } from './app/location/container';
import { registerAudit } from './app/audit';
import { registerOrganization } from './app/organization';
import { registerSales } from './app/sales/container';
import { registerUser } from './app/user/container';
import { registerUserManagement } from './app/user-management/container';
import { registerAuthorization } from './authorization/container';
registerProvider(container);
registerLocation(container);
registerSales(container);
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
/**
 * Root Elysia application. The i18n plugin is mounted first so every controller
 * and guard inherited from `createApp()` below receives request-scoped `t`.
 *
 * @remarks
 * Split of responsibilities: this file registers the DI graph (`register*`
 * calls above) and applies cross-cutting plugins; `app/app.ts` mounts the
 * controllers. The `createApp()` call happens here, after registration, so the
 * controllers' `container.resolve` calls run against a populated container.
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
	.use(wrap(pinoLogger))
	.use(
		cors({
			// Browser cross-origin requests from the web-admin dev server need
			// credentialed CORS; never use a wildcard alongside credentials.
			origin: appConfig.app.corsOrigins?.length
				? appConfig.app.corsOrigins
				: [appConfig.app.url ?? 'http://localhost:5173'],
			credentials: true,
			allowedHeaders: [
				'Content-Type',
				'x-organization-id',
				'Accept-Language',
			],
			methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		}),
	)
	.use(createApp())
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
