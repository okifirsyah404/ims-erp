/**
 * Website identity and navigation configured in the ERP (ERP-0071 stage 1).
 *
 * Covers: input validation (only site paths and https links, never
 * `javascript:` or `//host`; each social network once), the public read
 * (inactive menus and items hidden, unsaved menus omitted, `null` site before
 * the first save), whole-menu replacement, and website keys (revoking an
 * unknown or another organization's key is 404).
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TWebMenuItemSelect, TWebMenuSelect, TWebSiteSelect } from '@drizzle/schemas/commerce.schema';
import {
	type IWebsiteKeyIssuer,
	type IWebsiteRepository,
	type TMenuTreeWrite,
	webMenuBodySchema,
	webSiteBodySchema,
	webUrlSchema,
} from '../../src/app/commerce/contracts/website.contract';
import { WebsiteKeyNotFoundError } from '../../src/app/commerce/errors/commerce.errors';
import { WebsiteService } from '../../src/app/commerce/services/website.service';

describe('website input validation', () => {
	test('menu links are site paths or https / mailto / tel links', () => {
		for (const ok of ['/', '/products?category=flap-barrier-gate', 'https://wa.me/628111900288', 'mailto:sales@entragate.co.id', 'tel:+622188992020']) {
			expect(webUrlSchema.safeParse(ok).success).toBe(true);
		}
		for (const bad of ['javascript:alert(1)', '//evil.example', 'http://insecure.example', 'products', ' ']) {
			expect(webUrlSchema.safeParse(bad).success).toBe(false);
		}
	});

	test('social links are https and each network appears once', () => {
		expect(webSiteBodySchema.safeParse({ brandName: 'E', socialLinks: [{ key: 'instagram', url: 'https://instagram.com/x' }] }).success).toBe(true);
		expect(webSiteBodySchema.safeParse({ brandName: 'E', socialLinks: [{ key: 'instagram', url: 'http://instagram.com/x' }] }).success).toBe(false);
		expect(
			webSiteBodySchema.safeParse({
				brandName: 'E',
				socialLinks: [
					{ key: 'youtube', url: 'https://youtube.com/a' },
					{ key: 'youtube', url: 'https://youtube.com/b' },
				],
			}).success,
		).toBe(false);
		expect(webSiteBodySchema.safeParse({ brandName: '' }).success).toBe(false);
	});

	test('a menu keeps at most 8 child menus', () => {
		const child = { name: 'Col', items: [] };
		expect(webMenuBodySchema.safeParse({ name: 'Footer', children: Array(8).fill(child) }).success).toBe(true);
		expect(webMenuBodySchema.safeParse({ name: 'Footer', children: Array(9).fill(child) }).success).toBe(false);
	});
});

let site: TWebSiteSelect | null;
let trees: Map<string, { root: TWebMenuSelect; children: TWebMenuSelect[]; items: TWebMenuItemSelect[] }>;
let written: TMenuTreeWrite[];
let disabled: string[];

const menu = (id: string, code: string, name: string, extra: Partial<TWebMenuSelect> = {}) => ({ id, code, name, parentMenuId: null, position: 0, isActive: true, ...extra }) as TWebMenuSelect;
const item = (webMenuId: string, label: string, isActive = true) => ({ webMenuId, label, url: `/${label.toLowerCase()}`, isActive }) as TWebMenuItemSelect;

function service(): WebsiteService {
	const repository: IWebsiteRepository = {
		findSite: async () => site,
		upsertSite: async (_key, data) => (site = { id: 's', siteKey: 'default', ...data } as TWebSiteSelect),
		findMenuTree: async (code) => trees.get(code) ?? null,
		replaceMenuTree: async (tree) => {
			written.push(tree);
		},
	};
	const keys: IWebsiteKeyIssuer = {
		issue: async () => ({ id: 'k-new', key: 'ewk_secret', start: 'ewk_se' }),
		list: async ({ organizationId }) =>
			organizationId === 'org-1' ? [{ id: 'k-1', name: 'Site', start: 'ewk_ab', enabled: true, createdAt: '', lastRequest: null }] : [],
		disable: async ({ apiKeyId }) => {
			disabled.push(apiKeyId);
		},
	};
	return new WebsiteService(repository, keys);
}

beforeEach(() => {
	site = null;
	trees = new Map();
	written = [];
	disabled = [];
});

describe('website configuration', () => {
	test('before the first save the public site is null and has no menus', async () => {
		expect(await service().publicSite()).toEqual({ site: null, menus: {} });
	});

	test('the public read hides inactive items and inactive footer columns', async () => {
		trees.set('main', { root: menu('m', 'main', 'Main'), children: [], items: [item('m', 'Home'), item('m', 'Promo', false)] });
		trees.set('footer', {
			root: menu('f', 'footer', 'Footer'),
			children: [menu('c1', 'footer-1', 'Products'), menu('c2', 'footer-2', 'Old', { isActive: false })],
			items: [item('c1', 'Gates'), item('c1', 'Hidden', false), item('c2', 'Legacy')],
		});
		const { menus } = await service().publicSite();
		expect(menus.main!.items.map((entry) => entry.label)).toEqual(['Home']);
		expect(menus.footer!.children.map((child) => [child.name, child.items.map((entry) => entry.label)])).toEqual([['Products', ['Gates']]]);
	});

	test('the editor sees inactive entries too, and saving replaces the whole menu', async () => {
		trees.set('main', { root: menu('m', 'main', 'Main'), children: [], items: [item('m', 'Home'), item('m', 'Promo', false)] });
		const svc = service();
		expect((await svc.getMenu('main')).items.map((entry) => entry.isActive)).toEqual([true, false]);
		await svc.replaceMenu('main', webMenuBodySchema.parse({ name: 'Main', items: [{ label: 'Home', url: '/' }] }));
		expect(written[0]).toEqual({ root: { code: 'main', name: 'Main' }, items: [{ label: 'Home', url: '/', isActive: true }], children: [] });
	});

	test('saving the identity records who changed it, and the view hides audit columns', async () => {
		const view = await service().updateSite(webSiteBodySchema.parse({ brandName: 'ENTRAGATE' }), 'u-1');
		expect(site?.updatedByUserId).toBe('u-1');
		expect(view).not.toHaveProperty('updatedByUserId');
		expect(view.brandName).toBe('ENTRAGATE');
	});
});

describe('website keys', () => {
	test("revoking a key of the organization disables it; another organization's or an unknown key is 404", async () => {
		const svc = service();
		await svc.revokeKey('org-1', 'u-1', 'k-1', new Headers());
		expect(disabled).toEqual(['k-1']);
		await expect(svc.revokeKey('org-2', 'u-1', 'k-1', new Headers())).rejects.toBeInstanceOf(WebsiteKeyNotFoundError);
		await expect(svc.revokeKey('org-1', 'u-1', 'nope', new Headers())).rejects.toBeInstanceOf(WebsiteKeyNotFoundError);
		expect(disabled).toEqual(['k-1']);
	});
});
