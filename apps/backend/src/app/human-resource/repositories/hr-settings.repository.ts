import { DRIZZLE_TOKEN } from '@di/provider';
import { humanResourceSettings } from '@drizzle/schemas/human-resource.schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IHrSettingsRepository } from '../contracts/payroll-settings.contract';

/** Drizzle implementation of {@link IHrSettingsRepository}. One row per (group, key); no cache. */
@injectable()
export class HrSettingsRepository implements IHrSettingsRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async find(group: string, key: string) {
		const [row] = await this.database
			.select()
			.from(humanResourceSettings)
			.where(
				and(
					eq(humanResourceSettings.settingGroup, group),
					eq(humanResourceSettings.settingKey, key),
					isNull(humanResourceSettings.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async upsert(group: string, key: string, value: string | null, valueType: 'number' | 'string', updatedBy: string | null) {
		const now = new Date();
		await this.database
			.insert(humanResourceSettings)
			.values({ settingGroup: group, settingKey: key, settingValue: value, valueType, updatedBy, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				// The unique index is partial (live rows), so the conflict target names it.
				target: [humanResourceSettings.settingGroup, humanResourceSettings.settingKey],
				targetWhere: isNull(humanResourceSettings.deletedAt),
				set: { settingValue: value, valueType, updatedBy, updatedAt: now },
			});
	}
}
