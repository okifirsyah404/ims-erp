/**
 * Public entry point of the commerce module (ERP-0071): the public website's
 * configuration. Owns the `commerce` Postgres schema.
 */
import Elysia from 'elysia';
import { PublicWebsiteController } from './controllers/public-website.controller';
import { WebsiteController } from './controllers/website.controller';

export { registerCommerce } from './container';

/** Mounts `/website/*` (web admin, `erp` guard) and `/public/v1/site` (website key). */
export function commerceModule() {
	return new Elysia({ name: 'commerce' }).use(WebsiteController.plugin()).use(PublicWebsiteController.plugin());
}
