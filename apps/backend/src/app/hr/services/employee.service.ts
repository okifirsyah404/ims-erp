import type { TEmployeeInsert, TEmployeeSelect } from '@drizzle/schemas/hr.schema';
import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import { USER_PERSONAL_FIELDS_PORT_TOKEN } from '@app/user/constants/di';
import type { IUserPersonalFieldsPort } from '@app/user/contracts/user-personal-fields.port';
import type { TUserPersonalFields, TUserPersonalFieldsPatch } from '@app/user/contracts/user-personal-fields.contract';
import { AppError } from '@http/errors';
import { EMPLOYEE_INVITE_SERVICE_TOKEN, EMPLOYEE_REPOSITORY_TOKEN } from '../constants/di';
import type { EmployeeInviteService } from './employee-invite.service';
import type { TCreateEmployee } from '../contracts/hr.contract';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';
import type {
	TEmployeeDto,
	TEmployeeListQuery,
	TEmployeePage,
	TEmployeePickerRow,
	TUpdateEmployee,
} from '../contracts/hr.contract';
import {
	CompanyEmployeeForbiddenError,
	EmployeeEmailTakenError,
	EmployeeInviteError,
	EmployeeNotFoundError,
} from '../errors/hr.errors';

/** Audit/actor context carried from the controller's `erp` guard. */
export type TEmployeeActor = {
	userId: string;
	email: string;
	ip?: string | null;
	userAgent?: string | null;
};

/** Who is calling: org-scoped member or a platform admin without an org. */
export type TEmployeeContext = {
	actor: TEmployeeActor;
	/** `null` for platform admins operating outside any organization. */
	organizationId: string | null;
	/** Platform admin bypasses the company-level management restriction. */
	isPlatformAdmin: boolean;
	/** Organization-level `employee:*` grant decided by `erpGuard`. */
	canManage: boolean;
};

import { jakartaDate, personalPatchFrom, toRow, withPersonalFields } from './employee.mappers';

/**
 * Employee master data (ERP-0034).
 *
 * @remarks
 * **Invite-first creation** (locked decision): every employee is born from
 * an invitation — `HrService.create` calls the user module's invitation
 * pipeline, which pre-creates the `auth.users` row, and stores the returned
 * user id as `hr.employees.user_id`. There is no employee without a login.
 *
 * **Company-level employees** (`organization_id IS NULL`) are a permanent,
 * valid state (ADR-0011 global master data pattern): every `employee:read`
 * holder sees them, and only platform admins (or owners) manage them.
 *
 * **Roles**: the employee row carries none. Permissions come exclusively
 * from the caller's Better Auth organization membership.
 */
@injectable()
export class EmployeeService {
	constructor(
		@inject(EMPLOYEE_REPOSITORY_TOKEN)
		private readonly repository: IEmployeeRepository,
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly numbering: CodeNumberService,
		@inject(USER_PERSONAL_FIELDS_PORT_TOKEN)
		private readonly personalFields: IUserPersonalFieldsPort,
		@inject(EMPLOYEE_INVITE_SERVICE_TOKEN)
		private readonly inviteService: EmployeeInviteService,
	) {}

	/**
	 * Lists employees visible to the caller: their organization's rows plus
	 * company-level rows (`organization_id IS NULL`).
	 */
	async list(ctx: TEmployeeContext, query: TEmployeeListQuery): Promise<TEmployeePage> {
		const organizationIds = ctx.organizationId ? [ctx.organizationId] : [];
		const page = await this.repository.list({
			...query,
			organizationIds,
			includeCompany: true,
		});
		const data = await Promise.all(page.data.map((row) => this.withPersonal(row)));
		return { meta: page.meta, data };
	}

	/** One employee; a non-admin only sees own-org or company-level rows. */
	async get(ctx: TEmployeeContext, id: string): Promise<TEmployeeDto> {
		const row = await this.repository.findById(id);
		if (!row) throw new EmployeeNotFoundError();
		if (
			row.organizationId !== null &&
			row.organizationId !== ctx.organizationId &&
			!ctx.isPlatformAdmin
		) {
			throw new EmployeeNotFoundError();
		}
		return this.withPersonal(row);
	}

	/** Joins personal fields from `auth.users` onto an employee row. */
	private withPersonal(row: TEmployeeSelect): Promise<TEmployeeDto> {
		return withPersonalFields(this.personalFields, row);
	}

