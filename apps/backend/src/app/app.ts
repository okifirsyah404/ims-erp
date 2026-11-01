import openapi from '@elysia/openapi';
import { auth } from '@providers/better-auth/auth';
import { OpenAPI } from '@providers/better-auth/open-api-extractor.auth';
import Elysia from 'elysia';

/**
 * Root Elysia application instance.
 *
 * @remarks
 * Two concerns are wired here before any feature controller is mounted:
 * the Better Auth handler is mounted raw so its own routes keep Better
 * Auth's exact request/response shape, and `@elysia/openapi` publishes the
 * aggregated Better Auth schema at `/docs`. The schema is extracted once at
 * module load (`await` at top level) so the OpenAPI document is a static
 * snapshot rather than recomputed per request.
 */
export const elysiaApp = new Elysia().mount(auth.handler).use(
	openapi({
		path: '/docs',
		documentation: {
			components: await OpenAPI.components,
			paths: await OpenAPI.getPaths(),
		},
	}),
);
