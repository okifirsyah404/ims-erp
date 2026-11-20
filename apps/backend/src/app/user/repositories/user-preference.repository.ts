import { DRIZZLE_TOKEN } from '@di/provider';
import { userPreferences } from '@drizzle/schemas/user-preference.schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

/** Persistence port for `auth.user_preferences` (ERP-0075). */
export interface IUserPreferenceRepository {
	/** The live values of these keys (missing keys are absent). */
	get(userId: string, keys: string[]): Promise<Map<string, string | null>>;
	/** Upserts every entry in one transaction. */
	set(userId: string, entries: Record<string, string>): Promise<void>;
}

@injectable()
export class UserPreferenceRepository implements IUserPreferenceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async get(userId: string, keys: string[]): Promise<Map<string, string | null>> {
		if (keys.length === 0) return new Map();
		const rows = await this.database
			.select({ key: userPreferences.preferenceKey, value: userPreferences.preferenceValue })
			.from(userPreferences)
			.where(and(eq(userPreferences.userId, userId), inArray(userPreferences.preferenceKey, keys), isNull(userPreferences.deletedAt)));
		return new Map(rows.map((row) => [row.key, row.value]));
	}

	async set(userId: string, entries: Record<string, string>): Promise<void> {
		await this.database.transaction(async (tx) => {
			const now = new Date();
			for (const [key, value] of Object.entries(entries)) {
				const updated = await tx
					.update(userPreferences)
					.set({ preferenceValue: value, updatedAt: now })
					.where(and(eq(userPreferences.userId, userId), eq(userPreferences.preferenceKey, key), isNull(userPreferences.deletedAt)))
					.returning({ id: userPreferences.id });
				if (updated.length === 0) {
					await tx.insert(userPreferences).values({ userId, preferenceKey: key, preferenceValue: value, createdAt: now, updatedAt: now });
				}
			}
		});
	}
}