	/**
	 * Invite-first creation: one step that (1) resolves the target org,
	 * (2) reserves the employee code, (3) runs the invitation pipeline
	 * (pre-creating the user), and (4) inserts the employee row linked to
	 * the pre-created user.
	 *
	 * @remarks
	 * The invitation pre-creates the user even before the invite is claimed,
	 * so the employee record exists — with a responsible person reachable by
	 * email — from the moment the invite is sent.
	 */
	async create(
		ctx: TEmployeeContext,
		body: import('../contracts/hr.contract').TCreateEmployee,
	): Promise<TEmployeeDto> {
		const organizationId = body.organizationId ?? null;
		if (organizationId === null && !ctx.isPlatformAdmin) {
			throw new CompanyEmployeeForbiddenError();
		}
		if (
			organizationId !== null &&
			ctx.organizationId !== null &&
			organizationId !== ctx.organizationId
		) {
			// Org-scoped callers can only create employees in their own org.
			throw new CompanyEmployeeForbiddenError();
		}
		if (!body.email) {
			throw new EmployeeInviteError('An email is required to invite the employee');
		}
		if (await this.repository.findByEmail(body.email)) {
			throw new EmployeeEmailTakenError();
		}

		const employeeCode = body.employeeCode ?? (await this.nextCode());
		if (await this.repository.codeTaken(organizationId, employeeCode)) {
			throw new EmployeeEmailTakenError();
		}

		// Manager must exist and be visible to the caller's org (or company).
		if (body.managerEmployeeId) {
			const ok = await this.repository.managerExists(
				body.managerEmployeeId,
				organizationId,
			);
			if (!ok) throw new EmployeeNotFoundError();
		}

		// Invite and insert happen in EmployeeInviteService (owns rollback).
		return (await this.inviteService.invite(
			{
				email: body.email,
				name: body.fullName,
				organizationId: organizationId ?? undefined,
				organizationRoles: body.organizationRoles,
				employee: body,
			},
			{
				userId: ctx.actor.userId,
				email: ctx.actor.email,
				ip: ctx.actor.ip ?? undefined,
				userAgent: ctx.actor.userAgent ?? undefined,
			},
		)).employee;
	}

	/** Patch of mutable fields; identity columns (`user_id`, org) never change. */
	async update(
		ctx: TEmployeeContext,
		id: string,
		body: TUpdateEmployee,
	): Promise<TEmployeeDto> {
		const row = await this.repository.findById(id);
		if (!row) throw new EmployeeNotFoundError();
		if (row.organizationId === null && !ctx.isPlatformAdmin) {
			throw new CompanyEmployeeForbiddenError();
		}
		if (
			row.organizationId !== null &&
			ctx.organizationId !== null &&
			row.organizationId !== ctx.organizationId
		) {
			throw new EmployeeNotFoundError();
		}

		const employeeCode = body.employeeCode ?? undefined;
		if (employeeCode !== undefined && employeeCode !== null && (await this.repository.codeTaken(row.organizationId, employeeCode, id))) {
			throw new EmployeeEmailTakenError();
		}
		if (body.managerEmployeeId) {
			const ok = await this.repository.managerExists(body.managerEmployeeId, row.organizationId);
			if (!ok) throw new EmployeeNotFoundError();
		}

		const patch: Partial<TEmployeeInsert> = {
			...(body.employeeCode !== undefined && body.employeeCode !== null ? { employeeCode: body.employeeCode } : {}),
			...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
			...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
			...(body.nickname !== undefined ? { nickname: body.nickname } : {}),
			...(body.nationalId !== undefined ? { nationalId: body.nationalId } : {}),
			...(body.email !== undefined ? { email: body.email } : {}),
			...(body.phone !== undefined ? { phone: body.phone } : {}),
			...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp } : {}),
			...(body.employmentStatus !== undefined ? { employmentStatus: body.employmentStatus } : {}),
			...(body.employmentType !== undefined ? { employmentType: body.employmentType } : {}),
			...(body.workType !== undefined ? { workType: body.workType } : {}),
			...(body.hireDate !== undefined ? { hireDate: jakartaDate(body.hireDate) } : {}),
			...(body.terminationDate !== undefined ? { terminationDate: jakartaDate(body.terminationDate) } : {}),
			...(body.managerEmployeeId !== undefined ? { managerEmployeeId: body.managerEmployeeId } : {}),
		};
		const updated = await this.repository.update(id, patch);
		if (!updated) throw new EmployeeNotFoundError();
		if (row.userId) {
			await this.personalFields.update(row.userId, personalPatchFrom(body));
		}
		return this.withPersonal(updated);
	}

	/** Soft delete. Company-level rows need a platform admin. */
	async archive(ctx: TEmployeeContext, id: string): Promise<void> {
		const row = await this.repository.findById(id);
		if (!row) throw new EmployeeNotFoundError();
		if (row.organizationId === null && !ctx.isPlatformAdmin) {
			throw new CompanyEmployeeForbiddenError();
		}
		if (
			row.organizationId !== null &&
			ctx.organizationId !== null &&
			row.organizationId !== ctx.organizationId
		) {
			throw new EmployeeNotFoundError();
		}
		await this.repository.softDelete(id);
	}

	/**
	 * Warehouse PIC dropdown: candidates from the given linked orgs plus
	 * company-level employees.
	 */
	async picker(
		organizationIds: string[],
		search: string | undefined,
		limit: number,
	): Promise<TEmployeePickerRow[]> {
		return this.repository.picker(organizationIds, search, limit);
	}

	/** Reserves the next `EMP-xxxxx` from the shared numbering service. */
	private async nextCode(tx?: TTx): Promise<string> {
		return this.numbering.next('employee', { tx });
	}
}

export type { TEmployeeDto };
