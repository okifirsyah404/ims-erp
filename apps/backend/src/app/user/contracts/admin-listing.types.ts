import type { TPaginationRequest } from '@ims-erp/common';
import type { TUserSelect } from '@drizzle/schemas/auth.schema';

/** Filters for the admin user listing (phase 4). */
export type TUserPaginationRequest = TPaginationRequest & {
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
};

/** Admin user row with its active organization memberships. */
export type TAdminUserRow = {
	user: TUserSelect;
	organizations: Array<{ id: string; name: string; role: string }>;
};
