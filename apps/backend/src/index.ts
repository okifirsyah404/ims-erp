// Required on Bun too: tsyringe's CJS entry throws at load if `Reflect.getMetadata`
// is missing, and this project has `emitDecoratorMetadata: true`. Must stay the
// first import — before `tsyringe` itself is pulled in.
import { registerInventory } from '@app/inventory';
import { registerCustomer } from '@app/customer';
import { registerProcurement } from '@app/procurement';
import { registerLicenseDueSchedule, startLicenseDueWorker } from '@app/project';
import { registerLeadFollowUpSchedule, registerProject, startLeadFollowUpWorker } from '@app/project';
import { registerTicket } from '@app/ticket';
import { registerHumanResource } from '@app/human-resource';
import { registerQuotationFollowUpSchedule, startQuotationFollowUpWorker, startQuotationSentWorker } from '@app/sale';
import { registerSupplierBillDueSchedule, startSupplierBillDueWorker } from '@app/finance';
import { registerAutomation, startOutboxWorker, startWhatsappWorker } from '@app/automation';
import { registerFinance } from '@app/finance';
import { registerTax } from '@app/tax';
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
import { startMailWorker } from '@providers/mailer/mailer.worker';
import { startWorkers, stopWorkers } from '@providers/queue/worker-registry';
import { Elysia } from 'elysia';
import { i18next } from 'elysia-i18next';
import { createInstance } from 'i18next';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { createApp } from './app/app';
import { registerAudit } from './app/audit';
import { registerLocation } from './app/location/container';
import { registerSales } from './app/sale/container';
import { registerPayment } from './app/payment';
import { registerUser, startAvatarWorker } from './app/user';
import { registerOrganization, startOrgLogoWorker } from './app/organization';
import {
	createNotificationQueue,
	registerNotification,
	registerNotificationSchedules,
	startNotificationWorker,
} from './app/notification';
import { registerCompany } from './app/company';
import { registerSupplier } from './app/supplier';
import { registerDocument } from './app/document';
import { registerAuthorization } from './authorization/container';

registerProvider(container);
registerLocation(container);
registerSales(container);
// ADR-0023: payment owns `payment.gateway_payments`; it reads invoices and
// records receipts through sales' port, so sales must be registered first.
registerPayment(container);
// Company first, then code numbers: CodeNumberService reads the company
// document code ({COMPANY}) through COMPANY_SERVICE_TOKEN. Both are injected
// into the document services of every module.
registerCompany(container);
registerSupplier(container);
registerOrganization(container);
registerNotification(container);
registerDocument(container);
// Audit before the modules that resolve AUDIT_SERVICE_TOKEN eagerly
// (registerInventory builds the shared InventoryAuditWriter at
// registration time).
registerAudit(container);
registerInventory(container);
// Automation before the modules that publish events (project leads, …).
registerAutomation(container);
// Customer (with the portal, ADR-0024 Q28) needs the user module's exported
// service at resolve time; project (leads) needs customer and company.
registerCustomer(container);
registerProject(container);
registerTicket(container);
registerHumanResource(container);
registerProcurement(container);
registerFinance(container);
registerTax(container);
registerUser(container);
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
			// Origins come from the gitignored `cors.json` (template:
			// `cors.example.json`) with `allow`/`blacklist` lists. Without a
			// file, only the web app's own origin is allowed; an empty
			// effective allowlist (blacklist-only file) blocks every origin.
			origin: appConfig.app.corsOrigins?.length
				? appConfig.app.corsOrigins
				: appConfig.app.corsOrigins != null
					? [] // blacklist-only file: allow nothing
					: [
							appConfig.app.webUrl ??
								appConfig.app.url ??
								'http://localhost:5173',
						],
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
// Mail worker is nullable: `null` when no transport is configured
// (tests/scripts without SMTP), so booting with no mail server still works.
const mailWorker = startMailWorker();
// `startLicenseDueWorker` is `null` unless `scheduler.enabled` (M04 reminders).
const licenseDueWorker = startLicenseDueWorker();
// ERP-0066: lead and quotation follow-up reminders, same switch.
const leadFollowUpWorker = startLeadFollowUpWorker();
const quotationFollowUpWorker = startQuotationFollowUpWorker();
// ERP-0012: `supplier_bill.due` reminders, same switch.
const billDueWorker = startSupplierBillDueWorker();
startWorkers(
	[
		startAvatarWorker(),
		startOrgLogoWorker(),
		startNotificationWorker(),
		startOutboxWorker(),
		startWhatsappWorker(),
		// ERP-0067: SPH PDF + `quotation.sent` after a quotation is sent.
		startQuotationSentWorker(),
		...(mailWorker ? [mailWorker] : []),
		...(licenseDueWorker ? [licenseDueWorker] : []),
		...(leadFollowUpWorker ? [leadFollowUpWorker] : []),
		...(quotationFollowUpWorker ? [quotationFollowUpWorker] : []),
		...(billDueWorker ? [billDueWorker] : []),
	],
	(error) => pinoLogger.error({ err: error }, 'background worker error'),
);
if (licenseDueWorker) {
	await registerLicenseDueSchedule().then(
		() => pinoLogger.info('license.due reminder schedule registered'),
		(error: unknown) => pinoLogger.error({ err: error }, 'license.due schedule not registered'),
	);
}
if (leadFollowUpWorker && quotationFollowUpWorker) {
	await Promise.all([registerLeadFollowUpSchedule(), registerQuotationFollowUpSchedule()]).then(
		() => pinoLogger.info('sales follow-up schedules registered'),
		(error: unknown) => pinoLogger.error({ err: error }, 'sales follow-up schedules not registered'),
	);
}
if (billDueWorker) {
	await registerSupplierBillDueSchedule().then(
		() => pinoLogger.info('supplier_bill.due reminder schedule registered'),
		(error: unknown) => pinoLogger.error({ err: error }, 'supplier_bill.due schedule not registered'),
	);
}
if (mailWorker) {
	pinoLogger.info('mail worker started (SMTP transport)');
}

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

// Notification retention (ERP-0047): hard-deletes read rows past the window.
// Shares the `scheduler.enabled` switch with the inventory sweeps, so scripts
// and tests never open a repeatable-job connection.
if (appConfig.scheduler.enabled) {
	await registerNotificationSchedules(createNotificationQueue());
	pinoLogger.info('notification retention schedule registered');
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
