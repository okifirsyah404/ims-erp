import type { TLeaveRequestSelect, TLeaveTypeSelect, TOvertimeRequestSelect } from '@drizzle/schemas/human-resource.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { ATTENDANCE_REPOSITORY_TOKEN, HR_PEOPLE_SERVICE_TOKEN, LEAVE_REPOSITORY_TOKEN } from '../constants/di';
import type { THrScope, TLeaveBody, TOvertimeBody, TRequestListQuery } from '../contracts/hr-records.contract';
import type { IAttendanceRepository, ILeaveRepository } from '../contracts/hr-records.repository.interface';
import { HrNotFoundError, LeaveInvalidError, RequestStateError, SelfDecisionError } from '../errors/hr.errors';
import { leaveDates, periodRange } from '../utils/hr';
import { type HrPeopleService, personOf, type TPersonRef } from './people.service';

export type { TPersonRef };
export type TLeaveView = TLeaveRequestSelect & { employee: TPersonRef | null; leaveType: Pick<TLeaveTypeSelect, 'id' | 'code' | 'name'> | null };
export type TOvertimeView = TOvertimeRequestSelect & { employee: TPersonRef | null };
export type TLeaveBalance = {
	leaveType: Pick<TLeaveTypeSelect, 'id' | 'code' | 'name' | 'annualQuotaDays'>;
	year: number;
	approved: number;
	pending: number;
	remaining: number;
};

/**
 * Leave and overtime (M08 stage 1, decisions of 2026-11-07).
 *
 * @remarks
 * HR records requests on the employee's behalf; someone else approves or
 * rejects them. Leave days are the dates of the range except Sundays. A
 * quota type (annual leave, 12 days by default) refuses a request beyond
 * the year's balance, counting pending requests too. Approving a leave
 * writes its days as attendance in the same transaction; cancelling an
 * approved leave removes them.
 */
@injectable()
export class LeaveService {
	constructor(
		@inject(LEAVE_REPOSITORY_TOKEN) private readonly repository: ILeaveRepository,
		@inject(ATTENDANCE_REPOSITORY_TOKEN) private readonly attendance: Pick<IAttendanceRepository, 'upsertMany' | 'removeForLeave'>,
		@inject(HR_PEOPLE_SERVICE_TOKEN) private readonly employees: Pick<HrPeopleService, 'require' | 'requireActive' | 'listVisible'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
	) {}

	listTypes(includeInactive = false): Promise<TLeaveTypeSelect[]> {
		return this.repository.listTypes(includeInactive);
	}

	/** Names of the visible employees, for list views. */
	private async people(scope: THrScope): Promise<Map<string, TPersonRef>> {
		return new Map((await this.employees.listVisible(scope)).map((employee) => [employee.id, personOf(employee)]));
	}

	private async person(scope: THrScope, employeeId: string): Promise<TPersonRef | null> {
		const employee = await this.employees.require(scope, employeeId).catch(() => null);
		return employee ? personOf(employee) : null;
	}

	private async leaveView(scope: THrScope, row: TLeaveRequestSelect, people?: Map<string, TPersonRef>): Promise<TLeaveView> {
		const [employee, type] = await Promise.all([
			people ? (people.get(row.employeeId) ?? null) : this.person(scope, row.employeeId),
			this.repository.findType(row.leaveTypeId),
		]);
		return { ...row, employee, leaveType: type ? { id: type.id, code: type.code, name: type.name } : null };
	}

	// Leave -----------------------------------------------------------------

	async listLeave(scope: THrScope, query: TRequestListQuery): Promise<TPaginationResult<TLeaveView>> {
		const [result, people] = await Promise.all([this.repository.paginateLeave(query, scope), this.people(scope)]);
		return { meta: result.meta, data: await Promise.all(result.data.map((row) => this.leaveView(scope, row, people))) };
	}

	/** Balances of the quota types for an employee and year. */
	async balances(scope: THrScope, employeeId: string, year: number): Promise<TLeaveBalance[]> {
		await this.employees.require(scope, employeeId);
		const types = (await this.repository.listTypes(false)).filter((type) => type.usesQuota);
		return Promise.all(
			types.map(async (type) => {
				const used = await this.repository.usedDays(employeeId, type.id, year);
				return {
					leaveType: { id: type.id, code: type.code, name: type.name, annualQuotaDays: type.annualQuotaDays },
					year,
					...used,
					remaining: type.annualQuotaDays - used.approved - used.pending,
				};
			}),
		);
	}

