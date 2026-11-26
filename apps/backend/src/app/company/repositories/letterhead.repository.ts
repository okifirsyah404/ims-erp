import { DRIZZLE_TOKEN } from '@di/provider';
import { letterheads, type TLetterheadSelect } from '@drizzle/schemas/company.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ILetterheadRepository } from '../contracts/company.repository.interface';

/** Drizzle implementation of {@link ILetterheadRepository} on `company.letterheads`. */
@injectable()
export class LetterheadRepository implements ILetterheadRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	findAll(): Promise<TLetterheadSelect[]> {
		return this.database
			.select()
			.from(letterheads)
			.where(isNull(letterheads.deletedAt))
			.orderBy(desc(letterheads.isDefault), asc(letterheads.name));
	}

	async findLive(id: string): Promise<TLetterheadSelect | null> {
		const [row] = await this.database
			.select()
			.from(letterheads)
			.where(and(eq(letterheads.id, id), isNull(letterheads.deletedAt)));
		return row ?? null;
	}

	async findAny(id: string): Promise<TLetterheadSelect | null> {
		const [row] = await this.database.select().from(letterheads).where(eq(letterheads.id, id));
		return row ?? null;
	}

	async findDefault(): Promise<TLetterheadSelect | null> {
		const [row] = await this.database
			.select()
			.from(letterheads)
			.where(and(eq(letterheads.isDefault, true), isNull(letterheads.deletedAt)));
		return row ?? null;
	}

	/** Takes the default flag from every other live row (the partial unique index allows one). */
	private async clearDefault(tx: TTx, exceptId: string | null): Promise<void> {
		const now = new Date();
		await tx
			.update(letterheads)
			.set({ isDefault: false, updatedAt: now })
			.where(
				and(
					eq(letterheads.isDefault, true),
					isNull(letterheads.deletedAt),
					...(exceptId ? [ne(letterheads.id, exceptId)] : []),
				),
			);
	}

	create(data: Parameters<ILetterheadRepository['create']>[0]): Promise<TLetterheadSelect> {
		return this.database.transaction(async (tx) => {
			if (data.isDefault) await this.clearDefault(tx, null);
			const now = new Date();
			const [row] = await tx
				.insert(letterheads)
				.values({ ...data, createdAt: now, updatedAt: now })
				.returning();
			return row!;
		});
	}

	update(id: string, data: Parameters<ILetterheadRepository['update']>[1]): Promise<TLetterheadSelect | null> {
		return this.database.transaction(async (tx) => {
			if (data.isDefault) await this.clearDefault(tx, id);
			const [row] = await tx
				.update(letterheads)
				.set({ ...data, updatedAt: new Date() })
				.where(and(eq(letterheads.id, id), isNull(letterheads.deletedAt)))
				.returning();
			return row ?? null;
		});
	}

	async softDelete(id: string, updatedBy: string): Promise<boolean> {
		const now = new Date();
		const rows = await this.database
			.update(letterheads)
			.set({ deletedAt: now, updatedAt: now, isDefault: false, updatedBy })
			.where(and(eq(letterheads.id, id), isNull(letterheads.deletedAt)))
			.returning({ id: letterheads.id });
		return rows.length > 0;
	}
}
