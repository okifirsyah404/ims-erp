import { DRIZZLE_TOKEN } from '@di/provider';
import { likePattern } from '@drizzle/search';
import { warranties } from '@drizzle/schemas/project.schema';
import { and, count, desc, eq, exists, getTableColumns, ilike, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import { handover, projects, tasks } from '@drizzle/schemas/project.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	IWarrantyRepository,
	TWarrantyData,
	TWarrantyPaginationRequest,
	TWarrantyRow,
} from '../contracts/warranty.contract';

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

	/**
	 * Fetches one page of certificates across the projects visible to the
	 * caller (same rule as the BAST list).
	 *
	 * @param request - Page settings, search term and the visibility filter
	 */
	async paginate(request: TWarrantyPaginationRequest): Promise<TPaginationResult<TWarrantyRow>> {
		const { search, involvedUserId } = request;
		const where = and(
			isNull(warranties.deletedAt),
			isNull(projects.deletedAt),
			involvedUserId
				? or(
						eq(projects.picUserId, involvedUserId),
						exists(
							this.database
								.select({ id: tasks.id })
								.from(tasks)
								.where(
									and(
										eq(tasks.projectId, projects.id),
										eq(tasks.assigneeUserId, involvedUserId),
										isNull(tasks.deletedAt),
									),
								),
						),
					)
				: undefined,
			search
				? or(
						ilike(warranties.code, likePattern(search)),
						ilike(warranties.projectName, likePattern(search)),
						ilike(warranties.projectOwner, likePattern(search)),
						ilike(projects.code, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(warranties)
			.innerJoin(projects, eq(projects.id, warranties.projectId))
			.where(where);
		const data = await this.database
			.select({ ...getTableColumns(warranties), projectCode: projects.code, customerName: projects.customerName })
			.from(warranties)
			.innerJoin(projects, eq(projects.id, warranties.projectId))
			.where(where)
			.orderBy(desc(warranties.startDate), desc(warranties.createdAt))
			.limit(request.limit)
			.offset((request.page - 1) * request.limit);
		return paginationResult(request, total, data);
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
