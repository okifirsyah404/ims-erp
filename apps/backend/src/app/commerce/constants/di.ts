import type { InjectionToken } from 'tsyringe';
import type { IWebsiteKeyIssuer, IWebsiteRepository } from '../contracts/website.contract';
import type { WebsiteService } from '../services/website.service';

export const WEBSITE_REPOSITORY_TOKEN: InjectionToken<IWebsiteRepository> = Symbol('WEBSITE_REPOSITORY_TOKEN');

export const WEBSITE_KEY_ISSUER_TOKEN: InjectionToken<IWebsiteKeyIssuer> = Symbol('WEBSITE_KEY_ISSUER_TOKEN');

/** Website identity, navigation and keys (ERP-0071). */
export const WEBSITE_SERVICE_TOKEN: InjectionToken<WebsiteService> = Symbol('WEBSITE_SERVICE_TOKEN');
