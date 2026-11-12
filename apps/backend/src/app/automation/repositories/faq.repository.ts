import { DRIZZLE_TOKEN } from '@di/provider';
import { faqEntries } from '@drizzle/schemas/automation.schema';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IFaqRepository } from '../contracts/whatsapp.contract';

/** Drizzle implementation of {@link IFaqRepository} (live rows only). */
@injectable()
export class FaqRepository implements IFaqRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	list(includeInactive: boolean) {
		return this.database
			.select()
			.from(faqEntries)
			.where(and(isNull(faqEntries.deletedAt), includeInactive ? undefined : eq(faqEntries.isActive, true)))
			.orderBy(asc(faqEntries.sortOrder), asc(faqEntries.question));
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(faqEntries)
			.where(and(eq(faqEntries.id, id), isNull(faqEntries.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(data: Parameters<IFaqRepository['create']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(faqEntries)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, data: Parameters<IFaqRepository['update']>[1]) {
		const [row] = await this.database
			.update(faqEntries)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(faqEntries.id, id), isNull(faqEntries.deletedAt)))
			.returning();
		return row ?? null;
	}

	async softDelete(id: string) {
		const rows = await this.database
			.update(faqEntries)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(and(eq(faqEntries.id, id), isNull(faqEntries.deletedAt)))
			.returning({ id: faqEntries.id });
		return rows.length > 0;
	}
}
