import { z } from 'zod';
import {
	WEB_PAGE_STATUSES,
	WEB_PAGE_TYPES,
	type TWebAssetInsert,
	type TWebAssetSelect,
	type TWebPageInsert,
	type TWebPageSelect,
	type WebPageStatus,
	type WebPageType,
} from '@drizzle/schemas/commerce.schema';

/**
 * Contracts of the website content (ERP-0071 stages 2-4): one row per page or
 * collection entry in `commerce.web_pages`, its `content` validated by the
 * shared registry (`@ims-erp/common` `WEBSITE_CONTENT_TYPES`), and the images
 * uploaded for it in `commerce.web_assets`.
 */

/** Max upload size of a website image (normalised to WebP, longest side 1920 px). */
export const WEBSITE_IMAGE_MAX_MB = 8;
export const WEBSITE_IMAGE_MAX_SIDE = 1920;

export const webPageTypeSchema = z.enum(WEB_PAGE_TYPES);

export const webPageListQuerySchema = z.object({ type: webPageTypeSchema });
export const webPageIdParamSchema = z.object({ id: z.uuid() });
export const webAssetIdParamSchema = z.object({ id: z.uuid() });

/** The editable part of an entry; `content` is checked against its type's registry entry in the service. */
export const webPageBodySchema = z.object({
	pageType: webPageTypeSchema,
	slug: z
		.string()
		.trim()
		.toLowerCase()
		.min(1)
		.max(128)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, digits and dashes'),
	title: z.string().trim().min(1).max(200),
	position: z.number().int().min(0).max(10_000).default(0),
	seoTitle: z
		.string()
		.trim()
		.max(120)
		.nullish()
		.transform((value) => (value ? value : null)),
	seoDescription: z
		.string()
		.trim()
		.max(320)
		.nullish()
		.transform((value) => (value ? value : null)),
	content: z.record(z.string(), z.unknown()).default({}),
	/** The version the editor loaded (updates only); an older one is refused. */
	version: z.number().int().min(1).optional(),
});

export const webPageStatusSchema = z.object({ status: z.enum(WEB_PAGE_STATUSES) });

export type TWebPageBody = z.output<typeof webPageBodySchema>;

/** An entry as the web admin edits it. */
export type TWebPageView = Omit<TWebPageSelect, 'deletedAt' | 'updatedByUserId'>;

/** An entry as the website reads it: published only, image references resolved to URLs. */
export type TPublicWebPage = { slug: string; title: string; position: number; seoTitle: string | null; seoDescription: string | null; content: Record<string, unknown>; updatedAt: Date };

/** An uploaded image as the web admin lists it. */
export type TWebAssetView = { id: string; ref: string; fileName: string; byteSize: number; altText: string | null; url: string; createdAt: Date };

/** Persistence port for `commerce.web_pages` and `commerce.web_assets` (live rows only). */
export interface IWebContentRepository {
	listPages(pageType: WebPageType, options?: { publishedOnly?: boolean }): Promise<TWebPageSelect[]>;
	findPage(id: string): Promise<TWebPageSelect | null>;
	findPageBySlug(pageType: WebPageType, slug: string, options?: { publishedOnly?: boolean }): Promise<TWebPageSelect | null>;
	createPage(data: Omit<TWebPageInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'>): Promise<TWebPageSelect>;
	/** Updates when the stored version equals `expectedVersion` (or always without one); bumps the version. `null` when stale or gone. */
	updatePage(id: string, data: Partial<TWebPageInsert>, expectedVersion?: number): Promise<TWebPageSelect | null>;
	softDeletePage(id: string): Promise<boolean>;
	createAsset(data: Omit<TWebAssetInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<TWebAssetSelect>;
	listAssets(limit: number): Promise<TWebAssetSelect[]>;
	findAssets(ids: string[]): Promise<TWebAssetSelect[]>;
	softDeleteAsset(id: string): Promise<boolean>;
}

export type { WebPageStatus, WebPageType };
