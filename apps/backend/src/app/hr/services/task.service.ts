import type { TEmployeeTaskSelect, TaskStatus } from '@drizzle/schemas/hr.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { HR_PEOPLE_SERVICE_TOKEN, TASK_REPOSITORY_TOKEN } from '../constants/di';
import type { THrScope, TTaskBody, TTaskListQuery } from '../contracts/hr-records.contract';
import type { ITaskRepository } from '../contracts/hr-records.repository.interface';
import { HrNotFoundError } from '../errors/hr.errors';
import { type HrPeopleService, personOf, type TPersonRef } from './people.service';

export type TTaskView = TEmployeeTaskSelect & { employee: TPersonRef | null };

/** Simple tasks given to employees outside projects (M08 stage 1). */
@injectable()
export class TaskService {
	constructor(
		@inject(TASK_REPOSITORY_TOKEN) private readonly repository: ITaskRepository,
		@inject(HR_PEOPLE_SERVICE_TOKEN) private readonly employees: Pick<HrPeopleService, 'require' | 'requireActive'>,
	) {}

	private async view(scope: THrScope, row: TEmployeeTaskSelect): Promise<TTaskView> {
		const employee = await this.employees.require(scope, row.employeeId).catch(() => null);
		return { ...row, employee: employee ? personOf(employee) : null };
	}

	/** The task, if its employee is visible to the caller. */
	private async requireTask(scope: THrScope, id: string): Promise<TEmployeeTaskSelect> {
		const current = await this.repository.findById(id);
		if (!current || !(await this.employees.require(scope, current.employeeId).catch(() => null))) throw new HrNotFoundError('task');
		return current;
	}

	async list(scope: THrScope, query: TTaskListQuery): Promise<TPaginationResult<TTaskView>> {
		const result = await this.repository.paginate(query, scope);
		return { meta: result.meta, data: await Promise.all(result.data.map((row) => this.view(scope, row))) };
	}

	async create(scope: THrScope, actorUserId: string, body: TTaskBody): Promise<TTaskView> {
		await this.employees.requireActive(scope, body.employeeId);
		return this.view(scope, await this.repository.create({ ...body, status: 'open', createdBy: actorUserId }));
	}

	async update(scope: THrScope, id: string, body: TTaskBody): Promise<TTaskView> {
		const current = await this.requireTask(scope, id);
		if (body.employeeId !== current.employeeId) await this.employees.requireActive(scope, body.employeeId);
		const updated = await this.repository.update(id, body);
		if (!updated) throw new HrNotFoundError('task');
		return this.view(scope, updated);
	}

	async setStatus(scope: THrScope, id: string, status: TaskStatus): Promise<TTaskView> {
		await this.requireTask(scope, id);
		const updated = await this.repository.update(id, { status, doneAt: status === 'done' ? new Date() : null });
		if (!updated) throw new HrNotFoundError('task');
		return this.view(scope, updated);
	}
}
