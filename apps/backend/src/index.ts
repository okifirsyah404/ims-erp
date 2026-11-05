// Required on Bun too: tsyringe's CJS entry throws at load if `Reflect.getMetadata`
// is missing, and this project has `emitDecoratorMetadata: true`. Must stay the
// first import — before `tsyringe` itself is pulled in.
import { registerInventory } from '@app/inventory';
import { registerCrm } from '@app/crm';
import { registerFinance } from '@app/finance';
import { registerProcurement } from '@app/procurement';
import { appConfig } from '@config/providers/config';
import { registerProvider } from '@di/provider';
import { cors } from '@elysiajs/cors';
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, en, id } from '@ims-erp/locales';
import { pinoLogger } from '@providers/logger/logger';
import { requestLogger } from '@providers/logger/request-logger';
import {
	createSchedulerQueue,
	registerSweepSchedules,
} from '@providers/queue/inventory-scheduler.queue';
import { startInventorySchedulerWorker } from '@providers/queue/inventory-scheduler.worker';
import { closeQueueConnection } from '@providers/queue/queue.connection';
import { startWorkers, stopWorkers } from '@providers/queue/worker-registry';
import { Elysia } from 'elysia';
import { i18next } from 'elysia-i18next';
import { createInstance } from 'i18next';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { createApp } from './app/app';
import { registerAudit } from './app/audit';
import { registerLocation } from './app/location/container';
import { registerOrganization } from './app/organization';
import { registerSales } from './app/sales/container';
import { registerUser, startAvatarWorker } from './app/user';
import { registerAuthorization } from './authorization/container';

registerProvider(container);
registerLocation(container);
registerSales(container);
registerInventory(container);
registerCrm(container);
registerFinance(container);
registerProcurement(container);
registerUser(container);
registerOrganization(container);
registerAudit(container);
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
	.use(createApp())
	.listen(appConfig.app.port);

// Background workers: consume BullMQ queues filled by module hooks. Every
// worker is started through the shared registry, so adding a queue means one
// entry in this array — not a new handle and a new shutdown branch. Non-fatal
// at boot: a Redis outage must not take the API down.
startWorkers([startAvatarWorker()], (error) =>
	pinoLogger.error({ err: error }, 'background worker error'),
);

// Recurring sweeps (S4): late returns and guest-PII retention. `null` when
// `scheduler.enabled` is false, which is the default for tests and scripts, so
// booting with no Redis still works as before.
const inventoryScheduler = startInventorySchedulerWorker();
if (inventoryScheduler) {
	inventoryScheduler.worker.on('error', (error) => {
		pinoLogger.error({ err: error }, 'inventory scheduler error');
	});
	await registerSweepSchedules(createSchedulerQueue());
	pinoLogger.info(
		'inventory scheduler registered (late sweep + PII retention)',
	);
}

process.on('SIGTERM', async () => {
	// Workers first, then the shared connection they borrow: closing the
	// connection while a worker is still draining would abort in-flight jobs.
	for (const error of await stopWorkers()) {
		pinoLogger.error({ err: error }, 'background worker failed to close');
	}
	await closeQueueConnection();
});

pinoLogger.info(
	`🦊 Elysia is running at ${bootstrap.server?.hostname}:${bootstrap.server?.port}`,
);
