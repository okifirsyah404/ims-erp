import { presignAvatarUrl } from '@providers/s3/s3';
import { injectable } from 'tsyringe';
import { UserRepository } from '../repositories/user.repository';

export class AvatarNotFoundError extends Error {
	constructor(readonly userId: string) {
		super(`Avatar not found for user ${userId}`);
		this.name = 'AvatarNotFoundError';
	}
}

@injectable()
export class UserService {
	constructor(private userRepository: UserRepository) {}

	/**
	 * Resolves a short-lived presigned GET URL for the user's avatar.
	 * The database stores the S3 object key; the signed URL is minted
	 * per request and never persisted.
	 */
	async getAvatarUrl(userId: string): Promise<string> {
		const key = await this.userRepository.findAvatarKey(userId);
		if (!key) throw new AvatarNotFoundError(userId);
		return presignAvatarUrl(userId);
	}
}
