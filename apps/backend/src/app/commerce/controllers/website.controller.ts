import { container } from 'tsyringe';
import { requestBodyDoc } from '@http/openapi';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok } from '@http/response';
import { WEBSITE_SERVICE_TOKEN } from '../constants/di';
import {
	webMenuBodySchema,
	webMenuCodeParamSchema,
	webSiteBodySchema,
	websiteKeyCreateSchema,
	websiteKeyIdParamSchema,
} from '../contracts/website.contract';

/**
 * Web admin surface of the public website's identity, navigation and API
 * keys (`/website`, ERP-0071 stage 1). Content uses the website catalog
 * permissions (`catalog:read|update`: marketing, admin, owner); keys use
 * `integration:configure` (owner) — user decision 2026-11-19, no new
 * permission resource.
 */
export class WebsiteController {
	static plugin() {
		const service = container.resolve(WEBSITE_SERVICE_TOKEN);

		return domainPlugin({ name: 'website', prefix: '/website', tags: ['Website'], guards: 'erp' })
			.get('/site', async () => ok(await service.getSite()), {
				erp: { permission: ['catalog:read'] },
				detail: { summary: 'Website identity', description: 'Name, contact, social links and default SEO; `null` before the first save' },
			})
			.put('/site', async ({ body, erp }) => ok(await service.updateSite(webSiteBodySchema.parse(body), erp.session.user.id)), {
				erp: { permission: ['catalog:update'] },
				detail: { summary: 'Save website identity', description: 'Replaces the website identity, contact, social links and default SEO', ...requestBodyDoc(webSiteBodySchema) },
			})
			.get('/menus/:code', async ({ params }) => ok(await service.getMenu(webMenuCodeParamSchema.parse(params).code)), {
				erp: { permission: ['catalog:read'] },
				detail: { summary: 'Website menu', description: '`main` (header) or `footer` (child menus are the columns), with inactive entries' },
			})
			.put(
				'/menus/:code',
				async ({ params, body }) => ok(await service.replaceMenu(webMenuCodeParamSchema.parse(params).code, webMenuBodySchema.parse(body))),
				{
					erp: { permission: ['catalog:update'] },
					detail: { summary: 'Save website menu', description: 'Replaces the whole menu: its items and child menus, in array order', ...requestBodyDoc(webMenuBodySchema) },
				},
			)
			.get('/keys', async ({ erp, request }) => ok(await service.listKeys(erp.organizationId, request.headers)), {
				erp: { permission: ['integration:configure'] },
				detail: { summary: 'Website API keys', description: "The organization's keys for `/public/v1/*` (never the secret)" },
			})
			.post(
				'/keys',
				async ({ body, erp, status }) =>
					status(201, created(await service.createKey(erp.organizationId, erp.session.user.id, websiteKeyCreateSchema.parse(body).name))),
				{
					erp: { permission: ['integration:configure'] },
					detail: {
						summary: 'Create a website API key',
						description: 'The website server sends it as `Authorization: Bearer` (env `ERP_API_TOKEN`). The secret `key` is shown only in this answer.',
						...requestBodyDoc(websiteKeyCreateSchema),
					},
				},
			)
			.delete(
				'/keys/:id',
				async ({ params, erp, request }) => {
					await service.revokeKey(erp.organizationId, erp.session.user.id, websiteKeyIdParamSchema.parse(params).id, request.headers);
					return noContent();
				},
				{ erp: { permission: ['integration:configure'] }, detail: { summary: 'Revoke a website API key', description: 'Disables the key for good' } },
			);
	}
}
