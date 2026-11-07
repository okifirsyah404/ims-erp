import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	isNull,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TUserInvitationSelect,
} from '@drizzle/schemas/role.schema';
import { userInvitations } from '@drizzle/schemas/role.schema';
import type {
	IInvitationRepository,
	TInvitationCreate,
	TInvitationListRequest,
} from '../contracts/invitation.repository.interface';

/**
 * Drizzle implementation of {@link IInvitationRepository} over the
 * module-owned `auth.user_invitations` table (full write surface).
 * Reads exclude soft-deleted rows.
 */
@injectable()
export class InvitationRepository implements IInvitationRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async findById(id: string): Promise<TUserInvitationSelect | null> {
		const [row] = await this.database
			.select()
			.from(userInvitations)
			.where(and(eq(userInvitations.id, id), isNull(userInvitations.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findPendingByEmail(
		email: string,
	): Promise<TUserInvitationSelect | null> {
		const [row] = await this.database
			.select()
			.from(userInvitations)
			.where(
				and(
					ilike(userInvitations.email, email),
					eq(userInvitations.status, 'pending'),
					isNull(userInvitations.deletedAt),
				),
			)
			.orderBy(desc(userInvitations.createdAt))
			.limit(1);
		return row ?? null;
	}

	async findByTokenHash(
		tokenHash: string,
	): Promise<TUserInvitationSelect | null> {
		const [row] = await this.database
			.select()
			.from(userInvitations)
			.where(
				and(
					eq(userInvitations.tokenHash, tokenHash),
					isNull(userInvitations.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async list(
		request: TInvitationListRequest,
	): Promise<TPaginationResult<TUserInvitationSelect>> {
		const { status, organizationId, email, page, limit } = request;
		const filters = [
			isNull(userInvitations.deletedAt),
			status ? eq(userInvitations.status, status) : undefined,
			organizationId
				? eq(userInvitations.organizationId, organizationId)
				: undefined,
			email ? ilike(userInvitations.email, `%${email}%`) : undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(userInvitations)
			.where(where);

		const data = await this.database
			.select()
			.from(userInvitations)
			.where(where)
			// Pending invitations first (oldest first inside a status), then
			// terminal ones newest-first for the admin triage view.
			.orderBy(asc(userInvitations.status), desc(userInvitations.createdAt))
			.offset((page - 1) * limit)
			.limit(limit);

		return {
			data,
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
		};
	}

	async create(input: TInvitationCreate): Promise<TUserInvitationSelect> {
		const [row] = await this.database
			.insert(userInvitations)
			.values({
				id: input.id,
				type: input.type,
				email: input.email,
				name: input.name,
				organizationId: input.organizationId,
				orgRole: input.orgRole,
				tokenHash: input.tokenHash,
				status: 'pending',
				invitedBy: input.invitedBy,
				expiresAt: input.expiresAt,
			})
			.returning();
		return row;
	}

	async updateToken(
		id: string,
		token: { tokenHash: string; expiresAt: Date },
	): Promise<void> {
		const [current] = await this.database
			.select({ resentCount: userInvitations.resentCount })
			.from(userInvitations)
			.where(eq(userInvitations.id, id))
			.limit(1);
		await this.database
			.update(userInvitations)
			.set({
				tokenHash: token.tokenHash,
				expiresAt: token.expiresAt,
				// Replacing the hash is what kills the old token; a resend also
				// clears any stale bounce flag so the admin sees fresh state.
				deliveryFailed: false,
				resentCount: (current?.resentCount ?? 0) + 1,
			})
			.where(eq(userInvitations.id, id));
	}

	async markStatus(
		id: string,
		status: TUserInvitationSelect['status'],
		claimedAt?: Date,
	): Promise<void> {
		await this.database
			.update(userInvitations)
			.set({ status, claimedAt: claimedAt ?? null })
			.where(eq(userInvitations.id, id));
	}

	async delete(id: string): Promise<void> {
		await this.database
			.update(userInvitations)
			.set({ deletedAt: new Date() })
			.where(and(eq(userInvitations.id, id), isNull(userInvitations.deletedAt)));
	}

	async setDeliveryFailed(id: string, failed: boolean): Promise<void> {
		await this.database
			.update(userInvitations)
			.set({ deliveryFailed: failed })
			.where(eq(userInvitations.id, id));
	}
}
