import { DRIZZLE_TOKEN } from '@di/provider';
import { contacts, type TContactSelect } from '@drizzle/schemas/company.schema';
import type { TTx } from '@drizzle/types';
import { eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	ICompanyContactRepository,
	TContactChannel,
} from '../contracts/company.repository.interface';

/** Drizzle implementation of {@link ICompanyContactRepository} on `company.contacts`. */
@injectable()
export class CompanyContactRepository implements ICompanyContactRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findAll(tx?: TTx): Promise<TContactSelect[]> {
		return (tx ?? this.database).select().from(contacts).where(isNull(contacts.deletedAt));
	}

	async syncChannels(
		channels: Array<TContactChannel | { contactType: string; value: null }>,
		tx?: TTx,
	): Promise<void> {
		const database = tx ?? this.database;
		const now = new Date();
		const live = await this.findAll(tx);

		for (const channel of channels) {
			const existing = live.find((row) => row.contactType === channel.contactType);
			if (channel.value === null) {
				if (existing) {
					await database
						.update(contacts)
						.set({ deletedAt: now, updatedAt: now })
						.where(eq(contacts.id, existing.id));
				}
				continue;
			}
			const { contactType, value, label, isPrimary } = channel;
			if (existing) {
				await database
					.update(contacts)
					.set({ value, label, isPrimary, updatedAt: now })
					.where(eq(contacts.id, existing.id));
				continue;
			}
			await database
				.insert(contacts)
				.values({ contactType, value, label, isPrimary, createdAt: now, updatedAt: now });
		}
	}
}
