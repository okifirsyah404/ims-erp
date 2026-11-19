import type { InjectionToken } from 'tsyringe';
import type { IWebsiteKeyIssuer, IWebsiteRepository } from '../contracts/website.contract';
import type { IWebContentRepository } from '../contracts/content.contract';
import type { WebContentService } from '../services/web-content.service';
import type { IAccountShopRepository } from '../contracts/account-shop.contract';
import type { AccountShopService } from '../services/account-shop.service';
import type { WebsiteService } from '../services/website.service';

export const WEBSITE_REPOSITORY_TOKEN: InjectionToken<IWebsiteRepository> = Symbol('WEBSITE_REPOSITORY_TOKEN');

export const WEBSITE_KEY_ISSUER_TOKEN: InjectionToken<IWebsiteKeyIssuer> = Symbol('WEBSITE_KEY_ISSUER_TOKEN');

/** Website identity, navigation and keys (ERP-0071). */
export const WEBSITE_SERVICE_TOKEN: InjectionToken<WebsiteService> = Symbol('WEBSITE_SERVICE_TOKEN');

export const WEB_CONTENT_REPOSITORY_TOKEN: InjectionToken<IWebContentRepository> = Symbol('WEB_CONTENT_REPOSITORY_TOKEN');

/** Website pages, collection entries and images (ERP-0071 stages 2-4). */
export const WEB_CONTENT_SERVICE_TOKEN: InjectionToken<WebContentService> = Symbol('WEB_CONTENT_SERVICE_TOKEN');

export const ACCOUNT_SHOP_REPOSITORY_TOKEN: InjectionToken<IAccountShopRepository> = Symbol('ACCOUNT_SHOP_REPOSITORY_TOKEN');

/** The website's account cart and wishlist (ERP-0074); the portal module calls it with the guard's customer id. */
export const ACCOUNT_SHOP_SERVICE_TOKEN: InjectionToken<AccountShopService> = Symbol('ACCOUNT_SHOP_SERVICE_TOKEN');
