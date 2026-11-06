import { DRIZZLE_TOKEN } from '@di/provider';
import { likePattern } from '@drizzle/search';
import { projectHandover, projects, projectTasks } from '@drizzle/schemas/projects.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, exists, getTableColumns, ilike, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IHandoverRepository, TBastData, TBastListRequest, TBastRow } from '../contracts/handover.repository.interface';

/** Drizzle implementation of {@link IHandoverRepository}. */
@injectable()
export class HandoverRepository implements IHandoverRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	list(projectId: string) {
		return this.database
			.select()
			.from(projectHandover)
			.where(and(eq(projectHandover.projectId, projectId), isNull(projectHandover.deletedAt)))
			.orderBy(desc(projectHandover.bastDate), desc(projectHandover.createdAt));
	}

	async paginateAll(request: TBastListRequest): Promise<TPaginationResult<TBastRow>> {
		const { page, limit, search, involvedUserId } = request;
		const where = and(
			isNull(projectHandover.deletedAt),
			isNull(projects.deletedAt),
			involvedUserId
				? or(
						eq(projects.picUserId, involvedUserId),
						exists(
							this.database
								.select({ id: projectTasks.id })
								.from(projectTasks)
								.where(
									and(
										eq(projectTasks.projectId, projects.id),
										eq(projectTasks.assigneeUserId, involvedUserId),
										isNull(projectTasks.deletedAt),
									),
								),
						),
					)
				: undefined,
			search
				? or(
						ilike(projectHandover.code, likePattern(search)),
						ilike(projectHandover.firstPartyCompany, likePattern(search)),
						ilike(projectHandover.workTitle, likePattern(search)),
						ilike(projects.code, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(projectHandover)
			.innerJoin(projects, eq(projects.id, projectHandover.projectId))
			.where(where);
		const data = await this.database
			.select({ ...getTableColumns(projectHandover), projectCode: projects.code, customerName: projects.customerName })
			.from(projectHandover)
			.innerJoin(projects, eq(projects.id, projectHandover.projectId))
			.where(where)
			.orderBy(desc(projectHandover.bastDate), desc(projectHandover.createdAt))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async find(projectId: string, bastId: string) {
		const [row] = await this.database
			.select()
			.from(projectHandover)
			.where(and(eq(projectHandover.id, bastId), eq(projectHandover.projectId, projectId), isNull(projectHandover.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(projectId: string, code: string, actorUserId: string, data: TBastData) {
		const now = new Date();
		const [row] = await this.database
			.insert(projectHandover)
			.values({ ...data, projectId, code, createdBy: actorUserId, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(bastId: string, data: TBastData) {
		const [row] = await this.database
			.update(projectHandover)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(projectHandover.id, bastId), isNull(projectHandover.deletedAt), eq(projectHandover.status, 'issued')))
			.returning();
		return row ?? null;
	}

	async cancel(bastId: string, actorUserId: string) {
		const now = new Date();
		const [row] = await this.database
			.update(projectHandover)
			.set({ status: 'cancelled', cancelledBy: actorUserId, cancelledAt: now, updatedAt: now })
			.where(and(eq(projectHandover.id, bastId), isNull(projectHandover.deletedAt), eq(projectHandover.status, 'issued')))
			.returning();
		return row ?? null;
	}
}
