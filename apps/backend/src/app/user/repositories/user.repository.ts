import { DRIZZLE_TOKEN } from '@di/provider';
import { users } from '@drizzle/schemas/auth.schema';
import { eq } from 'drizzle-orm';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

@injectable()
export class UserRepository {
	constructor(@inject(DRIZZLE_TOKEN) private database: BunSQLDatabase) {}

	/** Returns the avatar storage key (e.g. `user/<id>/avatar.png`) or null. */
	async findAvatarKey(userId: string): Promise<string | null> {
		const [row] = await this.database
			.select({ image: users.image })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		return row?.image ?? null;
	}
}
