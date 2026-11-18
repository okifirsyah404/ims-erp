import { DRIZZLE_TOKEN } from '@di/provider';
import { warrantyCertificates } from '@drizzle/schemas/aftersales.schema';
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
			.from(warrantyCertificates)
			.where(and(eq(warrantyCertificates.projectId, projectId), isNull(warrantyCertificates.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async listByCustomer(customerId: string) {
		return this.database
			.select()
			.from(warrantyCertificates)
			.where(and(eq(warrantyCertificates.customerId, customerId), isNull(warrantyCertificates.deletedAt)))
			.orderBy(desc(warrantyCertificates.startDate), desc(warrantyCertificates.id));
	}

	async create(code: string, actorUserId: string, data: TWarrantyData) {
		const now = new Date();
		const [row] = await this.database
			.insert(warrantyCertificates)
			.values({ ...data, code, createdBy: actorUserId, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, data: TWarrantyData) {
		const [row] = await this.database
			.update(warrantyCertificates)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(warrantyCertificates.id, id), isNull(warrantyCertificates.deletedAt)))
			.returning();
		return row ?? null;
	}
}
