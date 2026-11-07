import type { TLeaveRequestSelect, TLeaveTypeSelect, TOvertimeSelect } from '@drizzle/schemas/hr.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { ATTENDANCE_REPOSITORY_TOKEN, EMPLOYEE_SERVICE_TOKEN, LEAVE_REPOSITORY_TOKEN } from '../constants/di';
import type { TLeaveBody, TOvertimeBody, TRequestListQuery } from '../contracts/hr.contract';
import type { IAttendanceRepository, ILeaveRepository } from '../contracts/hr.repository.interface';
import { HrNotFoundError, LeaveInvalidError, RequestStateError, SelfDecisionError } from '../errors/hr.errors';
import { leaveDates, periodRange } from '../utils/hr';
import type { EmployeeService } from './employee.service';

export type TPersonRef = { id: string; employeeCode: string; fullName: string };
export type TLeaveView = TLeaveRequestSelect & { employee: TPersonRef | null; leaveType: Pick<TLeaveTypeSelect, 'id' | 'code' | 'name'> | null };
export type TOvertimeView = TOvertimeSelect & { employee: TPersonRef | null };
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
		@inject(EMPLOYEE_SERVICE_TOKEN) private readonly employees: Pick<EmployeeService, 'require' | 'requireActive'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
	) {}

	listTypes(includeInactive = false): Promise<TLeaveTypeSelect[]> {
		return this.repository.listTypes(includeInactive);
	}

	private async person(employeeId: string): Promise<TPersonRef | null> {
		const employee = await this.employees.require(employeeId).catch(() => null);
		return employee ? { id: employee.id, employeeCode: employee.employeeCode, fullName: employee.fullName } : null;
	}

	private async leaveView(row: TLeaveRequestSelect): Promise<TLeaveView> {
		const [employee, type] = await Promise.all([this.person(row.employeeId), this.repository.findType(row.leaveTypeId)]);
		return { ...row, employee, leaveType: type ? { id: type.id, code: type.code, name: type.name } : null };
	}

	// Leave -----------------------------------------------------------------

	async listLeave(query: TRequestListQuery): Promise<TPaginationResult<TLeaveView>> {
		const result = await this.repository.paginateLeave(query);
		return { meta: result.meta, data: await Promise.all(result.data.map((row) => this.leaveView(row))) };
	}

	/** Balances of the quota types for an employee and year. */
	async balances(employeeId: string, year: number): Promise<TLeaveBalance[]> {
		await this.employees.require(employeeId);
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

	async createLeave(actorUserId: string, body: TLeaveBody): Promise<TLeaveView> {
		await this.employees.requireActive(body.employeeId);
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
		return this.leaveView(created);
	}

	private async requireLeave(id: string): Promise<TLeaveRequestSelect> {
		const row = await this.repository.findLeave(id);
		if (!row) throw new HrNotFoundError('leave');
		return row;
	}

	/** Approves and writes the attendance days in one transaction. */
	async approveLeave(actorUserId: string, id: string, note: string | null): Promise<TLeaveView> {
		const current = await this.requireLeave(id);
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
		return this.leaveView(await this.requireLeave(id));
	}

	async rejectLeave(actorUserId: string, id: string, note: string | null): Promise<TLeaveView> {
		const current = await this.requireLeave(id);
		if (current.recordedBy === actorUserId) throw new SelfDecisionError();
		const rejected = await this.repository.transitionLeave(id, ['submitted'], {
			status: 'rejected',
			decidedBy: actorUserId,
			decidedAt: new Date(),
			decisionNote: note,
		});
		if (!rejected) throw new RequestStateError('decide');
		return this.leaveView(rejected);
	}

	/** Cancels a submitted or approved leave; an approved one gives its days back. */
	async cancelLeave(actorUserId: string, id: string, note: string | null): Promise<TLeaveView> {
		await this.requireLeave(id);
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
		return this.leaveView(await this.requireLeave(id));
	}

	// Overtime ----------------------------------------------------------------

	private async overtimeView(row: TOvertimeSelect): Promise<TOvertimeView> {
		return { ...row, employee: await this.person(row.employeeId) };
	}

	async listOvertime(query: TRequestListQuery): Promise<TPaginationResult<TOvertimeView>> {
		const result = await this.repository.paginateOvertime(query);
		return { meta: result.meta, data: await Promise.all(result.data.map((row) => this.overtimeView(row))) };
	}

	/** Approved overtime hours per employee in a month (for the salary summary). */
	approvedHours(period: string): Promise<{ employeeId: string; hours: number }[]> {
		const { start, end } = periodRange(period);
		return this.repository.approvedHours(start, end);
	}

	async createOvertime(actorUserId: string, body: TOvertimeBody): Promise<TOvertimeView> {
		await this.employees.requireActive(body.employeeId);
		const created = await this.repository.createOvertime({
			...body,
			hours: body.hours.toFixed(2),
			status: 'submitted',
			recordedBy: actorUserId,
		});
		return this.overtimeView(created);
	}

	private async decideOvertime(actorUserId: string, id: string, status: 'approved' | 'rejected', note: string | null) {
		const current = await this.repository.findOvertime(id);
		if (!current) throw new HrNotFoundError('overtime');
		if (current.recordedBy === actorUserId) throw new SelfDecisionError();
		const decided = await this.repository.transitionOvertime(id, ['submitted'], {
			status,
			decidedBy: actorUserId,
			decidedAt: new Date(),
			decisionNote: note,
		});
		if (!decided) throw new RequestStateError('decide');
		return this.overtimeView(decided);
	}

	approveOvertime(actorUserId: string, id: string, note: string | null) {
		return this.decideOvertime(actorUserId, id, 'approved', note);
	}

	rejectOvertime(actorUserId: string, id: string, note: string | null) {
		return this.decideOvertime(actorUserId, id, 'rejected', note);
	}

	async cancelOvertime(actorUserId: string, id: string, note: string | null): Promise<TOvertimeView> {
		if (!(await this.repository.findOvertime(id))) throw new HrNotFoundError('overtime');
		const cancelled = await this.repository.transitionOvertime(id, ['submitted', 'approved'], {
			status: 'cancelled',
			decidedBy: actorUserId,
			decidedAt: new Date(),
			decisionNote: note,
		});
		if (!cancelled) throw new RequestStateError('cancel');
		return this.overtimeView(cancelled);
	}
}
