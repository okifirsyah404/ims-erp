import type { DependencyContainer } from 'tsyringe';
import { BetterAuthWebsiteKeys } from './adapters/better-auth-website-keys';
import {
	WEB_CONTENT_REPOSITORY_TOKEN,
	WEB_CONTENT_SERVICE_TOKEN,
	WEBSITE_KEY_ISSUER_TOKEN,
	WEBSITE_REPOSITORY_TOKEN,
	WEBSITE_SERVICE_TOKEN,
} from './constants/di';
import { WebContentRepository } from './repositories/web-content.repository';
import { WebContentService } from './services/web-content.service';
import { WebsiteRepository } from './repositories/website.repository';
import { WebsiteService } from './services/website.service';

export * from './constants/di';

/** Commerce module (ERP-0071): the public website's identity, navigation, keys, content and images. */
export function registerCommerce(container: DependencyContainer): void {
	container.register(WEBSITE_REPOSITORY_TOKEN, { useClass: WebsiteRepository });
	container.register(WEBSITE_KEY_ISSUER_TOKEN, { useClass: BetterAuthWebsiteKeys });
	container.register(WEBSITE_SERVICE_TOKEN, { useClass: WebsiteService });
	// Stages 2-4: website pages, collection entries and uploaded images.
	container.register(WEB_CONTENT_REPOSITORY_TOKEN, { useClass: WebContentRepository });
	container.register(WEB_CONTENT_SERVICE_TOKEN, { useClass: WebContentService });
}
