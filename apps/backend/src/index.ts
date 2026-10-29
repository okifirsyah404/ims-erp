import 'reflect-metadata';
import { wrap } from '@bogeychan/elysia-logger';
import { appConfig } from '@config/providers/config';
import { registerProvider } from '@di/provider';
import { pinoLogger } from '@providers/logger/logger';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { elysiaApp } from './app/app';
import { registerLocation } from './app/location/container';
import { LocationController } from './app/location/controllers/location.controller';

registerProvider(container);
registerLocation(container);

const bootstrap = new Elysia()
	.use(wrap(pinoLogger))
	.use(elysiaApp)
	.use(LocationController.plugin())
	.listen(appConfig.app.port);

pinoLogger.info(
	`🦊 Elysia is running at ${bootstrap.server?.hostname}:${bootstrap.server?.port}`,
);
