import { DRIZZLE_TOKEN } from '@di/provider';
import { webAssets, webPages, type WebPageType } from '@drizzle/schemas/commerce.schema';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IWebContentRepository } from '../contracts/content.contract';

/** Drizzle implementation of {@link IWebContentRepository} (ERP-0071 stages 2-4). */
@injectable()
export class WebContentRepository implements IWebContentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listPages(pageType: WebPageType, options: { publishedOnly?: boolean } = {}) {
		const conditions = [eq(webPages.pageType, pageType), isNull(webPages.deletedAt)];
		if (options.publishedOnly) conditions.push(eq(webPages.status, 'published'));
		return this.database
			.select()
			.from(webPages)
			.where(and(...conditions))
			.orderBy(asc(webPages.position), asc(webPages.createdAt));
	}

	async findPage(id: string) {
		const [row] = await this.database
			.select()
			.from(webPages)
			.where(and(eq(webPages.id, id), isNull(webPages.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findPageBySlug(pageType: WebPageType, slug: string, options: { publishedOnly?: boolean } = {}) {
		const conditions = [eq(webPages.pageType, pageType), eq(webPages.slug, slug), isNull(webPages.deletedAt)];
		if (options.publishedOnly) conditions.push(eq(webPages.status, 'published'));
		const [row] = await this.database
			.select()
			.from(webPages)
			.where(and(...conditions))
			.limit(1);
		return row ?? null;
	}

	async createPage(data: Parameters<IWebContentRepository['createPage']>[0]) {
		const now = new Date();
		const [row] = await this.database.insert(webPages).values({ ...data, createdAt: now, updatedAt: now }).returning();
		return row!;
	}

	async updatePage(id: string, data: Parameters<IWebContentRepository['updatePage']>[1], expectedVersion?: number) {
		const conditions = [eq(webPages.id, id), isNull(webPages.deletedAt)];
		if (expectedVersion !== undefined) conditions.push(eq(webPages.version, expectedVersion));
		const [row] = await this.database
			.update(webPages)
			.set({ ...data, version: sql`${webPages.version} + 1`, updatedAt: new Date() })
			.where(and(...conditions))
			.returning();
		return row ?? null;
	}

	async softDeletePage(id: string) {
		const now = new Date();
		const rows = await this.database
			.update(webPages)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(webPages.id, id), isNull(webPages.deletedAt)))
			.returning({ id: webPages.id });
		return rows.length > 0;
	}

	async createAsset(data: Parameters<IWebContentRepository['createAsset']>[0]) {
		const now = new Date();
		const [row] = await this.database.insert(webAssets).values({ ...data, createdAt: now, updatedAt: now }).returning();
		return row!;
	}

	listAssets(limit: number) {
		return this.database.select().from(webAssets).where(isNull(webAssets.deletedAt)).orderBy(desc(webAssets.createdAt)).limit(limit);
	}

	findAssets(ids: string[]) {
		if (ids.length === 0) return Promise.resolve([]);
		return this.database
			.select()
			.from(webAssets)
			.where(and(inArray(webAssets.id, ids), isNull(webAssets.deletedAt)));
	}

	async softDeleteAsset(id: string) {
		const now = new Date();
		const rows = await this.database
			.update(webAssets)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(webAssets.id, id), isNull(webAssets.deletedAt)))
			.returning({ id: webAssets.id });
		return rows.length > 0;
	}
}
