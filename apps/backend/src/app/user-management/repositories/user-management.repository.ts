import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, eq, ilike, isNotNull, isNull, ne } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { TUserSelect } from '@drizzle/schemas/auth.schema';
import { users } from '@drizzle/schemas/auth.schema';
import type { IUserManagementRepository } from '../contracts/repositories.interface';

/**
 * Drizzle implementation of {@link IUserManagementRepository}: the
 * user-management module's write surface over `auth.users` is limited to
 * the lifecycle columns it owns (`status`, `phone`, `deletedAt`) plus the
 * invitation-time pre-creation (name + email, no credentials). Passwords,
 * usernames, and every other Better Auth-owned column flow through the
 * auth gateway, never through here.
 */
@injectable()
export class UserManagementRepository implements IUserManagementRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async findById(id: string): Promise<TUserSelect | null> {
		const [row] = await this.database
			.select()
			.from(users)
			.where(and(eq(users.id, id), isNull(users.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByEmail(email: string): Promise<TUserSelect | null> {
		const [row] = await this.database
			.select()
			.from(users)
			.where(and(ilike(users.email, email), isNull(users.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async isUsernameAvailable(username: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: users.id })
			.from(users)
			.where(and(ilike(users.username, username), isNull(users.deletedAt)))
			.limit(1);
		return !row;
	}

	async isPhoneAvailable(phone: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.phone, phone), isNull(users.deletedAt)))
			.limit(1);
		return !row;
	}

	async createPendingUser(input: {
		name: string;
		email: string;
	}): Promise<{ id: string }> {
		const [row] = await this.database
			.insert(users)
			.values({
				id: crypto.randomUUID(),
				name: input.name,
				email: input.email,
				emailVerified: true,
				status: 'pending',
			})
			.returning({ id: users.id });
		return { id: row.id };
	}

	async setStatus(id: string, status: TUserSelect['status']): Promise<void> {
		await this.database
			.update(users)
			.set({ status })
			.where(and(eq(users.id, id), isNull(users.deletedAt)));
	}

	async setClaimed(
		id: string,
		input: { phone: string },
	): Promise<void> {
		await this.database
			.update(users)
			.set({ phone: input.phone, status: 'active' })
			.where(and(eq(users.id, id), isNull(users.deletedAt)));
	}

	async delete(id: string): Promise<void> {
		await this.database
			.update(users)
			.set({ deletedAt: new Date() })
			.where(and(eq(users.id, id), isNull(users.deletedAt)));
	}

	async findAnyByEmail(email: string): Promise<TUserSelect | null> {
		const [row] = await this.database
			.select()
			.from(users)
			.where(ilike(users.email, email))
			.limit(1);
		return row ?? null;
	}

	async restore(id: string): Promise<void> {
		await this.database
			.update(users)
			.set({ deletedAt: null, status: 'pending' })
			.where(and(eq(users.id, id), isNotNull(users.deletedAt)));
	}
}

/** (Reserved) exclusion helper for future claim-availability checks. */
export const excludeUserById = (id: string) => ne(users.id, id);
