import { container } from 'tsyringe';
import { requestBodyDoc } from '@http/openapi';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok } from '@http/response';
import { WEB_CONTENT_SERVICE_TOKEN } from '../constants/di';
import {
	webAssetIdParamSchema,
	webPageBodySchema,
	webPageIdParamSchema,
	webPageListQuerySchema,
	webPageStatusSchema,
	WEBSITE_IMAGE_MAX_MB,
} from '../contracts/content.contract';

/**
 * Web admin surface of the website content (`/website/pages`,
 * `/website/assets`, ERP-0071 stages 2-4). Uses the website catalog
 * permissions: read, create/update, publish, archive (marketing, admin,
 * owner).
 */
export class WebContentController {
	static plugin() {
		const service = container.resolve(WEB_CONTENT_SERVICE_TOKEN);
		const pageId = (params: unknown) => webPageIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'website-content', prefix: '/website', tags: ['Website'], guards: 'erp' })
			.get('/pages', async ({ query }) => ok(await service.list(webPageListQuerySchema.parse(query).type)), {
				erp: { permission: ['catalog:read'] },
				detail: { summary: 'List website content', description: 'Every entry of one content type (`?type=home|solution|project|…`), drafts included, in website order' },
			})
			.get('/pages/:id', async ({ params }) => ok(await service.get(pageId(params))), {
				erp: { permission: ['catalog:read'] },
				detail: { summary: 'Website content entry', description: 'One entry with its structured content and version' },
			})
			.post(
				'/pages',
				async ({ body, erp, status }) => status(201, created(await service.create(webPageBodySchema.parse(body), erp.session.user.id))),
				{
					erp: { permission: ['catalog:create'] },
					detail: {
						summary: 'Create website content',
						description: 'A new draft; `content` is validated against its type (single pages use slug `home`); 409 when the slug is taken',
						...requestBodyDoc(webPageBodySchema),
					},
				},
			)
			.put(
				'/pages/:id',
				async ({ params, body, erp }) => ok(await service.update(pageId(params), webPageBodySchema.parse(body), erp.session.user.id)),
				{
					erp: { permission: ['catalog:update'] },
					detail: {
						summary: 'Save website content',
						description: 'Saves the entry; send the loaded `version` — 409 when someone saved it in between',
						...requestBodyDoc(webPageBodySchema),
					},
				},
			)
			.post(
				'/pages/:id/status',
				async ({ params, body, erp }) => ok(await service.setStatus(pageId(params), webPageStatusSchema.parse(body).status, erp.session.user.id)),
				{
					erp: { permission: ['catalog:publish'] },
					detail: { summary: 'Publish or hide website content', description: '`published` shows it on the website; `draft` / `archived` hide it', ...requestBodyDoc(webPageStatusSchema) },
				},
			)
			.delete(
				'/pages/:id',
				async ({ params }) => {
					await service.remove(pageId(params));
					return noContent();
				},
				{ erp: { permission: ['catalog:archive'] }, detail: { summary: 'Remove website content', description: 'Soft-deletes the entry' } },
			)
			.get('/assets', async () => ok(await service.listAssets()), {
				erp: { permission: ['catalog:read'] },
				detail: { summary: 'Website images', description: 'Uploaded images, newest first, with a short-lived preview URL and the `asset:<id>` reference to put in content' },
			})
			.post(
				'/assets',
				async ({ body, erp, status }) => {
					const form = (body ?? {}) as { file?: unknown; altText?: unknown };
					const altText = typeof form.altText === 'string' && form.altText.trim() ? form.altText.trim().slice(0, 300) : null;
					return status(201, created(await service.upload(form.file, altText, erp.session.user.id)));
				},
				{
					erp: { permission: ['catalog:update'] },
					detail: {
						summary: 'Upload a website image',
						description: `Multipart \`file\` (PNG, JPG, WebP, HEIC… up to ${WEBSITE_IMAGE_MAX_MB} MB) and optional \`altText\`; stored as WebP (longest side 1920 px)`,
						requestBody: {
							required: true,
							content: {
								'multipart/form-data': {
									schema: { type: 'object' as const, properties: { file: { type: 'string' as const, format: 'binary' }, altText: { type: 'string' as const } }, required: ['file'] },
								},
							},
						},
					},
				},
			)
			.delete(
				'/assets/:id',
				async ({ params }) => {
					await service.removeAsset(webAssetIdParamSchema.parse(params).id);
					return noContent();
				},
				{ erp: { permission: ['catalog:archive'] }, detail: { summary: 'Remove a website image', description: 'Soft-deletes the image record (content still pointing at it keeps the old URL until edited)' } },
			);
	}
}
