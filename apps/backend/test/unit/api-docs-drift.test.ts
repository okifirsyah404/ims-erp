/**
 * Keeps the curated API reference (`apps/api-docs/openapi/website.yaml`,
 * rendered by Zudoku) in step with the code: every `/portal/v1` and
 * `/public/v1` route the controllers mount must be documented, and every
 * documented operation must exist. Services are never called — the
 * controllers are only built to read their routes.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { WEBSITE_INQUIRY_SERVICE_TOKEN } from '../../src/app/crm/constants/di';
import { PublicWebsiteController } from '../../src/app/crm/controllers/public-website.controller';
import { PORTAL_AUTH_SERVICE_TOKEN, PORTAL_SERVICE_TOKEN } from '../../src/app/portal/constants/di';
import { PortalAuthController, PortalController } from '../../src/app/portal/controllers/portal.controller';
import { PORTAL_SESSION_RESOLVER_TOKEN } from '../../src/authorization/portal-auth';

const SPEC = new URL('../../../api-docs/openapi/website.yaml', import.meta.url);
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const DOCUMENTED_PREFIXES = ['/portal/v1/', '/public/v1/'];

type TSpec = { paths: Record<string, Partial<Record<(typeof METHODS)[number], { operationId?: string; summary?: string }>>> };

async function documentedRoutes(): Promise<string[]> {
	const spec = Bun.YAML.parse(await Bun.file(SPEC).text()) as TSpec;
	return Object.entries(spec.paths).flatMap(([path, item]) =>
		METHODS.filter((method) => item[method]).map((method) => `${method.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}`),
	);
}

function mountedRoutes(): string[] {
	for (const token of [PORTAL_AUTH_SERVICE_TOKEN, PORTAL_SERVICE_TOKEN, PORTAL_SESSION_RESOLVER_TOKEN, WEBSITE_INQUIRY_SERVICE_TOKEN]) {
		container.register(token as never, { useValue: {} });
	}
	const app = new Elysia().use(PortalAuthController.plugin()).use(PortalController.plugin()).use(PublicWebsiteController.plugin());
	return app.routes
		.map((route) => `${route.method} ${route.path}`)
		.filter((route) => DOCUMENTED_PREFIXES.some((prefix) => route.split(' ')[1]!.startsWith(prefix)));
}

describe('API reference (Zudoku) matches the routes', () => {
	test('every mounted portal and public-website route is documented, and nothing else', async () => {
		const documented = (await documentedRoutes()).sort();
		const mounted = [...new Set(mountedRoutes())].sort();
		expect(documented).toEqual(mounted);
	});

	test('every documented operation has an operationId and a summary', async () => {
		const spec = Bun.YAML.parse(await Bun.file(SPEC).text()) as TSpec;
		const missing = Object.entries(spec.paths).flatMap(([path, item]) =>
			METHODS.filter((method) => item[method] && (!item[method]!.operationId || !item[method]!.summary)).map((method) => `${method} ${path}`),
		);
		expect(missing).toEqual([]);
	});
});
