import openapi from '@elysia/openapi';
import { auth } from '@providers/better-auth/auth';
import { OpenAPI } from '@providers/better-auth/open-api-extractor.auth';
import Elysia from 'elysia';

export const elysiaApp = new Elysia().mount(auth.handler).use(
	openapi({
		path: '/docs',
		documentation: {
			components: await OpenAPI.components,
			paths: await OpenAPI.getPaths(),
		},
	}),
);