	private async assertQuota(type: TLeaveTypeSelect, employeeId: string, startDate: string, days: number, excludeId?: string) {
		if (!type.usesQuota) return;
		const year = Number(startDate.slice(0, 4));
		const used = await this.repository.usedDays(employeeId, type.id, year, excludeId);
		const remaining = type.annualQuotaDays - used.approved - used.pending;
		if (days > remaining) throw new LeaveInvalidError('quota', { remaining: Math.max(0, remaining), requested: days });
	}

	async createLeave(scope: THrScope, actorUserId: string, body: TLeaveBody): Promise<TLeaveView> {
		await this.employees.requireActive(scope, body.employeeId);
		const type = await this.repository.findType(body.leaveTypeId);
		if (!type) throw new HrNotFoundError('leaveType');
		if (!type.isActive) throw new LeaveInvalidError('typeInactive');
		if (body.endDate < body.startDate) throw new LeaveInvalidError('dates');
		const days = leaveDates(body.startDate, body.endDate).length;
		if (days === 0) throw new LeaveInvalidError('noWorkingDays');
		if ((await this.repository.overlapping(body.employeeId, body.startDate, body.endDate)).length > 0) {
			throw new LeaveInvalidError('overlap');
		}
		await this.assertQuota(type, body.employeeId, body.startDate, days);
		const created = await this.repository.createLeave({ ...body, days, status: 'submitted', recordedBy: actorUserId });
		return this.leaveView(scope, created);
	}

	/**
	 * Edits a request that is still `submitted`: the same checks as creation,
	 * with this request left out of the overlap and quota counts.
	 */
	async updateLeave(scope: THrScope, id: string, body: TLeaveBody): Promise<TLeaveView> {
		const current = await this.requireLeave(scope, id);
		if (current.status !== 'submitted') throw new RequestStateError('edit');
		if (body.employeeId !== current.employeeId) await this.employees.requireActive(scope, body.employeeId);
		const type = await this.repository.findType(body.leaveTypeId);
		if (!type) throw new HrNotFoundError('leaveType');
		if (!type.isActive && type.id !== current.leaveTypeId) throw new LeaveInvalidError('typeInactive');
		if (body.endDate < body.startDate) throw new LeaveInvalidError('dates');
		const days = leaveDates(body.startDate, body.endDate).length;
		if (days === 0) throw new LeaveInvalidError('noWorkingDays');
		if ((await this.repository.overlapping(body.employeeId, body.startDate, body.endDate, id)).length > 0) {
			throw new LeaveInvalidError('overlap');
		}
		await this.assertQuota(type, body.employeeId, body.startDate, days, id);
		const updated = await this.repository.transitionLeave(id, ['submitted'], { ...body, days });
		if (!updated) throw new RequestStateError('edit');
		return this.leaveView(scope, updated);
	}

	/** The request, if its employee is visible to the caller. */
	private async requireLeave(scope: THrScope, id: string): Promise<TLeaveRequestSelect> {
		const row = await this.repository.findLeave(id);
		if (!row || !(await this.person(scope, row.employeeId))) throw new HrNotFoundError('leave');
		return row;
	}

	/** Approves and writes the attendance days in one transaction. */
	async approveLeave(scope: THrScope, actorUserId: string, id: string, note: string | null): Promise<TLeaveView> {
		const current = await this.requireLeave(scope, id);
		if (current.status !== 'submitted') throw new RequestStateError('decide');
		if (current.recordedBy === actorUserId) throw new SelfDecisionError();
		const type = await this.repository.findType(current.leaveTypeId);
		if (!type) throw new HrNotFoundError('leaveType');
		await this.transactions.run(async (tx) => {
			const approved = await this.repository.transitionLeave(
				id,
				['submitted'],
				{ status: 'approved', decidedBy: actorUserId, decidedAt: new Date(), decisionNote: note },
				tx,
			);
			if (!approved) throw new RequestStateError('decide');
			await this.attendance.upsertMany(
				leaveDates(current.startDate, current.endDate).map((date) => ({
					employeeId: current.employeeId,
					attendanceDate: date,
					status: type.attendanceStatus,
					checkInAt: null,
					checkOutAt: null,
					source: 'leave',
					leaveRequestId: id,
					notes: type.name,
					recordedBy: actorUserId,
				})),
				tx,
			);
		});
		return this.leaveView(scope, await this.requireLeave(scope, id));
	}

	async rejectLeave(scope: THrScope, actorUserId: string, id: string, note: string | null): Promise<TLeaveView> {
		const current = await this.requireLeave(scope, id);
		if (current.recordedBy === actorUserId) throw new SelfDecisionError();
		const rejected = await this.repository.transitionLeave(id, ['submitted'], {
			status: 'rejected',
			decidedBy: actorUserId,
			decidedAt: new Date(),
			decisionNote: note,
		});
		if (!rejected) throw new RequestStateError('decide');
		return this.leaveView(scope, rejected);
	}

