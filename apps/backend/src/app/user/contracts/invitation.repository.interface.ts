import type { TUserInvitationSelect } from '@drizzle/schemas/role.schema';
import type { TPaginationResult } from '@ims-erp/common';

/**
 * Filters for the invitation listing. `status` is exact; `email` is a
 * case-insensitive partial match.
 */
export type TInvitationListRequest = {
	status?: TUserInvitationSelect['status'];
	organizationId?: string;
	email?: string;
	page: number;
	limit: number;
};

/**
 * Data-access contract over `auth.user_invitations` (module-owned table,
 * full write surface). Soft-delete semantics: reads exclude deleted rows;
 * `delete` marks deleted.
 */
export interface IInvitationRepository {
	findById(id: string): Promise<TUserInvitationSelect | null>;
	/** Finds the live pending invitation for an email (overwrite rule). */
	findPendingByEmail(email: string): Promise<TUserInvitationSelect | null>;
	/** Finds a live invitation by token hash (claim validation). */
	findByTokenHash(tokenHash: string): Promise<TUserInvitationSelect | null>;
	list(
		request: TInvitationListRequest,
	): Promise<TPaginationResult<TUserInvitationSelect>>;
	create(input: TInvitationCreate): Promise<TUserInvitationSelect>;
	/** Replaces the token hash/expiry on resend; increments resentCount. */
	updateToken(
		id: string,
		token: { tokenHash: string; expiresAt: Date },
	): Promise<void>;
	markStatus(
		id: string,
		status: TUserInvitationSelect['status'],
		claimedAt?: Date,
	): Promise<void>;
	/** Soft-deletes a live invitation row. */
	delete(id: string): Promise<void>;
	setDeliveryFailed(id: string, failed: boolean): Promise<void>;
}

/** Insert shape accepted by {@link IInvitationRepository.create}. */
export type TInvitationCreate = {
	id: string;
	type: TUserInvitationSelect['type'];
	email: string;
	name: string | null;
	organizationId: string | null;
	roleId: string | null;
	tokenHash: string;
	invitedBy: string;
	expiresAt: Date;
};
