import { auth } from '@providers/better-auth/auth';
import { APIError } from 'better-auth/api';
import { injectable } from 'tsyringe';
import type {
	IUserAuthGateway,
	TAuthGatewayCreateUser,
} from '../contracts/user-auth.gateway.interface';
import type { TSetUserRole, TUpdateUser } from '../contracts/user.contract';
import { UserEmailTakenError, UserNotFoundError } from './user.errors';

/**
 * Better Auth admin API implementation of {@link IUserAuthGateway}.
 *
 * @remarks
 * All ban state, role, password, and profile mutations stay inside Better
 * Auth; this class only forwards parsed input and translates `APIError`s
 * into module domain errors. Endpoints with `requireHeaders` run Better
 * Auth's own admin-authorization check against the caller's session, so
 * the caller's request headers are forwarded unchanged.
 */
@injectable()
export class BetterAuthUserGateway implements IUserAuthGateway {
	async createUser(
		input: TAuthGatewayCreateUser,
		_headers: Headers,
	): Promise<{ id: string }> {
		try {
			const { user } = await auth.api.createUser({
				body: {
					email: input.email,
					password: input.password,
					name: input.name,
					// ponytail: same role-literal limitation as setRole below.
					role: input.role as 'admin' | undefined,
					data: { username: input.username, bio: input.bio },
				},
			});
			return { id: user.id };
		} catch (error) {
			throw translate(error, input.email);
		}
	}

	async updateUser(
		userId: string,
		input: TUpdateUser,
		headers: Headers,
	): Promise<void> {
		await this.call(() =>
			auth.api.adminUpdateUser({
				body: { userId, data: { ...input } },
				headers,
			}),
		);
	}

	async setRole(
		userId: string,
		input: TSetUserRole,
		headers: Headers,
	): Promise<void> {
		await this.call(() =>
			auth.api.setRole({
				// ponytail: admin plugin types role as the default "user"|"admin"
				// literal union; custom global roles are accepted at runtime.
				// Ceiling: tighten when Better Auth exposes configurable role
				// generics on setRole.
				body: { userId, role: input.role as 'admin' },
				headers,
			}),
		);
	}

	async banUser(
		userId: string,
		input: { banReason?: string; banExpiresIn?: number },
		headers: Headers,
	): Promise<void> {
		await this.call(() =>
			auth.api.banUser({
				body: {
					userId,
					banReason: input.banReason,
					banExpiresIn: input.banExpiresIn,
				},
				headers,
			}),
		);
	}

	async unbanUser(userId: string, headers: Headers): Promise<void> {
		await this.call(() =>
			auth.api.unbanUser({ body: { userId }, headers }),
		);
	}

	/** Runs one admin-API call and translates failures to domain errors. */
	private async call(run: () => Promise<unknown>): Promise<void> {
		try {
			await run();
		} catch (error) {
			throw translate(error);
		}
	}
}

/** Maps Better Auth `APIError`s onto the user module's domain errors. */
function translate(error: unknown, email = 'unknown'): Error {
	if (error instanceof APIError) {
		if (error.status === 422) return new UserEmailTakenError(email);
		if (error.status === 404) return new UserNotFoundError('unknown');
	}
	return error as Error;
}
