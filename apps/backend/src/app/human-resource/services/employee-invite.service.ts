import { inject, injectable } from 'tsyringe';
import {
	INVITATION_SERVICE_TOKEN,
} from '@app/user/constants/di';
import type {
	InvitationService,
	TActor,
	TBulkInviteResult,
	TInviteResult,
} from '@app/user/services/invitation.service';
import type { TCreateInvitationInput } from '@app/user/contracts/invitation.contract';
import { AppError } from '@http/errors';
import { HUMAN_RESOURCE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { HumanResourceNumberingService } from './human-resource-numbering.service';
import { USER_PERSONAL_FIELDS_PORT_TOKEN } from '@app/user/constants/di';
import type { IUserPersonalFieldsPort } from '@app/user/contracts/user-personal-fields.port';
import { EMPLOYEE_DOCUMENT_SERVICE_TOKEN, EMPLOYEE_REPOSITORY_TOKEN } from '../constants/di';
import type { EmployeeDocumentService } from './employee-document.service';
import type { TCreateEmployee } from '../contracts/hr.contract';
import { toRow, personalPatchFrom, withPersonalFields } from './employee.mappers';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';
import type { TEmployeeDto } from '../contracts/hr.contract';
import {
	EmployeeEmailTakenError,
	EmployeeInviteError,
} from '../errors/hr.errors';

/**
 * One invite row. The employee profile is optional: when absent, the
 * defaults are the invitation name plus the schema defaults, and the HR form
 * edits the rest later.
 */
export type TInviteEmployeeRow = TCreateInvitationInput & {
	employee?: Partial<TCreateEmployee>;
};

/** Defaults for an invite-created employee (ERP-0034). */
function defaultProfile(row: TInviteEmployeeRow): TCreateEmployee {
	return {
		fullName: row.name,
		// The invite carries the address that becomes the login; storing it on
		// the employee row is what makes the duplicate-email guard and the
		// employee search work. It used to be dropped, leaving `email` NULL on
		// every invite-created employee.
		email: row.email,
		employmentStatus: 'active',
		// The dialog's permanent/temporary switch (or the sheet's
		// `employmentType` cell) decides this; `permanent` stays the default.
		employmentType: row.employmentType ?? 'permanent',
		workType: 'onsite',
		...row.employee,
	} as TCreateEmployee;
}

/** Per-row outcome; `employee` is set on success. */
export type TInviteEmployeeResult =
	| {
			ok: true;
			email: string;
			invitation: TInviteResult;
			employee: TEmployeeDto;
	  }
	| { ok: false; email: string; error: string };

/**
 * Invite-creates-employee orchestration (ERP-0034).
 *
 * @remarks
 * One user action invites a person and creates their employee record, in
 * both the organization scope and the application scope. It lives in the
 * HR module on purpose: `EmployeeService` already depends on
 * `InvitationService`, so the reverse call from the user module would be a
 * service cycle. Controllers stay HTTP-only and call this service.
 *
 * Sequence per row: (1) reject an email that already belongs to a live
 * employee, (2) run the invitation pipeline, (3) insert the employee, (4)
 * open the draft employment agreement (ERP-0121). If (3) or (4) fails after
 * (2) succeeded, the invitation is cancelled and the pending user
 * soft-deleted, so no orphan pending account remains.
 */
@injectable()
export class EmployeeInviteService {
	constructor(
		@inject(INVITATION_SERVICE_TOKEN)
		private readonly invitations: InvitationService,
		@inject(EMPLOYEE_REPOSITORY_TOKEN)
		private readonly employees: IEmployeeRepository,
		@inject(HUMAN_RESOURCE_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: HumanResourceNumberingService,
		@inject(USER_PERSONAL_FIELDS_PORT_TOKEN)
		private readonly personalFields: IUserPersonalFieldsPort,
		/** ERP-0121: the draft employment agreement opened with every employee. */
		@inject(EMPLOYEE_DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<EmployeeDocumentService, 'ensureAgreement'>,
	) {}

	/** Single invite: errors propagate to the caller (HTTP status mapping). */
	async invite(
		row: TInviteEmployeeRow,
		actor: TActor,
	): Promise<TInviteEmployeeResult & { ok: true }> {
		return this.createOne(row, actor);
	}

	/**
	 * Bulk invite: per-row isolation. A row that fails (for example an email
	 * already used by an employee) is reported and the rest still run.
	 */
	async inviteBulk(
		rows: TInviteEmployeeRow[],
		actor: TActor,
	): Promise<{ results: TInviteEmployeeResult[]; succeeded: number; failed: number }> {
		const results: TInviteEmployeeResult[] = [];
		for (const row of rows) {
			try {
				results.push(await this.createOne(row, actor));
			} catch (error) {
				results.push({
					ok: false,
					email: row.email,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		return {
			results,
			succeeded: results.filter((r) => r.ok).length,
			failed: results.filter((r) => !r.ok).length,
		};
	}

	private async createOne(
		row: TInviteEmployeeRow,
		actor: TActor,
	): Promise<TInviteEmployeeResult & { ok: true }> {
		if (await this.employees.findByEmail(row.email)) {
			throw new EmployeeEmailTakenError();
		}

		const invited = await this.invitations.invite(
			{
				email: row.email,
				name: row.name,
				organizationId: row.organizationId,
				organizationRoles: row.organizationId
					? (row.organizationRoles ?? ['member'])
					: undefined,
			},
			actor,
		);

		// A retried invite for an email whose earlier attempt rolled back left
		// its employee row behind (the profile insert commits before the
		// personal-field write). Reuse that row instead of tripping
		// `hr_employees_user_uq`; the invitation above was still (re)sent.
		const existing = await this.employees.findByUserId(invited.userId);
		if (existing && existing.organizationId === (row.organizationId ?? null)) {
			// The earlier attempt may have failed on the agreement itself.
			try {
				await this.documents.ensureAgreement(existing);
			} catch (error) {
				await this.invitations.rollbackPending(invited.invitation.id, invited.userId, actor);
				if (error instanceof AppError) throw new EmployeeInviteError(error.message);
				throw error;
			}
			return {
				ok: true,
				email: row.email,
				invitation: invited,
				employee: await withPersonalFields(this.personalFields, existing),
			};
		}

		try {
			const organizationId = row.organizationId ?? null;
			const body = defaultProfile(row);
			const employeeCode = body.employeeCode ?? (await this.numbering.next('employee'));
			if (await this.employees.codeTaken(organizationId, employeeCode)) {
				throw new EmployeeEmailTakenError();
			}
			const inserted = await this.employees.insert({
				...toRow(body),
				employmentStatus: body.employmentStatus,
				employmentType: body.employmentType,
				workType: body.workType,
				employeeCode,
				organizationId,
				userId: invited.userId,
				createdAt: new Date(),
			});
			await this.personalFields.update(invited.userId, personalPatchFrom(body));
			// ERP-0121 (grill-me Q11/Q12): the draft agreement belongs to the invite;
			// a failure here rolls the whole row back like the employee insert.
			await this.documents.ensureAgreement(inserted);
			const employee = await withPersonalFields(this.personalFields, inserted);
			return { ok: true, email: row.email, invitation: invited, employee };
		} catch (error) {
			await this.invitations.rollbackPending(
				invited.invitation.id,
				invited.userId,
				actor,
			);
			if (error instanceof AppError) {
				throw new EmployeeInviteError(error.message);
			}
			throw error;
		}
	}
}

export type { TBulkInviteResult };
