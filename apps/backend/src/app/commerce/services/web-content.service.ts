import { appConfig } from '@config/providers/config';
import { isUniqueViolation } from '@drizzle/errors';
import type { TWebAssetSelect, TWebPageSelect, WebPageStatus, WebPageType } from '@drizzle/schemas/commerce.schema';
import { websiteAssetRefs, websiteContentSchema, websiteContentType } from '@ims-erp/common';
import { OBJECT_STORAGE_TOKEN, type IObjectStorage } from '@providers/s3/object-storage';
import { fileBytes, toWebp, UnsupportedImageError } from '@utils/image.util';
import { inject, injectable } from 'tsyringe';
import { WEB_CONTENT_REPOSITORY_TOKEN } from '../constants/di';
import {
	type IWebContentRepository,
	type TPublicWebPage,
	type TWebAssetView,
	type TWebPageBody,
	type TWebPageView,
	WEBSITE_IMAGE_MAX_MB,
	WEBSITE_IMAGE_MAX_SIDE,
} from '../contracts/content.contract';
import {
	WebAssetNotFoundError,
	WebPageContentInvalidError,
	WebPageNotFoundError,
	WebPageSlugTakenError,
	WebPageStaleError,
	WebsiteImageInvalidError,
} from '../errors/commerce.errors';

/** The slug of every single-page type (home, about, careers, warranty, installation). */
export const SINGLETON_SLUG = 'home';

function pageView(row: TWebPageSelect): TWebPageView {
	const { deletedAt: _deleted, updatedByUserId: _by, ...view } = row;
	return view;
}

/**
 * Website content (ERP-0071 stages 2-4, ADR-0025): pages and collection
 * entries in `commerce.web_pages` and the images uploaded for them.
 *
 * @remarks
 * Every save validates `content` against the shared registry of its type
 * (unknown keys dropped), checks that referenced images exist, refuses a
 * stale version (lost-update guard) and keeps single-page types at slug
 * {@link SINGLETON_SLUG}. The website reads published entries only, with
 * `asset:<id>` references turned into public image URLs.
 */
@injectable()
export class WebContentService {
	constructor(
		@inject(WEB_CONTENT_REPOSITORY_TOKEN) private readonly repository: IWebContentRepository,
		@inject(OBJECT_STORAGE_TOKEN) private readonly storage: Pick<IObjectStorage, 'put' | 'presignGet'>,
	) {}

	/** Public URL of an uploaded image (the redirect route; browsers load it). */
	assetUrl(id: string): string {
		return `${(appConfig.app.url ?? '').replace(/\/+$/, '')}/public/v1/site/assets/${id}`;
	}

	private async validated(body: TWebPageBody): Promise<{ slug: string; content: Record<string, unknown> }> {
		const type = websiteContentType(body.pageType);
		if (!type) throw new WebPageContentInvalidError(['unknown type']);
		if (type.singleton && body.slug !== SINGLETON_SLUG) throw new WebPageContentInvalidError([`a ${type.key} page uses the address "${SINGLETON_SLUG}"`]);
		const parsed = websiteContentSchema(type).safeParse(body.content);
		if (!parsed.success) {
			throw new WebPageContentInvalidError(parsed.error.issues.map((issue) => `${issue.path.join('.') || 'content'}: ${issue.message}`));
		}
		const refs = [...websiteAssetRefs(parsed.data)];
		if (refs.length > 0) {
			const known = new Set((await this.repository.findAssets(refs)).map((asset) => asset.id.toLowerCase()));
			const missing = refs.filter((ref) => !known.has(ref));
			if (missing.length > 0) throw new WebPageContentInvalidError(missing.map((ref) => `image asset:${ref} does not exist`));
		}
		return { slug: body.slug, content: parsed.data };
	}

	async list(pageType: WebPageType): Promise<TWebPageView[]> {
		return (await this.repository.listPages(pageType)).map(pageView);
	}

	async get(id: string): Promise<TWebPageView> {
		const row = await this.repository.findPage(id);
		if (!row) throw new WebPageNotFoundError();
		return pageView(row);
	}

	/** A new entry (draft). @throws {WebPageSlugTakenError} */
	async create(body: TWebPageBody, actorUserId: string): Promise<TWebPageView> {
		const { slug, content } = await this.validated(body);
		try {
			const row = await this.repository.createPage({
				pageType: body.pageType,
				slug,
				title: body.title,
				position: body.position,
				seoTitle: body.seoTitle,
				seoDescription: body.seoDescription,
				content,
				status: 'draft',
				updatedByUserId: actorUserId,
			});
			return pageView(row);
		} catch (error) {
			if (isUniqueViolation(error)) throw new WebPageSlugTakenError();
			throw error;
		}
	}

	/** Saves an entry (the type never changes). @throws {WebPageStaleError} when `version` is older than the stored one */
	async update(id: string, body: TWebPageBody, actorUserId: string): Promise<TWebPageView> {
		const current = await this.repository.findPage(id);
		if (!current) throw new WebPageNotFoundError();
		const { slug, content } = await this.validated({ ...body, pageType: current.pageType });
		try {
			const row = await this.repository.updatePage(
				id,
				{ slug, title: body.title, position: body.position, seoTitle: body.seoTitle, seoDescription: body.seoDescription, content, updatedByUserId: actorUserId },
				body.version,
			);
			if (!row) throw new WebPageStaleError();
			return pageView(row);
		} catch (error) {
			if (isUniqueViolation(error)) throw new WebPageSlugTakenError();
			throw error;
		}
	}

