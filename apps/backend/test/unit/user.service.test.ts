import { describe, expect, mock, test } from 'bun:test';
import {
	AvatarNotFoundError,
	UserService,
} from '../../src/app/user/services/user.service';

function makeService(image: string | null) {
	const repository = {
		findAvatarKey: mock(() => Promise.resolve(image)),
	};
	const service = new UserService(repository as never);
	return { service, repository };
}

describe('UserService.getAvatarUrl', () => {
	test('returns a presigned URL when the user has an avatar key', async () => {
		const { service, repository } = makeService('user/u1/avatar.png');
		const url = await service.getAvatarUrl('u1');
		expect(repository.findAvatarKey).toHaveBeenCalledWith('u1');
		// Presigned GET URL: points at the S3 endpoint and is signed.
		expect(url).toContain('avatar.png');
		expect(url).toContain('Signature=');
	});

	test('throws AvatarNotFoundError when no avatar key stored', async () => {
		const { service } = makeService(null);
		expect(service.getAvatarUrl('u1')).rejects.toBeInstanceOf(
			AvatarNotFoundError,
		);
	});
});
