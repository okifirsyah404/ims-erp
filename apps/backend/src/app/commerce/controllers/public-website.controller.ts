import { container } from 'tsyringe';
import { publicApiGuard } from '@authorization/public-api-auth';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { WEBSITE_SERVICE_TOKEN } from '../constants/di';

/**
 * Public website configuration (`/public/v1/site`, ERP-0071 stage 1):
 * identity, contact, social links, default SEO and the active menus, in one
 * call. Server-to-server with the website key (`publicApi`). Fields the ERP
 * has not set come back `null` and the website keeps its own defaults.
 */
export class PublicWebsiteController {
	static plugin() {
		const service = container.resolve(WEBSITE_SERVICE_TOKEN);
		return domainPlugin({ name: 'public-website', prefix: '/public/v1', tags: ['Public Website'] })
			.use(publicApiGuard())
			.get('/site', async () => ok(await service.publicSite()), {
				publicApi: true,
				detail: { summary: 'Website configuration', description: 'getSite: identity, contact, social links, default SEO and active menus (`main`, `footer`)' },
			});
	}
}
