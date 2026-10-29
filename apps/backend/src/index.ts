import 'reflect-metadata';
import { cors } from '@elysiajs/cors';
import { wrap } from '@bogeychan/elysia-logger';
import { appConfig } from '@config/providers/config';
import { registerProvider } from '@di/provider';
import { pinoLogger } from '@providers/logger/logger';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { elysiaApp } from './app/app';
import { registerLocation } from './app/location/container';
import { LocationController } from './app/location/controllers/location.controller';
import { registerSales } from './app/sales/container';
import { SalesController } from './app/sales/controllers/sales.controller';

registerProvider(container);
registerLocation(container);
registerSales(container);

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
	.listen(appConfig.app.port);

pinoLogger.info(
	`🦊 Elysia is running at ${bootstrap.server?.hostname}:${bootstrap.server?.port}`,
);
