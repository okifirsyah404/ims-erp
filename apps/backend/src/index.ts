import 'reflect-metadata';
import { cors } from '@elysiajs/cors';
import { wrap } from '@bogeychan/elysia-logger';
import { appConfig } from '@config/providers/config';
import { registerProvider } from '@di/provider';
import { pinoLogger } from '@providers/logger/logger';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { elysiaApp } from './app/app';
import { startAvatarWorker } from './app/user/queues/avatar.worker';
import {
	closeQueueConnection,
} from '@providers/queue/queue.connection';
import { registerLocation } from './app/location/container';
import { LocationController } from './app/location/controllers/location.controller';
import {
	OrganizationBootstrapController,
	OrganizationController,
	registerOrganization,
} from './app/organization';
import { registerSales } from './app/sales/container';
import { SalesController } from './app/sales/controllers/sales.controller';
import { registerUser } from './app/user/container';
import { UserController } from './app/user/controllers/user.controller';
import {
	InvitationController,
	UsernameCheckController,
} from './app/user-management/controllers/invitation.controller';
import { UserAdminController } from './app/user-management/controllers/user-admin.controller';
import { registerUserManagement } from './app/user-management/container';
import { registerAuthorization } from './authorization/container';
registerProvider(container);
registerLocation(container);
registerSales(container);
registerUser(container);
registerOrganization(container);
registerUserManagement(container);
registerAuthorization(container);

const bootstrap = new Elysia()
	.use(wrap(pinoLogger))
	.use(
		cors({
			// Browser cross-origin requests from the web-admin dev server need
			// credentialed CORS; never use a wildcard alongside credentials.
			origin: appConfig.app.corsOrigins?.length
				? appConfig.app.corsOrigins
				: [appConfig.app.url ?? 'http://localhost:5173'],
			credentials: true,
			allowedHeaders: ['Content-Type', 'x-organization-id'],
			methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		}),
	)
	.use(elysiaApp)
	.use(LocationController.plugin())
	.use(SalesController.plugin())
	// Admin user-management routes mount BEFORE UserController: both register
	// `GET /users`, and with prefix-wrapped plugins the FIRST registration
	// wins. The phase-4 listing is the permission-gated one (`member:read`),
	// so it must not be shadowed by the legacy directory route.
	.use(UserAdminController.plugin())
	.use(UserController.plugin())
	.use(OrganizationController.plugin())
	// Creation mounts separately: it must accept an application admin with no
	// organization context (ADR-0007), so it cannot ride the org-scoped guard.
	.use(OrganizationBootstrapController.plugin())
	.use(InvitationController.plugin())
	.use(UsernameCheckController.plugin())
	.listen(appConfig.app.port);

// Avatar generation worker: consumes the BullMQ 'avatar' queue filled by
// Better Auth's user.create.after hook. Non-fatal at boot: a Redis outage
// must not take the API down.
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
