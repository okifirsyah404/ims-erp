import type { TUserSelect } from '@drizzle/schemas/auth.schema';

/** Filters for the admin user listing (phase 4). */
export type TUserListRequest = {
	status?: string;
	/** Platform role (`admin` / `user`). */
	role?: string;
	/** Case-insensitive partial match on name, email or username. */
	search?: string;
	includeDeleted?: boolean;
	/** Narrows the listing to users with a membership in this organization. */
	organizationId?: string;
	/** Sort column; `joinedAt` is the claim date (`users.claimedAt`). */
	sortBy: 'name' | 'createdAt' | 'joinedAt';
	sortDir: 'asc' | 'desc';
	page: number;
	limit: number;
};

/** Admin user row with its active organization memberships. */
export type TAdminUserRow = {
	user: TUserSelect;
	organizations: Array<{ id: string; name: string; role: string }>;
};

/** Filters for the admin audit listing (phase 4). */
export type TAuditListRequest = {
	action?: string;
	actorUserId?: string;
	targetType?: string;
	organizationId?: string;
	from?: Date;
	to?: Date;
	page: number;
	limit: number;
};
