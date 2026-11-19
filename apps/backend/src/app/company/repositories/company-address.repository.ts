import { DRIZZLE_TOKEN } from '@di/provider';
import { companyAddresses, type TCompanyAddressSelect } from '@drizzle/schemas/company.schema';
import type { TTx } from '@drizzle/types';
import { and, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ICompanyAddressRepository } from '../contracts/company.repository.interface';

/**
 * Drizzle implementation of {@link ICompanyAddressRepository} on
 * `company.addresses`.
 *
 * @remarks
 * The primary address is the one printed on the letterhead; at most one live
 * primary row exists (`addresses_primary_uq`).
 */
@injectable()
export class CompanyAddressRepository implements ICompanyAddressRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private livePrimary() {
		return and(isNull(companyAddresses.deletedAt), eq(companyAddresses.isPrimary, true));
	}

	async findPrimary(tx?: TTx): Promise<TCompanyAddressSelect | null> {
		const [row] = await (tx ?? this.database)
			.select()
			.from(companyAddresses)
			.where(this.livePrimary())
			.limit(1);
		return row ?? null;
	}

	async savePrimary(
		data: { addressLine: string | null; postalCode: string | null },
		tx?: TTx,
	): Promise<void> {
		const database = tx ?? this.database;
		const now = new Date();
		const existing = await this.findPrimary(tx);

		if (!data.addressLine) {
			if (existing) {
				await database
					.update(companyAddresses)
					.set({ deletedAt: now, updatedAt: now })
					.where(eq(companyAddresses.id, existing.id));
			}
			return;
		}
		if (existing) {
			await database
				.update(companyAddresses)
				.set({ addressLine: data.addressLine, postalCode: data.postalCode, updatedAt: now })
				.where(eq(companyAddresses.id, existing.id));
			return;
		}
		await database.insert(companyAddresses).values({
			addressLine: data.addressLine,
			postalCode: data.postalCode,
			isPrimary: true,
			createdAt: now,
			updatedAt: now,
		});
	}
}
