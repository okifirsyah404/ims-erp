import type { TCreateInvitationInput } from './invitation.contract';
import type { TActor, TInviteResult } from '../services/invitation.service';

/**
 * One invite row. The invitation payload alone is enough: HR derives the
 * employee profile defaults from it (`fullName` from `name`), and the HR form
 * edits the rest later. The user module never imports HR types.
 */
export type TInvitationEmployeeRow = TCreateInvitationInput;

/** Per-row outcome: the invitation result plus the created employee. */
export type TInvitationEmployeeResult<TEmployee> =
	| { ok: true; email: string; invitation: TInviteResult; employee: TEmployee }
	| { ok: false; email: string; error: string };

/**
 * Cross-module port: invite a person and create their employee record in
 * one step (ERP-0034).
 *
 * @remarks
 * Implemented by the HR module (adapter over `EmployeeInviteService`) and
 * consumed by the user and organization invitation controllers through
 * `INVITATION_EMPLOYEE_PORT_TOKEN`. The dependency stays one-way: `user` and
 * `organization` never import `hr`, and HR never needs a service cycle back.
 */
export interface IInvitationEmployeePort<TEmployee> {
	/** Single invite; errors propagate to the caller for HTTP mapping. */
	invite(
		row: TInvitationEmployeeRow,
		actor: TActor,
	): Promise<TInvitationEmployeeResult<TEmployee> & { ok: true }>;

	/** Bulk invite; per-row errors are reported and the rest still run. */
	inviteBulk(
		rows: TInvitationEmployeeRow[],
		actor: TActor,
	): Promise<{
		results: TInvitationEmployeeResult<TEmployee>[];
		succeeded: number;
		failed: number;
	}>;
}
