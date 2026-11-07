import type { TEmployeeTaskSelect, TaskStatus } from '@drizzle/schemas/hr.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { EMPLOYEE_SERVICE_TOKEN, TASK_REPOSITORY_TOKEN } from '../constants/di';
import type { TTaskBody, TTaskListQuery } from '../contracts/hr.contract';
import type { ITaskRepository } from '../contracts/hr.repository.interface';
import { HrNotFoundError } from '../errors/hr.errors';
import type { EmployeeService } from './employee.service';
import type { TPersonRef } from './leave.service';

export type TTaskView = TEmployeeTaskSelect & { employee: TPersonRef | null };

/** Simple tasks given to employees outside projects (M08 stage 1). */
@injectable()
export class TaskService {
	constructor(
		@inject(TASK_REPOSITORY_TOKEN) private readonly repository: ITaskRepository,
		@inject(EMPLOYEE_SERVICE_TOKEN) private readonly employees: Pick<EmployeeService, 'require' | 'requireActive'>,
	) {}

	private async view(row: TEmployeeTaskSelect): Promise<TTaskView> {
		const employee = await this.employees.require(row.employeeId).catch(() => null);
		return { ...row, employee: employee ? { id: employee.id, employeeCode: employee.employeeCode, fullName: employee.fullName } : null };
	}

	async list(query: TTaskListQuery): Promise<TPaginationResult<TTaskView>> {
		const result = await this.repository.paginate(query);
		return { meta: result.meta, data: await Promise.all(result.data.map((row) => this.view(row))) };
	}

	async create(actorUserId: string, body: TTaskBody): Promise<TTaskView> {
		await this.employees.requireActive(body.employeeId);
		return this.view(await this.repository.create({ ...body, status: 'open', createdBy: actorUserId }));
	}

	async update(id: string, body: TTaskBody): Promise<TTaskView> {
		const current = await this.repository.findById(id);
		if (!current) throw new HrNotFoundError('task');
		if (body.employeeId !== current.employeeId) await this.employees.requireActive(body.employeeId);
		const updated = await this.repository.update(id, body);
		if (!updated) throw new HrNotFoundError('task');
		return this.view(updated);
	}

	async setStatus(id: string, status: TaskStatus): Promise<TTaskView> {
		const updated = await this.repository.update(id, { status, doneAt: status === 'done' ? new Date() : null });
		if (!updated) throw new HrNotFoundError('task');
		return this.view(updated);
	}
}
