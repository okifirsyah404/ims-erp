import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import { likePattern } from '@drizzle/search';
import {
	type TaskStatus,
	PROJECT_STAGES,
	costs,
	evidence,
	projects,
	tasks,
} from '@drizzle/schemas/project.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { and, asc, count, desc, eq, exists, ilike, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IProjectRepository,
	TProjectCreateData,
	TProjectHeaderData,
	TProjectPaginationRequest,
	TProjectStats,
	TProjectTransition,
	TTaskData,
} from '../contracts/project.repository.interface';

/** Drizzle implementation of {@link IProjectRepository}. */
@injectable()
export class ProjectRepository implements IProjectRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(projects.id, id), isNull(projects.deletedAt));
	}

	/** The user leads the project or has a live task in it. */
	private involved(userId: string) {
		return or(
			eq(projects.picUserId, userId),
			exists(
				this.database
					.select({ id: tasks.id })
					.from(tasks)
					.where(
						and(
							eq(tasks.projectId, projects.id),
							eq(tasks.assigneeUserId, userId),
							isNull(tasks.deletedAt),
						),
					),
			),
		);
	}

	async paginate(request: TProjectPaginationRequest): Promise<TPaginationResult<(typeof projects.$inferSelect)>> {
		const { page, limit, search, status, stage, involvedUserId } = request;
		const where = and(
			isNull(projects.deletedAt),
			status ? eq(projects.status, status) : undefined,
			stage ? eq(projects.stage, stage) : undefined,
			involvedUserId ? this.involved(involvedUserId) : undefined,
			search
				? or(
						ilike(projects.code, likePattern(search)),
						ilike(projects.title, likePattern(search)),
						ilike(projects.customerName, likePattern(search)),
						ilike(projects.orderCode, likePattern(search)),
						ilike(projects.siteName, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(projects).where(where);
		const data = await this.database
			.select()
			.from(projects)
			.where(where)
			.orderBy(desc(projects.createdAt), desc(projects.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async listByCustomer(customerId: string) {
		return this.database
			.select()
			.from(projects)
			.where(and(eq(projects.customerId, customerId), isNull(projects.deletedAt), ne(projects.status, 'cancelled')))
			.orderBy(desc(projects.createdAt), desc(projects.id))
			.limit(100);
	}

	async findById(id: string) {
		const [row] = await this.database.select().from(projects).where(this.live(id)).limit(1);
		return row ?? null;
	}

	async stats(request: { involvedUserId?: string; today: string }): Promise<TProjectStats> {
		const visible = and(
			isNull(projects.deletedAt),
			request.involvedUserId ? this.involved(request.involvedUserId) : undefined,
		);
		const [byStatus, byStage, [overdueRow]] = await Promise.all([
			this.database
				.select({ status: projects.status, value: count() })
				.from(projects)
				.where(visible)
				.groupBy(projects.status),
			this.database
				.select({ stage: projects.stage, value: count() })
				.from(projects)
				.where(and(visible, eq(projects.status, 'active')))
				.groupBy(projects.stage),
			this.database
				.select({ value: count() })
				.from(projects)
				.where(
					and(
						visible,
						eq(projects.status, 'active'),
						lt(projects.targetEndDate, request.today),
					),
				),
		]);
		const statusCount = (status: string) =>
			byStatus.find((row) => row.status === status)?.value ?? 0;
		const stageCount = (stage: string) =>
			byStage.find((row) => row.stage === stage)?.value ?? 0;
		return {
			active: statusCount('active'),
			closed: statusCount('closed'),
			cancelled: statusCount('cancelled'),
			overdue: overdueRow?.value ?? 0,
			// Zero-filled so the chart's stage axis never changes shape.
			byStage: PROJECT_STAGES.map((stage) => ({ stage, count: stageCount(stage) })),
		};
	}

	async isInvolved(projectId: string, userId: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: projects.id })
			.from(projects)
			.where(and(this.live(projectId), this.involved(userId)))
			.limit(1);
		return !!row;
	}

	async findLiveBySalesOrder(orderId: string) {
		const [row] = await this.database
			.select()
			.from(projects)
			.where(and(eq(projects.orderId, orderId), isNull(projects.deletedAt), ne(projects.status, 'cancelled')))
			.limit(1);
		return row ?? null;
	}

	async salesOrdersWithProject(salesOrderIds: string[]): Promise<Set<string>> {
		if (salesOrderIds.length === 0) return new Set();
		const rows = await this.database
			.select({ id: projects.orderId })
			.from(projects)
			.where(and(inArray(projects.orderId, salesOrderIds), isNull(projects.deletedAt), ne(projects.status, 'cancelled')));
		// ADR-0014: orderId is nullable; a project without an order links to none.
		const ids = new Set<string>();
		for (const row of rows) {
			if (row.id !== null) ids.add(row.id);
		}
		return ids;
	}

	create(data: TProjectCreateData, taskRows: TTaskData[], outer?: TTx) {
		return (outer ?? this.database).transaction(async (tx) => {
			const now = new Date();
			const [project] = await tx
				.insert(projects)
				.values({ ...data, createdAt: now, updatedAt: now })
				.returning();
			if (taskRows.length > 0) {
				await tx.insert(tasks).values(
					taskRows.map((task, position) => ({
						...task,
						projectId: project.id,
						position,
						createdBy: data.createdBy,
						createdAt: now,
						updatedAt: now,
					})),
				);
			}
			return project;
		});
	}

	async update(id: string, data: TProjectHeaderData) {
		const [row] = await this.database
			.update(projects)
			.set({ ...data, updatedAt: new Date() })
			.where(and(this.live(id), eq(projects.status, 'active')))
			.returning();
		return row ?? null;
	}

	async transition(id: string, data: TProjectTransition) {
		const [row] = await this.database
			.update(projects)
			.set({ ...data, updatedAt: new Date() })
			.where(and(this.live(id), eq(projects.status, 'active')))
			.returning();
		return row ?? null;
	}

	// Tasks ------------------------------------------------------------------

	listTasks(projectId: string) {
		return this.database
			.select()
			.from(tasks)
			.where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
			.orderBy(asc(tasks.position), asc(tasks.id));
	}

	async findTask(projectId: string, taskId: string) {
		const [row] = await this.database
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async addTask(projectId: string, actorUserId: string, data: TTaskData) {
		const [{ next }] = await this.database
			.select({ next: sql<number>`coalesce(max(${tasks.position}) + 1, 0)` })
			.from(tasks)
			.where(eq(tasks.projectId, projectId));
		const now = new Date();
		const [row] = await this.database
			.insert(tasks)
			.values({ ...data, projectId, position: Number(next), createdBy: actorUserId, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async updateTask(taskId: string, data: TTaskData) {
		const [row] = await this.database
			.update(tasks)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
			.returning();
		return row ?? null;
	}

	async setTaskStatus(taskId: string, status: TaskStatus, actorUserId: string) {
		const done = status === 'done';
		const [row] = await this.database
			.update(tasks)
			.set({ status, doneBy: done ? actorUserId : null, doneAt: done ? new Date() : null, updatedAt: new Date() })
			.where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
			.returning();
		return row ?? null;
	}

	async removeTask(taskId: string, actorUserId: string) {
		const now = new Date();
		const [row] = await this.database
			.update(tasks)
			.set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now })
			.where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
			.returning();
		return row ?? null;
	}

	// Evidence ---------------------------------------------------------------

	listEvidence(projectId: string) {
		return this.database
			.select()
			.from(evidence)
			.where(and(eq(evidence.projectId, projectId), isNull(evidence.deletedAt)))
			.orderBy(desc(evidence.createdAt), desc(evidence.id));
	}

	async findEvidence(projectId: string, evidenceId: string) {
		const [row] = await this.database
			.select()
			.from(evidence)
			.where(and(eq(evidence.id, evidenceId), eq(evidence.projectId, projectId), isNull(evidence.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async addEvidence(data: Parameters<IProjectRepository['addEvidence']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(evidence)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async removeEvidence(evidenceId: string, actorUserId: string) {
		const now = new Date();
		const [row] = await this.database
			.update(evidence)
			.set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now })
			.where(and(eq(evidence.id, evidenceId), isNull(evidence.deletedAt)))
			.returning();
		return row ?? null;
	}

	// Costs ------------------------------------------------------------------

	listCosts(projectId: string) {
		return this.database
			.select()
			.from(costs)
			.where(and(eq(costs.projectId, projectId), isNull(costs.deletedAt)))
			.orderBy(desc(costs.costDate), desc(costs.id));
	}

	async addCost(data: Parameters<IProjectRepository['addCost']>[0], tx?: unknown) {
		const now = new Date();
		const [row] = await ((tx as TTx | undefined) ?? this.database)
			.insert(costs)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async voidCost(projectId: string, costId: string, actorUserId: string, reason: string, tx?: unknown) {
		const now = new Date();
		const [row] = await ((tx as TTx | undefined) ?? this.database)
			.update(costs)
			.set({ voidedBy: actorUserId, voidedAt: now, voidReason: reason, updatedAt: now })
			.where(
				and(
					eq(costs.id, costId),
					eq(costs.projectId, projectId),
					isNull(costs.deletedAt),
					isNull(costs.voidedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	async setCostJournal(costId: string, journalEntryId: string, tx?: unknown): Promise<void> {
		await ((tx as TTx | undefined) ?? this.database)
			.update(costs)
			.set({ journalEntryId, updatedAt: new Date() })
			.where(eq(costs.id, costId));
	}
}
