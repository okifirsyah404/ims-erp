import { inject, injectable } from 'tsyringe';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../constants/di';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';

/**
 * Cross-module export facade for the HR module.
 *
 * @remarks
 * Consumed by other modules (e.g. `WarehouseService` validating the
 * warehouse PIC) through {@link `EXPORTED_HR_SERVICE_TOKEN`}. It depends
 * only on the module's own repository so cross-module consumers cannot
 * create a service-to-service cycle (elysia-module rule 3.5).
 */
@injectable()
export class ExportedHrService {
	constructor(
		@inject(EMPLOYEE_REPOSITORY_TOKEN)
		private readonly repository: IEmployeeRepository,
	) {}

	/** Minimal snapshot for access/validity checks, or `null` when absent. */
	async findEmployeeById(
		id: string,
	): Promise<{ id: string; organizationId: string | null; employmentStatus: string } | null> {
		const row = await this.repository.findById(id);
		if (!row) return null;
		return {
			id: row.id,
			organizationId: row.organizationId,
			employmentStatus: row.employmentStatus,
		};
	}

	/** Same snapshot by login user id (one alive employee per user). */
	async findEmployeeByUserId(
		userId: string,
	): Promise<{ id: string; organizationId: string | null; employmentStatus: string } | null> {
		const row = await this.repository.findByUserId(userId);
		if (!row) return null;
		return {
			id: row.id,
			organizationId: row.organizationId,
			employmentStatus: row.employmentStatus,
		};
	}
}
