import { DRIZZLE_TOKEN } from '@di/provider';
import { employeeTasks, employeeSalaryRecords } from '@drizzle/schemas/human-resource.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, count, desc, eq, isNull, sql, gte, lt, inArray } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type { THrScope, TTaskListQuery } from '../contracts/hr-records.contract';
import type { ISalaryRepository, ITaskRepository } from '../contracts/hr-records.repository.interface';
import { visibleEmployees } from './people.repository';

/** Drizzle implementation of {@link ITaskRepository}. */
@injectable()
export class TaskRepository implements ITaskRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async paginate({ page, limit, employeeId, status }: TTaskListQuery, scope: THrScope) {
		const where = and(
			isNull(employeeTasks.deletedAt),
			visibleEmployees(employeeTasks.employeeId, scope),
			employeeId ? eq(employeeTasks.employeeId, employeeId) : undefined,
			status ? eq(employeeTasks.status, status) : undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(employeeTasks).where(where);
		const data = await this.database
			.select()
			.from(employeeTasks)
			.where(where)
			// Open tasks first, the nearest due date first.
			.orderBy(asc(employeeTasks.status), sql`${employeeTasks.dueDate} asc nulls last`, desc(employeeTasks.createdAt))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(employeeTasks)
			.where(and(eq(employeeTasks.id, id), isNull(employeeTasks.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(data: Parameters<ITaskRepository['create']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(employeeTasks)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, data: Parameters<ITaskRepository['update']>[1]) {
		const [row] = await this.database
			.update(employeeTasks)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(employeeTasks.id, id), isNull(employeeTasks.deletedAt)))
			.returning();
		return row ?? null;
	}

	async softDelete(id: string) {
		const now = new Date();
		const removed = await this.database
			.update(employeeTasks)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(employeeTasks.id, id), isNull(employeeTasks.deletedAt)))
			.returning({ id: employeeTasks.id });
		return removed.length > 0;
	}
}

