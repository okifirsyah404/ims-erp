import { NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import { isUniqueViolation } from '@drizzle/errors';
import type { TBankAccountSelect, TEmployeeSelect } from '@drizzle/schemas/hr.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../constants/di';
import type { TBankAccountBody, TEmployeeBody, TEmployeeListQuery } from '../contracts/hr.contract';
import type { IEmployeeRepository } from '../contracts/hr.repository.interface';
import { EmployeeConflictError, EmployeeStateError, HrNotFoundError } from '../errors/hr.errors';
import { maskTail } from '../utils/hr';

/** Server-derived caller context (see the controllers). */
export type THrContext = {
	actorUserId: string;
	/** `employee:read_private`: NIK, bank account and base salary unmasked. */
	canReadPrivate: boolean;
};

export type TEmployeeView = Omit<TEmployeeSelect, 'baseSalary'> & { baseSalary: number | null; masked: boolean };
export type TEmployeeDetail = TEmployeeView & {
	bankAccount: (Pick<TBankAccountSelect, 'bankName' | 'accountNumber' | 'accountHolder'> & { masked: boolean }) | null;
	login: { userId: string; name: string; email: string } | null;
};

/**
 * Employees (M08 stage 1, decisions of 2026-11-07).
 *
 * @remarks
 * Company-wide master (ADR-0012), numbered `EMP-####`. NIK, the bank account
 * and the base salary are personal data: callers without
 * `employee:read_private` get them masked (NIK, account) or hidden (salary).
 * Employees are never deleted; leaving makes them inactive and keeps their
 * attendance, leave and salary history.
 */
@injectable()
export class EmployeeService {
	constructor(
		@inject(EMPLOYEE_REPOSITORY_TOKEN) private readonly repository: IEmployeeRepository,
		@inject(NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<NumberingService, 'next'>,
		@inject(USER_SERVICE_TOKEN) private readonly users: Pick<UserService, 'getUser'>,
	) {}

	view(ctx: THrContext, employee: TEmployeeSelect): TEmployeeView {
		if (ctx.canReadPrivate) return { ...employee, masked: false };
		return { ...employee, nationalId: maskTail(employee.nationalId), baseSalary: null, masked: true };
	}

	async require(id: string): Promise<TEmployeeSelect> {
		const employee = await this.repository.findById(id);
		if (!employee) throw new HrNotFoundError('employee');
		return employee;
	}

	/** An employee that may get new attendance, leave, overtime, tasks or salary. */
	async requireActive(id: string): Promise<TEmployeeSelect> {
		const employee = await this.require(id);
		if (employee.employmentStatus !== 'active') throw new EmployeeStateError('inactive');
		return employee;
	}

	async list(ctx: THrContext, query: TEmployeeListQuery): Promise<TPaginationResult<TEmployeeView>> {
		const result = await this.repository.paginate(query);
		return { meta: result.meta, data: result.data.map((row) => this.view(ctx, row)) };
	}

	/** Active employees for pickers (no private data). */
	async listActive(): Promise<{ id: string; employeeCode: string; fullName: string; position: string | null }[]> {
		const rows = await this.repository.listActive();
		return rows.map(({ id, employeeCode, fullName, position }) => ({ id, employeeCode, fullName, position }));
	}

	listActiveRows(): Promise<TEmployeeSelect[]> {
		return this.repository.listActive();
	}

	findByCodes(codes: string[]): Promise<TEmployeeSelect[]> {
		return this.repository.findByCodes(codes);
	}

	async get(ctx: THrContext, id: string): Promise<TEmployeeDetail> {
		const employee = await this.require(id);
		const [bank, user] = await Promise.all([
			this.repository.findBank(id),
			employee.userId ? this.users.getUser(employee.userId) : null,
		]);
		return {
			...this.view(ctx, employee),
			bankAccount: bank
				? {
						bankName: bank.bankName,
						accountHolder: bank.accountHolder,
						accountNumber: ctx.canReadPrivate ? bank.accountNumber : (maskTail(bank.accountNumber) ?? ''),
						masked: !ctx.canReadPrivate,
					}
				: null,
			login: user ? { userId: user.id, name: user.name, email: user.email } : null,
		};
	}

	private async assertLogin(userId: string | null) {
		if (userId && !(await this.users.getUser(userId))) throw new EmployeeConflictError('userMissing');
	}

	private conflict(error: unknown): never {
		if (isUniqueViolation(error)) {
			// The violated index names the field (`employees_user_id_uq`).
			let constraint = '';
			for (let current: unknown = error, depth = 0; current && depth < 5; depth += 1) {
				constraint ||= String((current as { constraint?: unknown }).constraint ?? '');
				current = (current as { cause?: unknown }).cause;
			}
			throw new EmployeeConflictError(constraint.includes('user_id') ? 'userId' : 'nationalId');
		}
		throw error;
	}

	async create(ctx: THrContext, body: TEmployeeBody): Promise<TEmployeeDetail> {
		await this.assertLogin(body.userId);
		const employeeCode = await this.numbering.next('employee', { date: new Date() });
		try {
			const created = await this.repository.create({
				...body,
				// Without read_private the salary cannot be set (it cannot be seen).
				baseSalary: ctx.canReadPrivate ? body.baseSalary : 0,
				employeeCode,
				employmentStatus: 'active',
				createdBy: ctx.actorUserId,
			});
			return this.get(ctx, created.id);
		} catch (error) {
			this.conflict(error);
		}
	}

	async update(ctx: THrContext, id: string, body: TEmployeeBody): Promise<TEmployeeDetail> {
		const current = await this.require(id);
		await this.assertLogin(body.userId);
		try {
			await this.repository.update(id, {
				...body,
				// Masked values are never written back.
				nationalId: ctx.canReadPrivate ? body.nationalId : current.nationalId,
				baseSalary: ctx.canReadPrivate ? body.baseSalary : current.baseSalary,
			});
		} catch (error) {
			this.conflict(error);
		}
		return this.get(ctx, id);
	}

	async deactivate(ctx: THrContext, id: string, inactiveSince: string): Promise<TEmployeeDetail> {
		const current = await this.require(id);
		if (current.employmentStatus === 'inactive') throw new EmployeeStateError('alreadyInactive');
		await this.repository.update(id, { employmentStatus: 'inactive', inactiveSince });
		return this.get(ctx, id);
	}

	async reactivate(ctx: THrContext, id: string): Promise<TEmployeeDetail> {
		const current = await this.require(id);
		if (current.employmentStatus === 'active') throw new EmployeeStateError('alreadyActive');
		await this.repository.update(id, { employmentStatus: 'active', inactiveSince: null });
		return this.get(ctx, id);
	}

	/** Bank account changes need `employee:read_private` (enforced by the controller). */
	async saveBank(ctx: THrContext, id: string, body: TBankAccountBody): Promise<TEmployeeDetail> {
		await this.require(id);
		await this.repository.saveBank(id, body);
		return this.get(ctx, id);
	}
}
