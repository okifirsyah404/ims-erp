import type { DependencyContainer } from 'tsyringe';
import { BetterAuthWebsiteKeys } from './adapters/better-auth-website-keys';
import { WEBSITE_KEY_ISSUER_TOKEN, WEBSITE_REPOSITORY_TOKEN, WEBSITE_SERVICE_TOKEN } from './constants/di';
import { WebsiteRepository } from './repositories/website.repository';
import { WebsiteService } from './services/website.service';

export * from './constants/di';

/** Commerce module (ERP-0071 stage 1): the public website's identity, navigation and keys. */
export function registerCommerce(container: DependencyContainer): void {
	container.register(WEBSITE_REPOSITORY_TOKEN, { useClass: WebsiteRepository });
	container.register(WEBSITE_KEY_ISSUER_TOKEN, { useClass: BetterAuthWebsiteKeys });
	container.register(WEBSITE_SERVICE_TOKEN, { useClass: WebsiteService });
}
