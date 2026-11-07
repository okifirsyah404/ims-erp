import { DRIZZLE_TOKEN } from '@di/provider';
import { attendanceRecords } from '@drizzle/schemas/hr.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IAttendanceRepository, TAttendanceUpsert } from '../contracts/hr.repository.interface';

/** Drizzle implementation of {@link IAttendanceRepository}. */
@injectable()
export class AttendanceRepository implements IAttendanceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listByDate(date: string) {
		return this.database
			.select()
			.from(attendanceRecords)
			.where(and(eq(attendanceRecords.attendanceDate, date), isNull(attendanceRecords.deletedAt)));
	}

	listBetween(start: string, end: string) {
		return this.database
			.select()
			.from(attendanceRecords)
			.where(
				and(
					gte(attendanceRecords.attendanceDate, start),
					lte(attendanceRecords.attendanceDate, end),
					isNull(attendanceRecords.deletedAt),
				),
			)
			.orderBy(asc(attendanceRecords.attendanceDate));
	}

	async upsertMany(rows: TAttendanceUpsert[], tx?: TTx) {
		if (rows.length === 0) return 0;
		const now = new Date();
		const written = await (tx ?? this.database)
			.insert(attendanceRecords)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			.onConflictDoUpdate({
				target: [attendanceRecords.employeeId, attendanceRecords.attendanceDate],
				targetWhere: isNull(attendanceRecords.deletedAt),
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
			.returning({ id: attendanceRecords.id });
		return written.length;
	}

	async removeForLeave(leaveRequestId: string, tx: TTx) {
		const now = new Date();
		const removed = await tx
			.update(attendanceRecords)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(attendanceRecords.leaveRequestId, leaveRequestId), isNull(attendanceRecords.deletedAt)))
			.returning({ id: attendanceRecords.id });
		return removed.length;
	}
}
