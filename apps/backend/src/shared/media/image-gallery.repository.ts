import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { IGalleryImageRepository, TGalleryImageRow } from './image-gallery';

/** Columns every `<owner>_images` table shares. */
export type TGalleryTable = PgTable & {
	id: PgColumn;
	objectKey: PgColumn;
	caption: PgColumn;
	sortOrder: PgColumn;
	createdAt: PgColumn;
	updatedAt: PgColumn;
	deletedAt: PgColumn;
};

/**
 * Drizzle implementation of {@link IGalleryImageRepository} for any
 * `<owner>_images` table. Module repositories extend it with their table and
 * owner column, so each module still owns its own queries and schema.
 */
export abstract class GalleryRepositoryBase implements IGalleryImageRepository {
	protected constructor(
		private readonly database: BunSQLDatabase,
		private readonly table: TGalleryTable,
		/** Property name of the owner id on the table (e.g. `productId`). */
		private readonly ownerKey: string,
	) {}

	private get ownerColumn(): PgColumn {
		return (this.table as unknown as Record<string, PgColumn>)[this.ownerKey];
	}

	private alive(ownerId: string) {
		return and(eq(this.ownerColumn, ownerId), isNull(this.table.deletedAt));
	}

	async list(ownerId: string): Promise<TGalleryImageRow[]> {
		return (await this.database
			.select()
			.from(this.table)
			.where(this.alive(ownerId))
			.orderBy(asc(this.table.sortOrder), asc(this.table.createdAt), asc(this.table.id))) as TGalleryImageRow[];
	}

	async add(
		ownerId: string,
		data: { objectKey: string; caption: string | null; sortOrder: number },
	): Promise<TGalleryImageRow> {
		const [row] = await this.database
			.insert(this.table)
			.values({ ...data, [this.ownerKey]: ownerId, createdAt: new Date() } as never)
			.returning();
		return row as TGalleryImageRow;
	}

	async updateCaption(ownerId: string, imageId: string, caption: string | null): Promise<TGalleryImageRow | null> {
		const [row] = await this.database
			.update(this.table)
			.set({ caption, updatedAt: new Date() } as never)
			.where(and(this.alive(ownerId), eq(this.table.id, imageId)))
			.returning();
		return (row as TGalleryImageRow | undefined) ?? null;
	}

	async remove(ownerId: string, imageId: string): Promise<boolean> {
		const rows = await this.database
			.update(this.table)
			.set({ deletedAt: new Date(), updatedAt: new Date() } as never)
			.where(and(this.alive(ownerId), eq(this.table.id, imageId)))
			.returning({ id: this.table.id });
		return rows.length > 0;
	}

	async reorder(ownerId: string, orderedIds: string[]): Promise<void> {
		await this.database.transaction(async (tx) => {
			for (const [index, id] of orderedIds.entries()) {
				await tx
					.update(this.table)
					.set({ sortOrder: index, updatedAt: new Date() } as never)
					.where(and(this.alive(ownerId), eq(this.table.id, id)));
			}
		});
	}
}
