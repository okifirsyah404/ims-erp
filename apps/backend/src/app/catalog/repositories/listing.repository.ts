import { DRIZZLE_TOKEN } from '@di/provider';
import { webListings } from '@drizzle/schemas/catalog.schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IListingRepository } from '../contracts/catalog.contract';

/** Drizzle implementation of {@link IListingRepository}. */
@injectable()
export class ListingRepository implements IListingRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listAll() {
		return this.database.select().from(webListings).where(isNull(webListings.deletedAt)).orderBy(desc(webListings.updatedAt));
	}

	listPublished() {
		return this.database
			.select()
			.from(webListings)
			.where(and(isNull(webListings.deletedAt), eq(webListings.isPublished, true)));
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(webListings)
			.where(and(eq(webListings.id, id), isNull(webListings.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findPublishedBySlug(slug: string) {
		const [row] = await this.database
			.select()
			.from(webListings)
			.where(and(eq(webListings.slug, slug), isNull(webListings.deletedAt), eq(webListings.isPublished, true)))
			.limit(1);
		return row ?? null;
	}

	async create(data: Parameters<IListingRepository['create']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(webListings)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, data: Parameters<IListingRepository['update']>[1]) {
		const [row] = await this.database
			.update(webListings)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(webListings.id, id), isNull(webListings.deletedAt)))
			.returning();
		return row ?? null;
	}

	async remove(id: string) {
		const now = new Date();
		const rows = await this.database
			.update(webListings)
			.set({ deletedAt: now, updatedAt: now, isPublished: false })
			.where(and(eq(webListings.id, id), isNull(webListings.deletedAt)))
			.returning({ id: webListings.id });
		return rows.length > 0;
	}
}
