import type {
	ProjectStage,
	TaskStatus,
	TProjectCostInsert,
	TProjectCostSelect,
	TProjectEvidenceInsert,
	TProjectEvidenceSelect,
	TProjectInsert,
	TProjectSelect,
	TProjectTaskSelect,
} from '@drizzle/schemas/projects.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TProjectListQuery } from './project.contract';

export type TProjectCreateData = Omit<
	TProjectInsert,
	'id' | 'stage' | 'status' | 'closedBy' | 'closedAt' | 'cancelledBy' | 'cancelledAt' | 'cancelReason' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export type TTaskData = { title: string; stage: ProjectStage; assigneeUserId: string | null; dueDate: string | null };

export type TProjectHeaderData = Pick<
	TProjectInsert,
	'picUserId' | 'siteName' | 'targetStartDate' | 'targetEndDate' | 'stage' | 'notes'
>;

export type TProjectTransition =
	| { status: 'closed'; stage: 'warranty'; closedBy: string; closedAt: Date }
	| { status: 'cancelled'; cancelledBy: string; cancelledAt: Date; cancelReason: string };

export type TProjectPaginationRequest = TProjectListQuery & {
	/** Only projects this user leads or has a live task in. */
	involvedUserId?: string;
};

/**
 * Counts for the M01 dashboard.
 *
 * @remarks
 * `overdue` means an **active** project whose `target_end_date` is before
 * `today` (Jakarta business date). `byStage` counts active projects only, so
 * closed/cancelled projects never inflate a stage bar.
 */
export type TProjectStats = {
	active: number;
	closed: number;
	cancelled: number;
	overdue: number;
	byStage: Array<{ stage: ProjectStage; count: number }>;
};

/**
 * Persistence port for `projects.*` (live rows only). There are no foreign
 * keys inside the module (module-ownership §9): every child query is scoped
 * by its `project_id`, and status changes are guarded on `status = 'active'`
 * inside the update (`null` = the project was no longer active).
 */
export interface IProjectRepository {
	paginate(request: TProjectPaginationRequest): Promise<TPaginationResult<TProjectSelect>>;
	/**
	 * Dashboard counts over the same visibility rule as {@link paginate}:
	 * pass `involvedUserId` and only projects that user leads or has a live
	 * task in are counted.
	 */
	stats(request: { involvedUserId?: string; today: string }): Promise<TProjectStats>;
	findById(id: string): Promise<TProjectSelect | null>;
	/** Whether the user leads the project or has a live task in it. */
	isInvolved(projectId: string, userId: string): Promise<boolean>;
	findLiveBySalesOrder(salesOrderId: string): Promise<TProjectSelect | null>;
	/** Which of these orders already have a live project. */
	salesOrdersWithProject(salesOrderIds: string[]): Promise<Set<string>>;
	/** Inserts the project and its default tasks in one transaction. */
	create(data: TProjectCreateData, tasks: TTaskData[]): Promise<TProjectSelect>;
	update(id: string, data: TProjectHeaderData): Promise<TProjectSelect | null>;
	transition(id: string, data: TProjectTransition): Promise<TProjectSelect | null>;

	listTasks(projectId: string): Promise<TProjectTaskSelect[]>;
	findTask(projectId: string, taskId: string): Promise<TProjectTaskSelect | null>;
	addTask(projectId: string, actorUserId: string, data: TTaskData): Promise<TProjectTaskSelect>;
	updateTask(taskId: string, data: TTaskData): Promise<TProjectTaskSelect | null>;
	setTaskStatus(taskId: string, status: TaskStatus, actorUserId: string): Promise<TProjectTaskSelect | null>;
	removeTask(taskId: string, actorUserId: string): Promise<TProjectTaskSelect | null>;

	listEvidence(projectId: string): Promise<TProjectEvidenceSelect[]>;
	findEvidence(projectId: string, evidenceId: string): Promise<TProjectEvidenceSelect | null>;
	addEvidence(data: Omit<TProjectEvidenceInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'deletedBy'>): Promise<TProjectEvidenceSelect>;
	removeEvidence(evidenceId: string, actorUserId: string): Promise<TProjectEvidenceSelect | null>;

	listCosts(projectId: string): Promise<TProjectCostSelect[]>;
	addCost(
		data: Omit<TProjectCostInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'voidedBy' | 'voidedAt' | 'voidReason'>,
	): Promise<TProjectCostSelect>;
	/** Voids a valid cost of the project; `null` when missing or already voided. */
	voidCost(projectId: string, costId: string, actorUserId: string, reason: string): Promise<TProjectCostSelect | null>;
}
