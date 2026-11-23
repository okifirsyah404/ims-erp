import { DRIZZLE_TOKEN } from '@di/provider';
import { schedules } from '@drizzle/schemas/human-resource.schema';
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { THrScope } from '../contracts/hr-records.contract';
import type { IScheduleRepository, TScheduleWrite } from '../contracts/schedule.repository.interface';
import { visibleEmployees } from './people.repository';

/** Drizzle implementation of {@link IScheduleRepository}. No cache: a week grid is read fresh. */
@injectable()
export class ScheduleRepository implements IScheduleRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listBetween(start: string, end: string, scope: THrScope) {
		return this.database
			.select()
			.from(schedules)
			.where(
				and(
					isNull(schedules.deletedAt),
					gte(schedules.workDate, start),
					lte(schedules.workDate, end),
					visibleEmployees(schedules.employeeId, scope),
				),
			)
			.orderBy(asc(schedules.workDate));
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(schedules)
			.where(and(eq(schedules.id, id), isNull(schedules.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByDay(employeeId: string, workDate: string) {
		const [row] = await this.database
			.select()
			.from(schedules)
			.where(and(eq(schedules.employeeId, employeeId), eq(schedules.workDate, workDate), isNull(schedules.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async insert(row: TScheduleWrite) {
		const now = new Date();
		const [created] = await this.database
			.insert(schedules)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async insertMissing(rows: TScheduleWrite[]) {
		if (rows.length === 0) return 0;
		const now = new Date();
		const written = await this.database
			.insert(schedules)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			// A cell that already has a live row is skipped, never overwritten.
			.onConflictDoNothing({ target: [schedules.employeeId, schedules.workDate], where: isNull(schedules.deletedAt) })
			.returning({ id: schedules.id });
		return written.length;
	}

	async update(id: string, data: Partial<TScheduleWrite>) {
		const [row] = await this.database
			.update(schedules)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(schedules.id, id), isNull(schedules.deletedAt)))
			.returning();
		return row ?? null;
	}

	async softDelete(id: string) {
		const now = new Date();
		const removed = await this.database
			.update(schedules)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(schedules.id, id), isNull(schedules.deletedAt)))
			.returning({ id: schedules.id });
		return removed.length > 0;
	}
}
