/**
 * Website content edited in the ERP (ERP-0071 stages 2-4).
 *
 * Covers: the shared content-type registry (17 types, required fields,
 * image references limited to `asset:<uuid>`, site paths and https URLs,
 * unknown keys dropped), saving (single pages keep slug `home`, referenced
 * images must exist, stale versions refused), publishing, and the public read
 * (published only, `asset:<id>` turned into the public image URL).
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TWebAssetSelect, TWebPageSelect } from '@drizzle/schemas/commerce.schema';
import { WEBSITE_CONTENT_TYPES, websiteAssetRefs, websiteContentFieldKeys, websiteContentSchema, websiteContentType, websiteImageSchema } from '@ims-erp/common';
import type { IWebContentRepository } from '../../src/app/commerce/contracts/content.contract';
import { WebAssetNotFoundError, WebPageContentInvalidError, WebPageNotFoundError, WebPageStaleError, WebsiteImageInvalidError } from '../../src/app/commerce/errors/commerce.errors';
import { WebContentService } from '../../src/app/commerce/services/web-content.service';
import seed from '../../database/seeders/data/website-content.json' with { type: 'json' };

const ASSET_ID = '0195f0c8-0000-7000-8000-000000000001';

describe('website content registry', () => {
	test('declares every page type once, with unique field keys per type', () => {
		const keys = WEBSITE_CONTENT_TYPES.map((type) => type.key);
		expect(new Set(keys).size).toBe(17);
		for (const type of WEBSITE_CONTENT_TYPES) {
			const fieldKeys = type.fields.map((field) => field.key);
			expect(new Set(fieldKeys).size).toBe(fieldKeys.length);
		}
		expect(websiteContentFieldKeys().length).toBeGreaterThan(100);
	});

	test('images are uploaded assets, site paths or https URLs', () => {
		for (const ok of [`asset:${ASSET_ID}`, '/images/hero.webp', 'https://cdn.example.com/a.webp']) expect(websiteImageSchema.safeParse(ok).success).toBe(true);
		for (const bad of ['asset:nope', 'http://insecure.example/a.png', 'javascript:alert(1)', '//evil.example/a.png']) {
			expect(websiteImageSchema.safeParse(bad).success).toBe(false);
		}
	});

	test('required fields are enforced and unknown keys dropped', () => {
		const schema = websiteContentSchema(websiteContentType('testimonial')!);
		expect(schema.safeParse({ author: 'A' }).success).toBe(false);
		const parsed = schema.parse({ quote: 'Great', author: 'A', injected: '<script>' });
		expect(parsed).toEqual({ quote: 'Great', author: 'A' });
	});

	test('collects asset references at any depth', () => {
		const refs = websiteAssetRefs({ image: `asset:${ASSET_ID}`, gallery: ['/a.webp', `asset:${ASSET_ID.toUpperCase()}`], nested: { list: [{ photo: 'https://x.example/p.webp' }] } });
		expect([...refs]).toEqual([ASSET_ID]);
	});

	test('the development seed content is valid for its types', () => {
		for (const entry of seed as { pageType: string; slug: string; content: unknown }[]) {
			const type = websiteContentType(entry.pageType);
			expect(type).toBeDefined();
			expect(websiteContentSchema(type!).safeParse(entry.content).success).toBe(true);
			if (type!.singleton) expect(entry.slug).toBe('home');
		}
	});
});

let pages: Map<string, TWebPageSelect>;
let assets: TWebAssetSelect[];

function row(overrides: Partial<TWebPageSelect>): TWebPageSelect {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		pageType: 'testimonial',
		slug: 'a',
		title: 'A',
		status: 'draft',
		publishedAt: null,
		position: 0,
		content: {},
		seoTitle: null,
		seoDescription: null,
		version: 1,
		updatedByUserId: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		...overrides,
	} as TWebPageSelect;
}

const repository: IWebContentRepository = {
	listPages: async (pageType, options) =>
		[...pages.values()].filter((page) => page.pageType === pageType && (!options?.publishedOnly || page.status === 'published')),
	findPage: async (id) => pages.get(id) ?? null,
	findPageBySlug: async (pageType, slug, options) =>
		[...pages.values()].find((page) => page.pageType === pageType && page.slug === slug && (!options?.publishedOnly || page.status === 'published')) ?? null,
	createPage: async (data) => {
		const page = row(data as Partial<TWebPageSelect>);
		pages.set(page.id, page);
		return page;
	},
	updatePage: async (id, data, expectedVersion) => {
		const current = pages.get(id);
		if (!current || (expectedVersion !== undefined && current.version !== expectedVersion)) return null;
		const next = { ...current, ...data, version: current.version + 1 } as TWebPageSelect;
		pages.set(id, next);
		return next;
	},
	softDeletePage: async (id) => pages.delete(id),
	createAsset: async () => {
		throw new Error('not used');
	},
	listAssets: async () => assets,
	findAssets: async (ids) => assets.filter((asset) => ids.includes(asset.id)),
	softDeleteAsset: async () => false,
};

const storage = {
	put: async () => {},
	presignGet: (key: string) => `https://storage.example/${key}?signed`,
};

const service = new WebContentService(repository, storage as never);
const body = (overrides: Record<string, unknown> = {}) =>
	({ pageType: 'testimonial', slug: 'acme', title: 'Acme', position: 0, seoTitle: null, seoDescription: null, content: { quote: 'Great', author: 'Budi' }, ...overrides }) as never;

beforeEach(() => {
	pages = new Map();
	assets = [{ id: ASSET_ID, objectKey: 'website/x.webp', fileName: 'x.webp', contentType: 'image/webp', byteSize: 10, altText: null } as TWebAssetSelect];
});

describe('WebContentService', () => {
	test('creates drafts and refuses invalid content', async () => {
		const created = await service.create(body(), 'user-1');
		expect(created.status).toBe('draft');
		expect('deletedAt' in created).toBe(false);
		await expect(service.create(body({ content: { author: 'Budi' } }), 'user-1')).rejects.toBeInstanceOf(WebPageContentInvalidError);
	});

	test('single pages keep the slug "home"', async () => {
		await expect(service.create(body({ pageType: 'home', slug: 'landing', content: {} }), 'user-1')).rejects.toBeInstanceOf(WebPageContentInvalidError);
		expect((await service.create(body({ pageType: 'home', slug: 'home', content: {} }), 'user-1')).slug).toBe('home');
	});

	test('referenced images must exist', async () => {
		const missing = '0195f0c8-0000-7000-8000-0000000000ff';
		await expect(service.create(body({ content: { quote: 'Q', author: 'A', photo: `asset:${missing}` } }), 'user-1')).rejects.toBeInstanceOf(WebPageContentInvalidError);
		expect((await service.create(body({ content: { quote: 'Q', author: 'A', photo: `asset:${ASSET_ID}` } }), 'user-1')).content.photo).toBe(`asset:${ASSET_ID}`);
	});

	test('a stale version is refused; the type never changes on update', async () => {
		const created = await service.create(body(), 'user-1');
		const saved = await service.update(created.id, body({ pageType: 'news', title: 'Acme 2', version: 1 }), 'user-1');
		expect(saved.pageType).toBe('testimonial');
		expect(saved.version).toBe(2);
		await expect(service.update(created.id, body({ version: 1 }), 'user-1')).rejects.toBeInstanceOf(WebPageStaleError);
		await expect(service.update(crypto.randomUUID(), body(), 'user-1')).rejects.toBeInstanceOf(WebPageNotFoundError);
	});

	test('the website reads published entries only, with images as public URLs', async () => {
		const created = await service.create(body({ content: { quote: 'Q', author: 'A', photo: `asset:${ASSET_ID}` } }), 'user-1');
		expect(await service.listPublished('testimonial')).toEqual([]);
		await expect(service.getPublished('testimonial', 'acme')).rejects.toBeInstanceOf(WebPageNotFoundError);

		const published = await service.setStatus(created.id, 'published', 'user-1');
		expect(published.publishedAt).toBeInstanceOf(Date);
		const [entry] = await service.listPublished('testimonial');
		expect(entry!.content.photo).toBe(service.assetUrl(ASSET_ID));
		expect(entry!.content.photo).toEndWith(`/public/v1/site/assets/${ASSET_ID}`);
		expect((await service.getPublished('testimonial', 'acme')).title).toBe('Acme');

		const again = await service.setStatus(created.id, 'draft', 'user-1');
		expect(again.publishedAt).toEqual(published.publishedAt);
		expect(await service.listPublished('testimonial')).toEqual([]);
	});

	test('uploads accept images only, within the size limit', async () => {
		await expect(service.upload('not a file', null, 'user-1')).rejects.toBeInstanceOf(WebsiteImageInvalidError);
		await expect(service.upload(new File([new Uint8Array([1, 2, 3])], 'x.txt'), null, 'user-1')).rejects.toBeInstanceOf(WebsiteImageInvalidError);
		await expect(service.upload(new File([new Uint8Array(9 * 1024 * 1024)], 'big.png'), null, 'user-1')).rejects.toBeInstanceOf(WebsiteImageInvalidError);
	});

	test('the image redirect uses a short-lived URL and 404s unknown images', async () => {
		expect(await service.assetRedirect(ASSET_ID)).toContain('website/x.webp');
		await expect(service.assetRedirect(crypto.randomUUID())).rejects.toBeInstanceOf(WebAssetNotFoundError);
	});
});
