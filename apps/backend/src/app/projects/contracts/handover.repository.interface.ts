import type { TProjectHandoverInsert, TProjectHandoverSelect } from '@drizzle/schemas/projects.schema';
import type { TPaginationResult } from '@ims-erp/common';

export type TBastData = Omit<
	TProjectHandoverInsert,
	'id' | 'projectId' | 'code' | 'status' | 'createdBy' | 'cancelledBy' | 'cancelledAt' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** A BAST as listed across projects. */
export type TBastRow = TProjectHandoverSelect & { projectCode: string; customerName: string };

export type TBastListRequest = { page: number; limit: number; search?: string; involvedUserId?: string };

/** Persistence port for BAST documents (`projects.project_handover`, live rows). */
export interface IHandoverRepository {
	/** Every BAST of a project (cancelled included), newest first. */
	list(projectId: string): Promise<TProjectHandoverSelect[]>;
	/** BASTs of every project (only projects the user leads or works in, when given). */
	paginateAll(request: TBastListRequest): Promise<TPaginationResult<TBastRow>>;
	find(projectId: string, bastId: string): Promise<TProjectHandoverSelect | null>;
	create(projectId: string, code: string, actorUserId: string, data: TBastData): Promise<TProjectHandoverSelect>;
	/** Updates an issued BAST; `null` when missing or cancelled. */
	update(bastId: string, data: TBastData): Promise<TProjectHandoverSelect | null>;
	/** `issued → cancelled`; `null` when missing or already cancelled. */
	cancel(bastId: string, actorUserId: string): Promise<TProjectHandoverSelect | null>;
}
