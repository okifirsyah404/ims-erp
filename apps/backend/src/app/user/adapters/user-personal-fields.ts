import { DRIZZLE_TOKEN } from '@di/provider';
import { users } from '@drizzle/schemas/auth.schema';
import { eq, isNull, and } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IUserPersonalFieldsPort } from '../contracts/user-personal-fields.port';
import type {
	TUserPersonalFields,
	TUserPersonalFieldsPatch,
} from '../contracts/user-personal-fields.contract';

/**
 * Drizzle implementation of {@link IUserPersonalFieldsPort}.
 *
 * @remarks
 * Writes only the four personal columns (ERP-0034). Better Auth never sees
 * these fields, so this is a direct Drizzle write, not an admin-API call.
 */
@injectable()
export class UserPersonalFieldsAdapter implements IUserPersonalFieldsPort {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async get(userId: string): Promise<TUserPersonalFields | null> {
		const [row] = await this.database
			.select({
				gender: users.gender,
				birthDate: users.birthDate,
				birthPlace: users.birthPlace,
				maritalStatus: users.maritalStatus,
			})
			.from(users)
			.where(and(eq(users.id, userId), isNull(users.deletedAt)))
			.limit(1);
		// The DB column is text; the CHECK constraints in the migration keep it
		// inside the closed vocabularies, so the narrowing here is safe.
		return (row as TUserPersonalFields | undefined) ?? null;
	}

	async update(userId: string, patch: TUserPersonalFieldsPatch): Promise<void> {
		if (Object.keys(patch).length === 0) return;
		await this.database
			.update(users)
			.set(patch as Partial<typeof users.$inferInsert>)
			.where(eq(users.id, userId));
	}
}
