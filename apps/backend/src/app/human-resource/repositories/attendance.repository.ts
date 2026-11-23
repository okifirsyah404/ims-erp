import { DRIZZLE_TOKEN } from '@di/provider';
import { attendances } from '@drizzle/schemas/human-resource.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, count, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type { TAttendanceListQuery, THrScope } from '../contracts/hr-records.contract';
import type { IAttendanceRepository, TAttendanceUpsert } from '../contracts/hr-records.repository.interface';
import { visibleEmployees } from './people.repository';

/** Drizzle implementation of {@link IAttendanceRepository}. */
@injectable()
export class AttendanceRepository implements IAttendanceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listByDate(date: string) {
		return this.database
			.select()
			.from(attendances)
			.where(and(eq(attendances.attendanceDate, date), isNull(attendances.deletedAt)));
	}

	listBetween(start: string, end: string) {
		return this.database
			.select()
			.from(attendances)
			.where(
				and(
					gte(attendances.attendanceDate, start),
					lte(attendances.attendanceDate, end),
					isNull(attendances.deletedAt),
				),
			)
			.orderBy(asc(attendances.attendanceDate));
	}

	async upsertMany(rows: TAttendanceUpsert[], tx?: TTx) {
		if (rows.length === 0) return 0;
		const now = new Date();
		const written = await (tx ?? this.database)
			.insert(attendances)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			.onConflictDoUpdate({
				target: [attendances.employeeId, attendances.attendanceDate],
				targetWhere: isNull(attendances.deletedAt),
				set: {
					status: sql`excluded.status`,
					checkInAt: sql`excluded.check_in_at`,
					checkOutAt: sql`excluded.check_out_at`,
					source: sql`excluded.source`,
					leaveRequestId: sql`excluded.leave_request_id`,
					notes: sql`excluded.notes`,
					recordedBy: sql`excluded.recorded_by`,
					updatedAt: now,
				},
			})
			.returning({ id: attendances.id });
		return written.length;
	}

	async removeForLeave(leaveRequestId: string, tx: TTx) {
		const now = new Date();
		const removed = await tx
			.update(attendances)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(attendances.leaveRequestId, leaveRequestId), isNull(attendances.deletedAt)))
			.returning({ id: attendances.id });
		return removed.length;
	}

	async paginate({ page, limit, employeeId, from, to, status }: TAttendanceListQuery, scope: THrScope) {
		const where = and(
			isNull(attendances.deletedAt),
			visibleEmployees(attendances.employeeId, scope),
			employeeId ? eq(attendances.employeeId, employeeId) : undefined,
			from ? gte(attendances.attendanceDate, from) : undefined,
			to ? lte(attendances.attendanceDate, to) : undefined,
			status ? eq(attendances.status, status) : undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(attendances).where(where);
		const data = await this.database
			.select()
			.from(attendances)
			.where(where)
			.orderBy(desc(attendances.attendanceDate), desc(attendances.createdAt))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(attendances)
			.where(and(eq(attendances.id, id), isNull(attendances.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByDay(employeeId: string, date: string) {
		const [row] = await this.database
			.select()
			.from(attendances)
			.where(and(eq(attendances.employeeId, employeeId), eq(attendances.attendanceDate, date), isNull(attendances.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async insertOne(row: TAttendanceUpsert) {
		const now = new Date();
		const [created] = await this.database
			.insert(attendances)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async updateOne(id: string, data: Partial<TAttendanceUpsert>) {
		const [row] = await this.database
			.update(attendances)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(attendances.id, id), isNull(attendances.deletedAt)))
			.returning();
		return row ?? null;
	}

	async softDelete(id: string) {
		const now = new Date();
		const removed = await this.database
			.update(attendances)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(attendances.id, id), isNull(attendances.deletedAt)))
			.returning({ id: attendances.id });
		return removed.length > 0;
	}
}
