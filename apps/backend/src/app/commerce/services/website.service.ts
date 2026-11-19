import type { TWebSiteSelect } from '@drizzle/schemas/commerce.schema';
import { inject, injectable } from 'tsyringe';
import { WEBSITE_KEY_ISSUER_TOKEN, WEBSITE_REPOSITORY_TOKEN } from '../constants/di';
import {
	type IWebsiteKeyIssuer,
	type IWebsiteRepository,
	type TWebMenuBody,
	type TWebMenuCode,
	type TWebMenuView,
	type TWebSiteBody,
	type TWebsiteKeyView,
	WEB_MENU_CODES,
} from '../contracts/website.contract';
import { WebsiteKeyNotFoundError } from '../errors/commerce.errors';

/** The public website's site row. */
const SITE_KEY = 'default';

/** The site as the web admin and the website read it (no ids or audit columns). */
export type TWebSiteView = Omit<TWebSiteSelect, 'id' | 'siteKey' | 'updatedByUserId' | 'createdAt' | 'deletedAt'>;

/** What the website reads in one call: identity, contact, socials, SEO and active menus. */
export type TPublicSite = { site: TWebSiteView | null; menus: Partial<Record<TWebMenuCode, TWebMenuView>> };

function siteView(row: TWebSiteSelect): TWebSiteView {
	const { id: _id, siteKey: _key, updatedByUserId: _by, createdAt: _created, deletedAt: _deleted, ...view } = row;
	return view;
}

/**
 * Identity, navigation and API keys of the public website (ERP-0071 stage 1).
 *
 * @remarks
 * Company-wide (ADR-0012): one site row and one tree per menu code. The web
 * admin replaces a whole menu at once; the website reads everything in one
 * call (`publicSite`) and only sees active children and items. Keys are the
 * website's server-to-server credentials for `/public/v1/*`, owned by the
 * issuing organization.
 */
@injectable()
export class WebsiteService {
	constructor(
		@inject(WEBSITE_REPOSITORY_TOKEN) private readonly repository: IWebsiteRepository,
		@inject(WEBSITE_KEY_ISSUER_TOKEN) private readonly keys: IWebsiteKeyIssuer,
	) {}

	async getSite(): Promise<TWebSiteView | null> {
		const row = await this.repository.findSite(SITE_KEY);
		return row ? siteView(row) : null;
	}

	async updateSite(body: TWebSiteBody, actorUserId: string): Promise<TWebSiteView> {
		return siteView(await this.repository.upsertSite(SITE_KEY, { ...body, updatedByUserId: actorUserId }));
	}

	/** A menu with every item and child (active or not), for editing; empty when never saved. */
	async getMenu(code: TWebMenuCode): Promise<TWebMenuView> {
		const tree = await this.repository.findMenuTree(code);
		if (!tree) return { code, name: '', items: [], children: [] };
		const itemsOf = (menuId: string) =>
			tree.items.filter((item) => item.webMenuId === menuId).map((item) => ({ label: item.label, url: item.url ?? '', isActive: item.isActive }));
		return {
			code,
			name: tree.root.name,
			items: itemsOf(tree.root.id),
			children: tree.children.map((child) => ({ name: child.name, isActive: child.isActive, items: itemsOf(child.id) })),
		};
	}

	async replaceMenu(code: TWebMenuCode, body: TWebMenuBody): Promise<TWebMenuView> {
		await this.repository.replaceMenuTree({ root: { code, name: body.name }, items: body.items, children: body.children });
		return this.getMenu(code);
	}

	/** Everything the website shows, active entries only. */
	async publicSite(): Promise<TPublicSite> {
		const [site, ...menus] = await Promise.all([this.getSite(), ...WEB_MENU_CODES.map((code) => this.getMenu(code))]);
		const active = (items: TWebMenuView['items']) => items.filter((item) => item.isActive);
		const published: TPublicSite['menus'] = {};
		for (const menu of menus) {
			if (!menu.name && menu.items.length === 0 && menu.children.length === 0) continue;
			published[menu.code as TWebMenuCode] = {
				...menu,
				items: active(menu.items),
				children: menu.children.filter((child) => child.isActive).map((child) => ({ ...child, items: active(child.items) })),
			};
		}
		return { site, menus: published };
	}

	listKeys(organizationId: string, headers: Headers): Promise<TWebsiteKeyView[]> {
		return this.keys.list({ organizationId, headers });
	}

	/** A new website key; its secret is returned this once. */
	createKey(organizationId: string, actorUserId: string, name: string) {
		return this.keys.issue({ organizationId, issuerUserId: actorUserId, name });
	}

	/** Disables one of the organization's website keys for good. @throws {WebsiteKeyNotFoundError} */
	async revokeKey(organizationId: string, actorUserId: string, apiKeyId: string, headers: Headers): Promise<void> {
		const known = await this.keys.list({ organizationId, headers });
		if (!known.some((key) => key.id === apiKeyId)) throw new WebsiteKeyNotFoundError();
		await this.keys.disable({ apiKeyId, actorUserId });
	}
}
