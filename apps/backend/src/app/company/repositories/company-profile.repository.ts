import type { ICacheClient } from '@cache/cache.client';
import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import { companyProfiles, type TCompanyProfileSelect } from '@drizzle/schemas/company.schema';
import type { TTx } from '@drizzle/types';
import { eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	ICompanyProfileRepository,
	TCompanyProfileColumns,
} from '../contracts/company.repository.interface';

/** Redis key for the cached singleton profile row. */
const PROFILE_CACHE_KEY = 'company:profile:singleton';

/**
 * Drizzle + Redis implementation of {@link ICompanyProfileRepository}.
 *
 * @remarks
 * The profile is a singleton (`profiles_singleton_uq`). The read is hot (every
 * printed document touches it) and nearly immutable, so it uses cache-aside
 * with negative caching for the absent-profile case. A write outside a
 * transaction evicts the key itself; inside a transaction the caller evicts
 * through {@link invalidate} after the commit.
 */
@injectable()
export class CompanyProfileRepository implements ICompanyProfileRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	async find(tx?: TTx): Promise<TCompanyProfileSelect | null> {
		// Transactional callers need read-your-writes.
		if (tx) return this.read(tx);
		return this.cache.remember(PROFILE_CACHE_KEY, () => this.read(this.database));
	}

	private async read(database: TTx | BunSQLDatabase): Promise<TCompanyProfileSelect | null> {
		const [row] = await database
			.select()
			.from(companyProfiles)
			.where(isNull(companyProfiles.deletedAt))
			.limit(1);
		return row ?? null;
	}

	async save(data: TCompanyProfileColumns, tx?: TTx): Promise<TCompanyProfileSelect> {
		const database = tx ?? this.database;
		const now = new Date();
		const existing = await this.read(database);
		let row: TCompanyProfileSelect;
		if (existing) {
			[row] = await database
				.update(companyProfiles)
				.set({ ...data, updatedAt: now })
				.where(eq(companyProfiles.id, existing.id))
				.returning();
		} else {
			[row] = await database
				.insert(companyProfiles)
				.values({ ...data, createdAt: now, updatedAt: now })
				.returning();
		}
		if (!tx) await this.invalidate();
		return row;
	}

	async setImage(
		kind: 'logo' | 'signature' | 'onboarding',
		key: string | null,
	): Promise<TCompanyProfileSelect | null> {
		const existing = await this.read(this.database);
		if (!existing) return null;

		const set =
			kind === 'logo'
				? { logoObjectKey: key }
				: kind === 'signature'
					? { signatureObjectKey: key }
					: { onboardingObjectKey: key };
		const [row] = await this.database
			.update(companyProfiles)
			.set({ ...set, updatedAt: new Date() })
			.where(eq(companyProfiles.id, existing.id))
			.returning();
		await this.invalidate();
		return row;
	}

	async invalidate(): Promise<void> {
		await this.cache.del(PROFILE_CACHE_KEY);
	}
}
