import type { TUserInvitationSelect } from '@drizzle/schemas/auth.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/**
 * Filters for the invitation listing. `status` is exact; `email` is a
 * case-insensitive partial match.
 */
export type TInvitationPaginationRequest = TPaginationRequest & {
	status?: TUserInvitationSelect['status'];
	organizationId?: string;
	email?: string;
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
	/** Fetches one filtered page of invitations for the admin triage view. */
	paginate(
		request: TInvitationPaginationRequest,
	): Promise<TPaginationResult<TUserInvitationSelect>>;
	create(input: TInvitationCreate): Promise<TUserInvitationSelect>;
	/**
	 * Replaces the token hash/expiry on resend and increments resentCount.
	 * The optional context fields sync the row when the resend carries a
	 * different path (app ↔ org) or organization/role/name — the overwrite
	 * rule reuses one pending row per email, so the context must track the
	 * latest invite, not the original one.
	 */
	updateToken(
		id: string,
		token: {
			tokenHash: string;
			expiresAt: Date;
			type?: TUserInvitationSelect['type'];
			name?: string | null;
			organizationId?: string | null;
			orgRole?: TUserInvitationSelect['orgRole'];
		},
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
	orgRole: TUserInvitationSelect['orgRole'];
	tokenHash: string;
	invitedBy: string;
	expiresAt: Date;
};
