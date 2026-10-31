import { presignAvatarUrl } from '@providers/s3/s3';
import type { TUserSelect } from '@drizzle/schemas/auth.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import type {
	IUserAuthGateway,
	TAuthGatewayCreateUser,
} from '../contracts/user-auth.gateway.interface';
import type {
	IUserRepository,
	TUserPaginationRequest,
} from '../contracts/user.repository.interface';
import type { TSetUserRole, TUpdateUser } from '../contracts/user.contract';
import { USER_AUTH_GATEWAY_TOKEN, USER_REPOSITORY_TOKEN } from '../constants/di';
import { UserNotFoundError } from './user.errors';

/**
 * Full user profile as returned by {@link UserService.getUser}.
 *
 * @remarks
 * Same shape as `TUserSelect`, except `image` carries a short-lived
 * presigned S3 GET URL instead of the stored object key; `null` when the
 * user has no avatar yet.
 */
export type TUserProfile = Omit<TUserSelect, 'image'> & { image: string | null };

/** Reason recorded by Better Auth when a user is soft-deleted. */
const DELETED_BAN_REASON = 'deleted';

/**
 * Application service orchestrating the user module.
 *
 * @remarks
 * Owns the module invariants: Better Auth–owned state (role, ban, password,
 * profile fields) flows exclusively through {@link IUserAuthGateway}; the
 * repository touches only `deletedAt`. Soft delete pairs a repository
 * `deletedAt` write with an admin-API ban (Better Auth ignores `deletedAt`
 * during authentication, so the ban is what blocks logins); restore pairs
 * the reverse. `image` keys are remapped to presigned URLs here, at the
 * service boundary — never persisted, never cached.
 */
@injectable()
export class UserService {
	constructor(
		@inject(USER_REPOSITORY_TOKEN)
		private readonly userRepository: IUserRepository,
		@inject(USER_AUTH_GATEWAY_TOKEN)
		private readonly authGateway: IUserAuthGateway,
	) {}

	/**
	 * Fetches one page of users matching the given filters.
	 */
	paginateUsers(
		request: TUserPaginationRequest,
	): Promise<TPaginationResult<TUserSelect>> {
		return this.userRepository.paginate(request);
	}

	/**
	 * Fetches one user's full profile with the avatar presigned.
	 *
	 * @returns The profile, or `null` when absent or soft-deleted
	 */
	async getUser(userId: string): Promise<TUserProfile | null> {
		const user = await this.userRepository.findById(userId);
		if (!user) return null;
		return this.withPresignedAvatar(user);
	}

	/**
	 * Creates a user through the Better Auth admin API.
	 *
	 * @returns The created user's id
	 */
	async createUser(
		input: TAuthGatewayCreateUser,
		headers: Headers,
	): Promise<{ id: string }> {
		return this.authGateway.createUser(input, headers);
	}

	/**
	 * Updates profile fields through the Better Auth admin API.
	 *
	 * @throws UserNotFoundError When the target user does not exist
	 */
	async updateUser(
		userId: string,
		input: TUpdateUser,
		headers: Headers,
	): Promise<void> {
		await this.ensureExists(userId);
		await this.authGateway.updateUser(userId, input, headers);
	}

	/**
	 * Replaces the user's global role through the Better Auth admin API.
	 *
	 * @throws UserNotFoundError When the target user does not exist
	 */
	async setUserRole(
		userId: string,
		input: TSetUserRole,
		headers: Headers,
	): Promise<void> {
		await this.ensureExists(userId);
		await this.authGateway.setRole(userId, input, headers);
	}

	/**
	 * Bans a user; Better Auth owns all ban state and revokes sessions.
	 *
	 * @throws UserNotFoundError When the target user does not exist
	 */
	async banUser(
		userId: string,
		input: { banReason?: string; banExpiresIn?: number },
		headers: Headers,
	): Promise<void> {
		await this.ensureExists(userId);
		await this.authGateway.banUser(userId, input, headers);
	}

	/**
	 * Lifts a ban through the Better Auth admin API.
	 *
	 * @throws UserNotFoundError When the target user does not exist
	 */
	async unbanUser(userId: string, headers: Headers): Promise<void> {
		await this.ensureExists(userId);
		await this.authGateway.unbanUser(userId, headers);
	}

	/**
	 * Soft-deletes a user: sets `deletedAt` in the repository and bans via
	 * the admin API so the user cannot log in while deleted.
	 *
	 * @throws UserNotFoundError When the target user does not exist
	 */
	async softDeleteUser(userId: string, headers: Headers): Promise<void> {
		await this.ensureExists(userId);
		await this.authGateway.banUser(
			userId,
			{ banReason: DELETED_BAN_REASON },
			headers,
		);
		await this.userRepository.delete(userId);
	}

	/**
	 * Restores a soft-deleted user: clears `deletedAt` and lifts the
	 * deletion ban (an explicit pre-delete ban is also lifted — restoring
	 * resurrects the account in banned form otherwise).
	 *
	 * @throws UserNotFoundError When the user is not soft-deleted
	 */
	async restoreUser(userId: string, headers: Headers): Promise<void> {
		const restored = await this.userRepository.restore(userId);
		if (!restored) throw new UserNotFoundError(userId);
		await this.authGateway.unbanUser(userId, headers);
	}

	/**
	 * Maps the stored S3 object key to a short-lived presigned GET URL.
	 */
	private withPresignedAvatar(user: TUserSelect): TUserProfile {
		const { image, ...rest } = user;
		return { ...rest, image: image ? presignAvatarUrl(user.id) : null };
	}

	private async ensureExists(userId: string): Promise<void> {
		const user = await this.userRepository.findById(userId);
		if (!user) throw new UserNotFoundError(userId);
	}
}
