import { DRIZZLE_TOKEN } from '@di/provider';
import { companySettings, type TCompanySettingSelect } from '@drizzle/schemas/company.schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TCompanySettingValueType } from '../contracts/company.contract';
import type { ICompanySettingRepository } from '../contracts/company.repository.interface';

/** Drizzle implementation of {@link ICompanySettingRepository} on `company.settings`. */
@injectable()
export class CompanySettingRepository implements ICompanySettingRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	findAll(): Promise<TCompanySettingSelect[]> {
		return this.database
			.select()
			.from(companySettings)
			.where(isNull(companySettings.deletedAt))
			.orderBy(companySettings.settingGroup, companySettings.settingKey);
	}

	async find(group: string, key: string): Promise<TCompanySettingSelect | null> {
		const [row] = await this.database
			.select()
			.from(companySettings)
			.where(
				and(
					eq(companySettings.settingGroup, group),
					eq(companySettings.settingKey, key),
					isNull(companySettings.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * Insert-or-update on the live (group, key) row. A single statement keeps
	 * two concurrent PUTs for the same key from both inserting.
	 */
	async upsert(
		group: string,
		key: string,
		data: { valueType: TCompanySettingValueType; value: string | null; updatedBy: string },
	): Promise<TCompanySettingSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(companySettings)
			.values({
				settingGroup: group,
				settingKey: key,
				valueType: data.valueType,
				settingValue: data.value,
				updatedBy: data.updatedBy,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [companySettings.settingGroup, companySettings.settingKey],
				targetWhere: isNull(companySettings.deletedAt),
				set: {
					valueType: data.valueType,
					settingValue: data.value,
					updatedBy: data.updatedBy,
					updatedAt: now,
				},
			})
			.returning();
		return row;
	}
}
