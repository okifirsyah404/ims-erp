import { DRIZZLE_TOKEN } from '@di/provider';
import { warranties } from '@drizzle/schemas/project.schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IWarrantyRepository, TWarrantyData } from '../contracts/warranty.contract';

/** Drizzle implementation of {@link IWarrantyRepository}. */
@injectable()
export class WarrantyRepository implements IWarrantyRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findByProject(projectId: string) {
		const [row] = await this.database
			.select()
			.from(warranties)
			.where(and(eq(warranties.projectId, projectId), isNull(warranties.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async listByCustomer(customerId: string) {
		return this.database
			.select()
			.from(warranties)
			.where(and(eq(warranties.customerId, customerId), isNull(warranties.deletedAt)))
			.orderBy(desc(warranties.startDate), desc(warranties.id));
	}

	async create(code: string, actorUserId: string, data: TWarrantyData) {
		const now = new Date();
		const [row] = await this.database
			.insert(warranties)
			.values({ ...data, code, createdBy: actorUserId, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, data: TWarrantyData) {
		const [row] = await this.database
			.update(warranties)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(warranties.id, id), isNull(warranties.deletedAt)))
			.returning();
		return row ?? null;
	}
}
