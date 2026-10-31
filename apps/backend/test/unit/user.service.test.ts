import { describe, expect, mock, test } from 'bun:test';
import type {
	IUserAuthGateway,
	TAuthGatewayCreateUser,
} from '../../src/app/user/contracts/user-auth.gateway.interface';
import type {
	IUserRepository,
	TUserPaginationRequest,
} from '../../src/app/user/contracts/user.repository.interface';
import { UserService } from '../../src/app/user/services/user.service';
import { UserNotFoundError } from '../../src/app/user/services/user.errors';
import type { TUserSelect } from '../../drizzle/schemas/auth.schema';

function makeUser(overrides: Partial<TUserSelect> = {}): TUserSelect {
	return {
		id: 'u1',
		name: 'User One',
		email: 'u1@example.com',
		emailVerified: false,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		role: 'user',
		banned: false,
		banReason: null,
		banExpires: null,
		bio: null,
		username: 'user1',
		displayUsername: 'user1',
		deletedAt: null,
		...overrides,
	};
}

const HEADERS = new Headers();

function makeService(user: TUserSelect | null) {
	const repository = {
		findById: mock(() => Promise.resolve(user)),
		delete: mock(() => Promise.resolve()),
		restore: mock(() => Promise.resolve(user)),
	} as unknown as {
		findById: ReturnType<typeof mock>;
		delete: ReturnType<typeof mock>;
		restore: ReturnType<typeof mock>;
	};
	const gateway = {
		createUser: mock(() => Promise.resolve({ id: 'u2' })),
		updateUser: mock(() => Promise.resolve()),
		setRole: mock(() => Promise.resolve()),
		banUser: mock(() => Promise.resolve()),
		unbanUser: mock(() => Promise.resolve()),
	} as unknown as {
		[K in keyof IUserAuthGateway]: IUserAuthGateway[K] extends (
			...args: infer A
		) => Promise<infer R>
			? ReturnType<typeof mock<(args: A) => Promise<R>>>
			: never;
	};
	const service = new UserService(
		repository as unknown as IUserRepository,
		gateway as unknown as IUserAuthGateway,
	);
	return { service, repository, gateway };
}

describe('UserService.getUser', () => {
	test('maps a stored image key to a presigned URL', async () => {
		const { service, repository } = makeService(
			makeUser({ image: 'user/u1/avatar.png' }),
		);
		const profile = await service.getUser('u1');
		expect(repository.findById).toHaveBeenCalledWith('u1');
		expect(profile).not.toBeNull();
		// The raw key never leaks; the response carries a signed URL.
		expect(profile!.image).toContain('Signature=');
		expect(profile!.image).not.toBe('user/u1/avatar.png');
		expect(profile!.id).toBe('u1');
	});

	test('returns image null when the user has no avatar', async () => {
		const { service } = makeService(makeUser({ image: null }));
		const profile = await service.getUser('u1');
		expect(profile!.image).toBeNull();
	});

	test('returns null for absent or soft-deleted users', async () => {
		const { service } = makeService(null);
		expect(await service.getUser('nope')).toBeNull();
	});
});

describe('UserService.softDeleteUser', () => {
	test('pairs the deletion ban with the deletedAt write', async () => {
		const { service, repository, gateway } = makeService(makeUser());
		await service.softDeleteUser('u1', HEADERS);
		expect(gateway.banUser).toHaveBeenCalledWith(
			'u1',
			{ banReason: 'deleted' },
			HEADERS,
		);
		expect(repository.delete).toHaveBeenCalledWith('u1');
	});

	test('throws UserNotFoundError when the user does not exist', async () => {
		const { service, repository, gateway } = makeService(null);
		expect(service.softDeleteUser('nope', HEADERS)).rejects.toBeInstanceOf(
			UserNotFoundError,
		);
		// Nothing is written when the target is missing.
		expect(gateway.banUser).not.toHaveBeenCalled();
		expect(repository.delete).not.toHaveBeenCalled();
	});
});

describe('UserService.restoreUser', () => {
	test('clears deletedAt and lifts the deletion ban', async () => {
		const { service, repository, gateway } = makeService(makeUser());
		await service.restoreUser('u1', HEADERS);
		expect(repository.restore).toHaveBeenCalledWith('u1');
		expect(gateway.unbanUser).toHaveBeenCalledWith('u1', HEADERS);
	});

	test('throws UserNotFoundError when nothing was soft-deleted', async () => {
		const { service, gateway } = makeService(null);
		expect(service.restoreUser('nope', HEADERS)).rejects.toBeInstanceOf(
			UserNotFoundError,
		);
		expect(gateway.unbanUser).not.toHaveBeenCalled();
	});
});

describe('UserService mutations delegate to the gateway', () => {
	test('createUser forwards input and headers', async () => {
		const { service, gateway } = makeService(null);
		const input: TAuthGatewayCreateUser = {
			email: 'new@example.com',
			password: 'password123',
			name: 'New',
		};
		const created = await service.createUser(input, HEADERS);
		expect(created).toEqual({ id: 'u2' });
		expect(gateway.createUser).toHaveBeenCalledWith(input, HEADERS);
	});

	test('setUserRole verifies existence then delegates', async () => {
		const { service, gateway } = makeService(makeUser());
		await service.setUserRole('u1', { role: 'admin' }, HEADERS);
		expect(gateway.setRole).toHaveBeenCalledWith(
			'u1',
			{ role: 'admin' },
			HEADERS,
		);
	});

	test('updateUser on a missing user throws before calling the gateway', async () => {
		const { service, gateway } = makeService(null);
		expect(
			service.updateUser('nope', { name: 'X' }, HEADERS),
		).rejects.toBeInstanceOf(UserNotFoundError);
		expect(gateway.updateUser).not.toHaveBeenCalled();
	});

	test('banUser verifies existence then delegates with parsed input', async () => {
		const { service, gateway } = makeService(makeUser());
		await service.banUser('u1', { banReason: 'abuse' }, HEADERS);
		expect(gateway.banUser).toHaveBeenCalledWith(
			'u1',
			{ banReason: 'abuse' },
			HEADERS,
		);
	});

	test('unbanUser verifies existence then delegates', async () => {
		const { service, gateway } = makeService(makeUser());
		await service.unbanUser('u1', HEADERS);
		expect(gateway.unbanUser).toHaveBeenCalledWith('u1', HEADERS);
	});

	test('paginateUsers delegates to the repository', async () => {
		const page = {
			meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
			data: [makeUser()],
		};
		const repository = {
			paginate: mock(() => Promise.resolve(page)),
		} as unknown as IUserRepository;
		const service = new UserService(
			repository,
			{} as unknown as IUserAuthGateway,
		);
		const request: TUserPaginationRequest = { page: 1, limit: 20 };
		expect(await service.paginateUsers(request)).toEqual(page);
	});
});
