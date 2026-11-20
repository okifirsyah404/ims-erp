import type { TEmployeeInsert, TEmployeeSelect } from '@drizzle/schemas/human-resource.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TEmployeePickerRow, TEmployeePaginationRequest } from './hr.contract';

/**
 * Persistence port of `hr.employees`.
 *
 * @remarks
 * All queries filter `deleted_at IS NULL`; soft delete/restore is a plain
 * timestamp write. Cross-module integrity (organization/user existence) is
 * the service layer's job, per elysia-module rule 3.2.
 */
export interface IEmployeeRepository {
	/** Fetches one page of employees. Scope filtering (`organization`/`company`) is the caller's. */
	paginate(
		request: TEmployeePaginationRequest,
	): Promise<TPaginationResult<TEmployeeSelect>>;

	findById(id: string, tx?: TTx): Promise<TEmployeeSelect | null>;

	/** Alive employee linked to a login user, if any. */
	findByUserId(userId: string, tx?: TTx): Promise<TEmployeeSelect | null>;

	findByEmail(email: string, tx?: TTx): Promise<TEmployeeSelect | null>;

	/** Whether another alive employee already holds this code in the org. */
	codeTaken(
		organizationId: string | null,
		employeeCode: string,
		excludeId?: string,
	): Promise<boolean>;

	/** Manager must be an alive employee (optionally of the same org). */
	managerExists(id: string, organizationId: string | null): Promise<boolean>;

	insert(data: TEmployeeInsert, tx?: TTx): Promise<TEmployeeSelect>;

	update(
		id: string,
		data: Partial<TEmployeeInsert>,
		tx?: TTx,
	): Promise<TEmployeeSelect | null>;

	softDelete(id: string, tx?: TTx): Promise<void>;

	/** Picker rows for the warehouse PIC dropdown (org ids + company-level). */
	picker(
		organizationIds: string[],
		search: string | undefined,
		limit: number,
	): Promise<TEmployeePickerRow[]>;
}
