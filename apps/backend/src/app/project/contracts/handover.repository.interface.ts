import type { TTx } from '@drizzle/types';
import type { THandoverInsert, THandoverSelect } from '@drizzle/schemas/project.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

export type TBastData = Omit<
	THandoverInsert,
	'id' | 'projectId' | 'code' | 'status' | 'createdBy' | 'cancelledBy' | 'cancelledAt' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** A BAST as listed across projects. */
export type TBastRow = THandoverSelect & { projectCode: string; customerName: string };

export type TBastPaginationRequest = TPaginationRequest & { search?: string; involvedUserId?: string };

/** Persistence port for BAST documents (`projects.project_handover`, live rows). */
export interface IHandoverRepository {
	/** Every BAST of a project (cancelled included), newest first. */
	list(projectId: string): Promise<THandoverSelect[]>;
	/** Fetches one page of BASTs across projects (only projects the user leads or works in, when given). */
	paginate(request: TBastPaginationRequest): Promise<TPaginationResult<TBastRow>>;
	find(projectId: string, handoverId: string): Promise<THandoverSelect | null>;
	/** `tx` joins the caller's transaction (number allocation, P7-5). */
	create(projectId: string, code: string, actorUserId: string, data: TBastData, tx?: TTx): Promise<THandoverSelect>;
	/** Updates an issued BAST; `null` when missing or cancelled. */
	update(handoverId: string, data: TBastData): Promise<THandoverSelect | null>;
	/** `issued → cancelled`; `null` when missing or already cancelled. */
	cancel(handoverId: string, actorUserId: string): Promise<THandoverSelect | null>;
}
