import type { TEmployeeInsert, TEmployeeSelect } from '@drizzle/schemas/hr.schema';
import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import { NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import { INVITATION_SERVICE_TOKEN } from '@app/user/constants/di';
import type { InvitationService } from '@app/user/services/invitation.service';
import { AppError } from '@http/errors';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../constants/di';
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

/** Parses a `YYYY-MM-DD` business date into the instant at Jakarta midnight. */
function jakartaDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	return new Date(`${value}T00:00:00+07:00`);
}

/** Strips the invite-only fields from the API body into a DB insert shape. */
function toRow(body: {
	fullName: string;
	legalName?: string | null;
	nickname?: string | null;
	gender?: 'male' | 'female' | null;
	birthDate?: string | null;
	birthPlace?: string | null;
	nationalId?: string | null;
	maritalStatus?: string | null;
	email?: string | null;
	phone?: string | null;
	whatsapp?: string | null;
	employmentStatus?: string;
	employmentType?: string;
	workType?: string;
	hireDate?: string | null;
	terminationDate?: string | null;
	managerEmployeeId?: string | null;
}): Omit<TEmployeeInsert, 'employeeCode' | 'createdAt'> {
	return {
		fullName: body.fullName,
		legalName: body.legalName ?? null,
		nickname: body.nickname ?? null,
		gender: body.gender ?? null,
		birthDate: jakartaDate(body.birthDate),
		birthPlace: body.birthPlace ?? null,
		nationalId: body.nationalId ?? null,
		maritalStatus: body.maritalStatus ?? null,
		email: body.email ?? null,
		phone: body.phone ?? null,
		whatsapp: body.whatsapp ?? null,
		employmentStatus: body.employmentStatus,
		employmentType: body.employmentType,
		workType: body.workType,
		hireDate: jakartaDate(body.hireDate),
		terminationDate: jakartaDate(body.terminationDate),
		managerEmployeeId: body.managerEmployeeId ?? null,
	};
}

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
		@inject(INVITATION_SERVICE_TOKEN)
		private readonly invitations: InvitationService,
		@inject(NUMBERING_SERVICE_TOKEN)
		private readonly numbering: NumberingService,
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
		return { meta: page.meta, data: page.data.map(toDto) };
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
		return toDto(row);
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

		// Invitation pipeline (user module): pre-creates the user row.
		let userId: string;
		try {
			const result = await this.invitations.invite(
				{
					email: body.email,
					name: body.fullName,
					organizationId: organizationId ?? undefined,
					organizationRole: organizationId ? (body.organizationRole ?? 'member') : undefined,
				},
				{
					userId: ctx.actor.userId,
					email: ctx.actor.email,
					ip: ctx.actor.ip ?? undefined,
					userAgent: ctx.actor.userAgent ?? undefined,
				},
			);
			userId = result.userId;
		} catch (error) {
			if (error instanceof AppError) {
				throw new EmployeeInviteError(error.message);
			}
			throw error;
		}

		const row = await this.repository.insert({
			...toRow(body),
			employmentStatus: body.employmentStatus,
			employmentType: body.employmentType,
			workType: body.workType,
			employeeCode,
			organizationId,
			userId,
			createdAt: new Date(),
		});
		return toDto(row);
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
			...(body.gender !== undefined ? { gender: body.gender } : {}),
			...(body.birthDate !== undefined ? { birthDate: jakartaDate(body.birthDate) } : {}),
			...(body.birthPlace !== undefined ? { birthPlace: body.birthPlace } : {}),
			...(body.nationalId !== undefined ? { nationalId: body.nationalId } : {}),
			...(body.maritalStatus !== undefined ? { maritalStatus: body.maritalStatus } : {}),
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
		return toDto(updated);
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

/** Select row → API DTO (instants already serialize as ISO through JSON). */
function toDto(row: TEmployeeSelect): TEmployeeDto {
	return row as unknown as TEmployeeDto;
}

export type { TEmployeeDto };
