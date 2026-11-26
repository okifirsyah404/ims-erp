import { DRIZZLE_TOKEN } from '@di/provider';
import { purchaseTermTemplates, type TPurchaseTermTemplateSelect } from '@drizzle/schemas/procurement.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IPurchaseTermTemplateRepository,
	TPurchaseTermTemplateData,
} from '../contracts/procurement.repository.interface';

/** Drizzle implementation of {@link IPurchaseTermTemplateRepository} (ERP-0165). */
@injectable()
export class PurchaseTermTemplateRepository implements IPurchaseTermTemplateRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	findAll(): Promise<TPurchaseTermTemplateSelect[]> {
		return this.database
			.select()
			.from(purchaseTermTemplates)
			.where(isNull(purchaseTermTemplates.deletedAt))
			.orderBy(desc(purchaseTermTemplates.isDefault), asc(purchaseTermTemplates.name));
	}

	async findLive(id: string): Promise<TPurchaseTermTemplateSelect | null> {
		const [row] = await this.database
			.select()
			.from(purchaseTermTemplates)
			.where(and(eq(purchaseTermTemplates.id, id), isNull(purchaseTermTemplates.deletedAt)));
		return row ?? null;
	}

	/** Takes the default flag from every other live row (the partial unique index allows one). */
	private async clearDefault(tx: TTx, exceptId: string | null): Promise<void> {
		await tx
			.update(purchaseTermTemplates)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					eq(purchaseTermTemplates.isDefault, true),
					isNull(purchaseTermTemplates.deletedAt),
					...(exceptId ? [ne(purchaseTermTemplates.id, exceptId)] : []),
				),
			);
	}

	create(data: TPurchaseTermTemplateData & { createdBy: string }): Promise<TPurchaseTermTemplateSelect> {
		return this.database.transaction(async (tx) => {
			if (data.isDefault) await this.clearDefault(tx, null);
			const now = new Date();
			const [row] = await tx
				.insert(purchaseTermTemplates)
				.values({ ...data, createdAt: now, updatedAt: now })
				.returning();
			return row!;
		});
	}

	update(id: string, data: TPurchaseTermTemplateData): Promise<TPurchaseTermTemplateSelect | null> {
		return this.database.transaction(async (tx) => {
			if (data.isDefault) await this.clearDefault(tx, id);
			const [row] = await tx
				.update(purchaseTermTemplates)
				.set({ ...data, updatedAt: new Date() })
				.where(and(eq(purchaseTermTemplates.id, id), isNull(purchaseTermTemplates.deletedAt)))
				.returning();
			return row ?? null;
		});
	}

	async softDelete(id: string, updatedBy: string): Promise<boolean> {
		const now = new Date();
		const rows = await this.database
			.update(purchaseTermTemplates)
			.set({ deletedAt: now, updatedAt: now, isDefault: false, updatedBy })
			.where(and(eq(purchaseTermTemplates.id, id), isNull(purchaseTermTemplates.deletedAt)))
			.returning({ id: purchaseTermTemplates.id });
		return rows.length > 0;
	}
}