/** Drizzle implementation of {@link ISalaryRepository}. */
@injectable()
export class SalaryRepository implements ISalaryRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listPeriod(period: string, scope: THrScope) {
		return this.database
			.select()
			.from(employeeSalaryRecords)
			.where(and(eq(employeeSalaryRecords.period, period), isNull(employeeSalaryRecords.deletedAt), visibleEmployees(employeeSalaryRecords.employeeId, scope)))
			.orderBy(asc(employeeSalaryRecords.employeeName));
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(employeeSalaryRecords)
			.where(and(eq(employeeSalaryRecords.id, id), isNull(employeeSalaryRecords.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async upsertDraft(data: Parameters<ISalaryRepository['upsertDraft']>[0], tx?: TTx) {
		const now = new Date();
		const [row] = await (tx ?? this.database)
			.insert(employeeSalaryRecords)
			.values({ ...data, status: 'draft', createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: [employeeSalaryRecords.period, employeeSalaryRecords.employeeId],
				targetWhere: isNull(employeeSalaryRecords.deletedAt),
				set: {
					employeeName: data.employeeName,
					baseSalary: data.baseSalary,
					allowances: data.allowances,
					overtimePay: data.overtimePay,
					bonus: data.bonus,
					deductions: data.deductions,
					pph21Amount: data.pph21Amount ?? 0,
					bpjsEmployeeAmount: data.bpjsEmployeeAmount ?? 0,
					bpjsCompanyAmount: data.bpjsCompanyAmount ?? 0,
					pensionEmployeeAmount: data.pensionEmployeeAmount ?? 0,
					taxableGross: data.taxableGross ?? 0,
					ptkpStatus: data.ptkpStatus ?? null,
					terRate: data.terRate ?? null,
					taxMethod: data.taxMethod ?? null,
					netPay: data.netPay,
					notes: data.notes,
					updatedAt: now,
				},
				// An approved summary is locked.
				setWhere: eq(employeeSalaryRecords.status, 'draft'),
			})
			.returning();
		return row ?? null;
	}

	async removeDraft(id: string) {
		const now = new Date();
		const removed = await this.database
			.update(employeeSalaryRecords)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(employeeSalaryRecords.id, id), isNull(employeeSalaryRecords.deletedAt), eq(employeeSalaryRecords.status, 'draft')))
			.returning({ id: employeeSalaryRecords.id });
		return removed.length > 0;
	}

	async approvePeriod(period: string, actorUserId: string, scope: THrScope, tx?: TTx) {
		const now = new Date();
		const approved = await (tx ?? this.database)
			.update(employeeSalaryRecords)
			.set({ status: 'approved', approvedBy: actorUserId, approvedAt: now, updatedAt: now })
			.where(
				and(
					eq(employeeSalaryRecords.period, period),
					isNull(employeeSalaryRecords.deletedAt),
					eq(employeeSalaryRecords.status, 'draft'),
					visibleEmployees(employeeSalaryRecords.employeeId, scope),
				),
			)
			.returning({ id: employeeSalaryRecords.id });
		return approved.map((row) => row.id);
	}

	listEmployeeYear(employeeId: string, period: string, tx?: TTx) {
		return (tx ?? this.database)
			.select()
			.from(employeeSalaryRecords)
			.where(
				and(
					eq(employeeSalaryRecords.employeeId, employeeId),
					isNull(employeeSalaryRecords.deletedAt),
					gte(employeeSalaryRecords.period, `${period.slice(0, 4)}-01`),
					lt(employeeSalaryRecords.period, period),
				),
			)
			.orderBy(asc(employeeSalaryRecords.period));
	}

	listByIds(ids: string[], tx?: TTx) {
		if (ids.length === 0) return Promise.resolve([]);
		return (tx ?? this.database)
			.select()
			.from(employeeSalaryRecords)
			.where(and(inArray(employeeSalaryRecords.id, ids), isNull(employeeSalaryRecords.deletedAt)));
	}

	async setJournalEntry(ids: string[], journalEntryId: string, tx?: TTx) {
		if (ids.length === 0) return;
		await (tx ?? this.database)
			.update(employeeSalaryRecords)
			.set({ journalEntryId, updatedAt: new Date() })
			.where(inArray(employeeSalaryRecords.id, ids));
	}

	listApprovedForEmployee(employeeId: string) {
		return this.database
			.select()
			.from(employeeSalaryRecords)
			.where(
				and(
					eq(employeeSalaryRecords.employeeId, employeeId),
					eq(employeeSalaryRecords.status, 'approved'),
					isNull(employeeSalaryRecords.deletedAt),
				),
			)
			.orderBy(desc(employeeSalaryRecords.period));
	}

	async latestApprovedTotals() {
		const [latest] = await this.database
			.select({ period: employeeSalaryRecords.period })
			.from(employeeSalaryRecords)
			.where(and(eq(employeeSalaryRecords.status, 'approved'), isNull(employeeSalaryRecords.deletedAt)))
			.orderBy(desc(employeeSalaryRecords.period))
			.limit(1);
		if (!latest) return null;
		const [totals] = await this.database
			.select({
				net: sql<string>`coalesce(sum(${employeeSalaryRecords.netPay}), 0)`,
				pph21: sql<string>`coalesce(sum(${employeeSalaryRecords.pph21Amount}), 0)`,
				bpjsEmployee: sql<string>`coalesce(sum(${employeeSalaryRecords.bpjsEmployeeAmount}), 0)`,
				bpjsCompany: sql<string>`coalesce(sum(${employeeSalaryRecords.bpjsCompanyAmount}), 0)`,
			})
			.from(employeeSalaryRecords)
			.where(and(eq(employeeSalaryRecords.period, latest.period), eq(employeeSalaryRecords.status, 'approved'), isNull(employeeSalaryRecords.deletedAt)));
		return {
			period: latest.period,
			net: Number(totals?.net ?? 0),
			pph21: Number(totals?.pph21 ?? 0),
			bpjsEmployee: Number(totals?.bpjsEmployee ?? 0),
			bpjsCompany: Number(totals?.bpjsCompany ?? 0),
		};
	}
}
