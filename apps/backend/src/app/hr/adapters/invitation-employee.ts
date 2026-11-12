import { inject, injectable } from 'tsyringe';
import type {
	IInvitationEmployeePort,
	TInvitationEmployeeResult,
	TInvitationEmployeeRow,
} from '@app/user/contracts/invitation-employee.port';
import type { TActor } from '@app/user/services/invitation.service';
import type { TEmployeeDto } from '../contracts/hr.contract';
import { EMPLOYEE_INVITE_SERVICE_TOKEN } from '../constants/di';
import type { EmployeeInviteService } from '../services/employee-invite.service';

/**
 * HR adapter for the user module's invitation-employee port (ERP-0034).
 *
 * @remarks
 * Thin delegation only: orchestration and rollback live in
 * {@link EmployeeInviteService}. The user and organization controllers depend
 * on the port token, never on HR classes.
 */
@injectable()
export class InvitationEmployeeAdapter implements IInvitationEmployeePort<TEmployeeDto> {
	constructor(
		@inject(EMPLOYEE_INVITE_SERVICE_TOKEN)
		private readonly inviteService: EmployeeInviteService,
	) {}

	invite(
		row: TInvitationEmployeeRow,
		actor: TActor,
	): Promise<TInvitationEmployeeResult<TEmployeeDto> & { ok: true }> {
		return this.inviteService.invite(row, actor);
	}

	inviteBulk(
		rows: TInvitationEmployeeRow[],
		actor: TActor,
	): Promise<{
		results: TInvitationEmployeeResult<TEmployeeDto>[];
		succeeded: number;
		failed: number;
	}> {
		return this.inviteService.inviteBulk(rows, actor);
	}
}
