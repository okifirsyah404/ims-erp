import { DRIZZLE_TOKEN } from '@di/provider';
import { likePattern } from '@drizzle/search';
import { handover, projects, tasks } from '@drizzle/schemas/project.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, exists, getTableColumns, ilike, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type { IHandoverRepository, TBastData, TBastPaginationRequest, TBastRow } from '../contracts/handover.repository.interface';

/** Drizzle implementation of {@link IHandoverRepository}. */
@injectable()
export class HandoverRepository implements IHandoverRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	list(projectId: string) {
		return this.database
			.select()
			.from(handover)
			.where(and(eq(handover.projectId, projectId), isNull(handover.deletedAt)))
			.orderBy(desc(handover.bastDate), desc(handover.createdAt));
	}

	/**
	 * Fetches one page of BASTs across the projects visible to the caller.
	 *
	 * @param request - Page settings, search term and the visibility filter
	 */
	async paginate(request: TBastPaginationRequest): Promise<TPaginationResult<TBastRow>> {
		const { search, involvedUserId } = request;
		const where = and(
			isNull(handover.deletedAt),
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
						ilike(handover.code, likePattern(search)),
						ilike(handover.firstPartyCompany, likePattern(search)),
						ilike(handover.workTitle, likePattern(search)),
						ilike(projects.code, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(handover)
			.innerJoin(projects, eq(projects.id, handover.projectId))
			.where(where);
		const data = await this.database
			.select({ ...getTableColumns(handover), projectCode: projects.code, customerName: projects.customerName })
			.from(handover)
			.innerJoin(projects, eq(projects.id, handover.projectId))
			.where(where)
			.orderBy(desc(handover.bastDate), desc(handover.createdAt))
			.limit(request.limit)
			.offset((request.page - 1) * request.limit);
		return paginationResult(request, total, data);
	}

	async find(projectId: string, handoverId: string) {
		const [row] = await this.database
			.select()
			.from(handover)
			.where(and(eq(handover.id, handoverId), eq(handover.projectId, projectId), isNull(handover.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(projectId: string, code: string, actorUserId: string, data: TBastData) {
		const now = new Date();
		const [row] = await this.database
			.insert(handover)
			.values({ ...data, projectId, code, createdBy: actorUserId, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(handoverId: string, data: TBastData) {
		const [row] = await this.database
			.update(handover)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(handover.id, handoverId), isNull(handover.deletedAt), eq(handover.status, 'issued')))
			.returning();
		return row ?? null;
	}

	async cancel(handoverId: string, actorUserId: string) {
		const now = new Date();
		const [row] = await this.database
			.update(handover)
			.set({ status: 'cancelled', cancelledBy: actorUserId, cancelledAt: now, updatedAt: now })
			.where(and(eq(handover.id, handoverId), isNull(handover.deletedAt), eq(handover.status, 'issued')))
			.returning();
		return row ?? null;
	}
}
