import { presignObjectUrl, s3Client } from '@providers/s3/s3';
import { avatarCustomObjectKey } from '../constants/avatar-keys';
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
import type {
	TSetUserRole,
	TUpdateSelfUser,
	TUpdateUser,
} from '../contracts/user.contract';
import { USER_AUTH_GATEWAY_TOKEN, USER_REPOSITORY_TOKEN } from '../constants/di';
import { UserNotFoundError } from '../errors/user.errors';

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

/** Allowed avatar content types mapped to their S3 key extension. */
const AVATAR_TYPE_TO_EXT = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
} as const;

/** Magic-byte signatures for the allowed avatar content types. */
const AVATAR_MAGIC_BYTES: Array<{
	type: keyof typeof AVATAR_TYPE_TO_EXT;
	test: (bytes: Uint8Array) => boolean;
}> = [
	{
		type: 'image/png',
		test: (b) =>
			b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
	},
	{
		type: 'image/jpeg',
		test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
	},
	{
		type: 'image/webp',
		test: (b) =>
			b[0] === 0x52 &&
			b[1] === 0x49 &&
			b[2] === 0x46 &&
			b[3] === 0x46 &&
			b[8] === 0x57 &&
			b[9] === 0x45 &&
			b[10] === 0x42 &&
			b[11] === 0x50,
	},
];

/** Maximum accepted avatar upload size (2 MiB). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Sniffs the real content type of an uploaded avatar from its magic
 * bytes (never trusting the client-declared Content-Type).
 *
 * @returns The sniffed type, or `null` when no allowed signature matches
 */
export function sniffAvatarType(bytes: Uint8Array) {
	for (const signature of AVATAR_MAGIC_BYTES) {
		if (signature.test(bytes)) return signature.type;
	}
	return null;
}

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
	 * Self-service profile update (name, username, bio) for the calling
	 * user. Identity comes from the session, never client input.
	 *
	 * @throws UserNotFoundError When the caller no longer exists
	 * @throws UserEmailTakenError When the new username is taken
	 */
	async updateSelf(
		userId: string,
		input: TUpdateSelfUser,
		headers: Headers,
	): Promise<void> {
		await this.ensureExists(userId);
		await this.authGateway.updateSelf(userId, input, headers);
	}

	/**
	 * Stores a user-uploaded avatar: writes the file to S3 under the
	 * custom-key namespace (the generated `avatar.webp` stays untouched as
	 * fallback) and points `users.image` at the new key.
	 *
	 * @returns The refreshed profile with a fresh presigned URL
	 * @throws UserNotFoundError When the caller no longer exists
	 */
	async setSelfAvatar(
		userId: string,
		file: { data: ArrayBuffer; type: string },
	): Promise<TUserProfile> {
		await this.ensureExists(userId);
		const ext = AVATAR_TYPE_TO_EXT[file.type as keyof typeof AVATAR_TYPE_TO_EXT];
		const key = avatarCustomObjectKey(userId, ext);
		await s3Client.write(key, Buffer.from(file.data));
		await this.userRepository.update(userId, { image: key });
		const refreshed = await this.getUser(userId);
		if (!refreshed) throw new UserNotFoundError(userId);
		return refreshed;
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
	 *
	 * @remarks
	 * The presigned URL is response-only: the underlying `image` column
	 * keeps storing the object key, and the URL is regenerated per request
	 * so it never outlives its TTL in a client.
	 */
	private withPresignedAvatar(user: TUserSelect): TUserProfile {
		const { image, ...rest } = user;
		// `image` stores an S3 object key (generated `avatar.webp` or an
		// uploaded `avatar-custom.*`), never a URL; presign per request.
		return { ...rest, image: image ? presignObjectUrl(image) : null };
	}

	/**
	 * Existence pre-check before admin-API calls, so a missing user fails
	 * with the typed {@link UserNotFoundError} instead of a raw Better Auth
	 * error.
	 *
	 * @throws UserNotFoundError when the user does not exist
	 */
	private async ensureExists(userId: string): Promise<void> {
		const user = await this.userRepository.findById(userId);
		if (!user) throw new UserNotFoundError(userId);
	}
}