	/** Cancels a submitted or approved leave; an approved one gives its days back. */
	async cancelLeave(scope: THrScope, actorUserId: string, id: string, note: string | null): Promise<TLeaveView> {
		await this.requireLeave(scope, id);
		await this.transactions.run(async (tx) => {
			const cancelled = await this.repository.transitionLeave(
				id,
				['submitted', 'approved'],
				{ status: 'cancelled', decidedBy: actorUserId, decidedAt: new Date(), decisionNote: note },
				tx,
			);
			if (!cancelled) throw new RequestStateError('cancel');
			await this.attendance.removeForLeave(id, tx);
		});
		return this.leaveView(scope, await this.requireLeave(scope, id));
	}

	// Overtime ----------------------------------------------------------------

	private async overtimeView(scope: THrScope, row: TOvertimeRequestSelect): Promise<TOvertimeView> {
		return { ...row, employee: await this.person(scope, row.employeeId) };
	}

	async listOvertime(scope: THrScope, query: TRequestListQuery): Promise<TPaginationResult<TOvertimeView>> {
		const [result, people] = await Promise.all([this.repository.paginateOvertime(query, scope), this.people(scope)]);
		return { meta: result.meta, data: result.data.map((row) => ({ ...row, employee: people.get(row.employeeId) ?? null })) };
	}

	/** The overtime record, if its employee is visible to the caller. */
	private async requireOvertime(scope: THrScope, id: string): Promise<TOvertimeRequestSelect> {
		const row = await this.repository.findOvertime(id);
		if (!row || !(await this.person(scope, row.employeeId))) throw new HrNotFoundError('overtime');
		return row;
	}

	/** Approved overtime hours per employee in a month (for the salary summary). */
	approvedHours(period: string): Promise<{ employeeId: string; hours: number }[]> {
		const { start, end } = periodRange(period);
		return this.repository.approvedHours(start, end);
	}

	async createOvertime(scope: THrScope, actorUserId: string, body: TOvertimeBody): Promise<TOvertimeView> {
		await this.employees.requireActive(scope, body.employeeId);
		const created = await this.repository.createOvertime({
			...body,
			hours: body.hours.toFixed(2),
			status: 'submitted',
			recordedBy: actorUserId,
		});
		return this.overtimeView(scope, created);
	}

	/** Edits an overtime record that is still `submitted`. */
	async updateOvertime(scope: THrScope, id: string, body: TOvertimeBody): Promise<TOvertimeView> {
		const current = await this.requireOvertime(scope, id);
		if (current.status !== 'submitted') throw new RequestStateError('edit');
		if (body.employeeId !== current.employeeId) await this.employees.requireActive(scope, body.employeeId);
		const updated = await this.repository.transitionOvertime(id, ['submitted'], { ...body, hours: body.hours.toFixed(2) });
		if (!updated) throw new RequestStateError('edit');
		return this.overtimeView(scope, updated);
	}

	private async decideOvertime(scope: THrScope, actorUserId: string, id: string, status: 'approved' | 'rejected', note: string | null) {
		const current = await this.requireOvertime(scope, id);
		if (current.recordedBy === actorUserId) throw new SelfDecisionError();
		const decided = await this.repository.transitionOvertime(id, ['submitted'], {
			status,
			decidedBy: actorUserId,
			decidedAt: new Date(),
			decisionNote: note,
		});
		if (!decided) throw new RequestStateError('decide');
		return this.overtimeView(scope, decided);
	}

	approveOvertime(scope: THrScope, actorUserId: string, id: string, note: string | null) {
		return this.decideOvertime(scope, actorUserId, id, 'approved', note);
	}

	rejectOvertime(scope: THrScope, actorUserId: string, id: string, note: string | null) {
		return this.decideOvertime(scope, actorUserId, id, 'rejected', note);
	}

	async cancelOvertime(scope: THrScope, actorUserId: string, id: string, note: string | null): Promise<TOvertimeView> {
		await this.requireOvertime(scope, id);
		const cancelled = await this.repository.transitionOvertime(id, ['submitted', 'approved'], {
			status: 'cancelled',
			decidedBy: actorUserId,
			decidedAt: new Date(),
			decisionNote: note,
		});
		if (!cancelled) throw new RequestStateError('cancel');
		return this.overtimeView(scope, cancelled);
	}
}
