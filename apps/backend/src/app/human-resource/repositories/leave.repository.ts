import { DRIZZLE_TOKEN } from '@di/provider';
import { leaveRequests, leaveTypes, overtimeRequests } from '@drizzle/schemas/human-resource.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type { THrScope, TRequestListQuery } from '../contracts/hr-records.contract';
import type { ILeaveRepository } from '../contracts/hr-records.repository.interface';
import { periodRange } from '../utils/hr';
import { visibleEmployees } from './people.repository';

/** Drizzle implementation of {@link ILeaveRepository}. */
@injectable()
export class LeaveRepository implements ILeaveRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listTypes(includeInactive: boolean) {
		return this.database
			.select()
			.from(leaveTypes)
			.where(and(isNull(leaveTypes.deletedAt), includeInactive ? undefined : eq(leaveTypes.isActive, true)))
			.orderBy(asc(leaveTypes.code));
	}

	async findType(id: string) {
		const [row] = await this.database
			.select()
			.from(leaveTypes)
			.where(and(eq(leaveTypes.id, id), isNull(leaveTypes.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	// Leave -------------------------------------------------------------------

	async paginateLeave({ page, limit, employeeId, status, period }: TRequestListQuery, scope: THrScope) {
		const range = period ? periodRange(period) : null;
		const where = and(
			isNull(leaveRequests.deletedAt),
			visibleEmployees(leaveRequests.employeeId, scope),
			employeeId ? eq(leaveRequests.employeeId, employeeId) : undefined,
			status ? eq(leaveRequests.status, status) : undefined,
			range ? and(lte(leaveRequests.startDate, range.end), gte(leaveRequests.endDate, range.start)) : undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(leaveRequests).where(where);
		const data = await this.database
			.select()
			.from(leaveRequests)
			.where(where)
			.orderBy(desc(leaveRequests.startDate), desc(leaveRequests.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async findLeave(id: string) {
		const [row] = await this.database
			.select()
			.from(leaveRequests)
			.where(and(eq(leaveRequests.id, id), isNull(leaveRequests.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async createLeave(data: Parameters<ILeaveRepository['createLeave']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(leaveRequests)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async transitionLeave(id: string, from: string[], data: Parameters<ILeaveRepository['transitionLeave']>[2], tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.update(leaveRequests)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(
					eq(leaveRequests.id, id),
					isNull(leaveRequests.deletedAt),
					inArray(leaveRequests.status, from as (typeof leaveRequests.$inferSelect.status)[]),
				),
			)
			.returning();
		return row ?? null;
	}

	async usedDays(employeeId: string, leaveTypeId: string, year: number, excludeId?: string) {
		const rows = await this.database
			.select({ status: leaveRequests.status, days: sql<number>`coalesce(sum(${leaveRequests.days}), 0)::int` })
			.from(leaveRequests)
			.where(
				and(
					isNull(leaveRequests.deletedAt),
					eq(leaveRequests.employeeId, employeeId),
					eq(leaveRequests.leaveTypeId, leaveTypeId),
					inArray(leaveRequests.status, ['submitted', 'approved']),
					gte(leaveRequests.startDate, `${year}-01-01`),
					lte(leaveRequests.startDate, `${year}-12-31`),
					excludeId ? ne(leaveRequests.id, excludeId) : undefined,
				),
			)
			.groupBy(leaveRequests.status);
		return {
			approved: rows.find((row) => row.status === 'approved')?.days ?? 0,
			pending: rows.find((row) => row.status === 'submitted')?.days ?? 0,
		};
	}

	overlapping(employeeId: string, start: string, end: string) {
		return this.database
			.select()
			.from(leaveRequests)
			.where(
				and(
					isNull(leaveRequests.deletedAt),
					eq(leaveRequests.employeeId, employeeId),
					inArray(leaveRequests.status, ['submitted', 'approved']),
					lte(leaveRequests.startDate, end),
					gte(leaveRequests.endDate, start),
				),
			);
	}

	// Overtime ----------------------------------------------------------------

	async paginateOvertime({ page, limit, employeeId, status, period }: TRequestListQuery, scope: THrScope) {
		const range = period ? periodRange(period) : null;
		const where = and(
			isNull(overtimeRequests.deletedAt),
			visibleEmployees(overtimeRequests.employeeId, scope),
			employeeId ? eq(overtimeRequests.employeeId, employeeId) : undefined,
			status ? eq(overtimeRequests.status, status) : undefined,
			range ? and(gte(overtimeRequests.workDate, range.start), lte(overtimeRequests.workDate, range.end)) : undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(overtimeRequests).where(where);
		const data = await this.database
			.select()
			.from(overtimeRequests)
			.where(where)
			.orderBy(desc(overtimeRequests.workDate), desc(overtimeRequests.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async findOvertime(id: string) {
		const [row] = await this.database
			.select()
			.from(overtimeRequests)
			.where(and(eq(overtimeRequests.id, id), isNull(overtimeRequests.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async createOvertime(data: Parameters<ILeaveRepository['createOvertime']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(overtimeRequests)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async transitionOvertime(id: string, from: string[], data: Parameters<ILeaveRepository['transitionOvertime']>[2]) {
		const [row] = await this.database
			.update(overtimeRequests)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(
					eq(overtimeRequests.id, id),
					isNull(overtimeRequests.deletedAt),
					inArray(overtimeRequests.status, from as (typeof overtimeRequests.$inferSelect.status)[]),
				),
			)
			.returning();
		return row ?? null;
	}

	async approvedHours(start: string, end: string) {
		const rows = await this.database
			.select({ employeeId: overtimeRequests.employeeId, hours: sql<string>`sum(${overtimeRequests.hours})` })
			.from(overtimeRequests)
			.where(
				and(
					isNull(overtimeRequests.deletedAt),
					eq(overtimeRequests.status, 'approved'),
					gte(overtimeRequests.workDate, start),
					lte(overtimeRequests.workDate, end),
				),
			)
			.groupBy(overtimeRequests.employeeId);
		return rows.map((row) => ({ employeeId: row.employeeId, hours: Number(row.hours) }));
	}
}