	/** Draft → published (shown on the website), or back to draft / archived. */
	async setStatus(id: string, status: WebPageStatus, actorUserId: string): Promise<TWebPageView> {
		const current = await this.repository.findPage(id);
		if (!current) throw new WebPageNotFoundError();
		const row = await this.repository.updatePage(id, {
			status,
			publishedAt: status === 'published' ? (current.publishedAt ?? new Date()) : current.publishedAt,
			updatedByUserId: actorUserId,
		});
		if (!row) throw new WebPageNotFoundError();
		return pageView(row);
	}

	async remove(id: string): Promise<void> {
		if (!(await this.repository.softDeletePage(id))) throw new WebPageNotFoundError();
	}

	/* Images -------------------------------------------------------------- */

	private assetView(asset: TWebAssetSelect): TWebAssetView {
		return {
			id: asset.id,
			ref: `asset:${asset.id}`,
			fileName: asset.fileName,
			byteSize: asset.byteSize,
			altText: asset.altText,
			url: this.storage.presignGet(asset.objectKey, { fileName: asset.fileName, inline: true, expiresIn: 3600 }),
			createdAt: asset.createdAt,
		};
	}

	/**
	 * Stores an uploaded image as WebP (longest side {@link WEBSITE_IMAGE_MAX_SIDE}).
	 *
	 * @throws {WebsiteImageInvalidError} Not a decodable image or over {@link WEBSITE_IMAGE_MAX_MB} MB
	 */
	async upload(file: unknown, altText: string | null, actorUserId: string): Promise<TWebAssetView> {
		if (!(file instanceof File) || file.size === 0 || file.size > WEBSITE_IMAGE_MAX_MB * 1024 * 1024) {
			throw new WebsiteImageInvalidError(WEBSITE_IMAGE_MAX_MB);
		}
		let webp: Buffer;
		try {
			webp = await toWebp(await fileBytes(file), { maxSize: WEBSITE_IMAGE_MAX_SIDE, quality: 82 });
		} catch (error) {
			if (error instanceof UnsupportedImageError) throw new WebsiteImageInvalidError(WEBSITE_IMAGE_MAX_MB);
			throw error;
		}
		const objectKey = `website/${crypto.randomUUID()}.webp`;
		await this.storage.put(objectKey, webp, 'image/webp');
		const asset = await this.repository.createAsset({
			objectKey,
			fileName: (file.name || 'image').slice(0, 200).replace(/\.[^.]+$/, '.webp'),
			contentType: 'image/webp',
			byteSize: webp.byteLength,
			altText,
			uploadedByUserId: actorUserId,
		});
		return this.assetView(asset);
	}

	async listAssets(): Promise<TWebAssetView[]> {
		return (await this.repository.listAssets(500)).map((asset) => this.assetView(asset));
	}

	async removeAsset(id: string): Promise<void> {
		if (!(await this.repository.softDeleteAsset(id))) throw new WebAssetNotFoundError();
	}

	/** Short-lived URL of an uploaded image (the public redirect). @throws {WebAssetNotFoundError} */
	async assetRedirect(id: string): Promise<string> {
		const [asset] = await this.repository.findAssets([id]);
		if (!asset) throw new WebAssetNotFoundError();
		return this.storage.presignGet(asset.objectKey, { fileName: asset.fileName, inline: true, expiresIn: 3600 });
	}

	/* Public read --------------------------------------------------------- */

	/** Replaces every `asset:<id>` string with the image's public URL. */
	private resolveAssets(value: unknown): unknown {
		if (typeof value === 'string') {
			const match = /^asset:([0-9a-f-]{36})$/i.exec(value);
			return match ? this.assetUrl(match[1]!) : value;
		}
		if (Array.isArray(value)) return value.map((entry) => this.resolveAssets(entry));
		if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, this.resolveAssets(entry)]));
		return value;
	}

	private publicView(row: TWebPageSelect): TPublicWebPage {
		return {
			slug: row.slug,
			title: row.title,
			position: row.position,
			seoTitle: row.seoTitle,
			seoDescription: row.seoDescription,
			content: this.resolveAssets(row.content) as Record<string, unknown>,
			updatedAt: row.updatedAt,
		};
	}

	/** Published entries of a type, in website order. */
	async listPublished(pageType: WebPageType): Promise<TPublicWebPage[]> {
		return (await this.repository.listPages(pageType, { publishedOnly: true })).map((row) => this.publicView(row));
	}

	/** One published entry. @throws {WebPageNotFoundError} */
	async getPublished(pageType: WebPageType, slug: string): Promise<TPublicWebPage> {
		const row = await this.repository.findPageBySlug(pageType, slug, { publishedOnly: true });
		if (!row) throw new WebPageNotFoundError();
		return this.publicView(row);
	}
}
