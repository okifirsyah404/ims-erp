import { container } from 'tsyringe';
import { z } from 'zod';
import { publicApiGuard } from '@authorization/public-api-auth';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { WEB_CONTENT_SERVICE_TOKEN, WEBSITE_SERVICE_TOKEN } from '../constants/di';
import { webAssetIdParamSchema, webPageTypeSchema } from '../contracts/content.contract';
import { WebAssetNotFoundError, WebPageNotFoundError } from '../errors/commerce.errors';

const pageParamsSchema = z.object({ type: webPageTypeSchema, slug: z.string().trim().min(1).max(128) });

/**
 * Public website configuration and content (`/public/v1/site`, ERP-0071).
 * Server-to-server with the website key (`publicApi`), except the images,
 * which visitors' browsers load: they redirect to a short-lived URL. Only
 * published content is returned; `asset:<id>` references come back as
 * image URLs. Fields the ERP has not set come back missing and the website
 * keeps its own defaults.
 */
export class PublicWebsiteController {
	static plugin() {
		const service = container.resolve(WEBSITE_SERVICE_TOKEN);
		const content = container.resolve(WEB_CONTENT_SERVICE_TOKEN);
		return domainPlugin({ name: 'public-website', prefix: '/public/v1/site', tags: ['Public Website'] })
			.get(
				'/assets/:id',
				async ({ params, redirect }) => {
					const parsed = webAssetIdParamSchema.safeParse(params);
					if (!parsed.success) throw new WebAssetNotFoundError();
					return redirect(await content.assetRedirect(parsed.data.id), 302);
				},
				{ detail: { summary: 'Website image', description: 'Redirects to a short-lived URL of an uploaded image (no key; browsers load it)' } },
			)
			.use(publicApiGuard())
			.get('', async () => ok(await service.publicSite()), {
				publicApi: true,
				detail: { summary: 'Website configuration', description: 'getSite: identity, contact, social links, default SEO and active menus (`main`, `footer`)' },
			})
			.get('/pages/:type', async ({ params }) => ok(await content.listPublished(webPageTypeSchema.parse(params.type))), {
				publicApi: true,
				detail: { summary: 'Published website content', description: 'Published entries of one content type, in website order, images as URLs' },
			})
			.get(
				'/pages/:type/:slug',
				async ({ params }) => {
					const parsed = pageParamsSchema.safeParse(params);
					if (!parsed.success) throw new WebPageNotFoundError();
					return ok(await content.getPublished(parsed.data.type, parsed.data.slug));
				},
				{ publicApi: true, detail: { summary: 'Published website entry', description: 'One published entry (single pages use slug `home`); 404 otherwise' } },
			);
	}
}
