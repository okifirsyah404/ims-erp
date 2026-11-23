import type { TScheduleInsert, TScheduleSelect } from '@drizzle/schemas/human-resource.schema';
import type { THrScope } from './hr-records.contract';

export type TScheduleWrite = Omit<TScheduleInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** Persistence port of `human_resource.schedules` (ERP-0118). */
export interface IScheduleRepository {
	/** Live rows of the visible employees between two dates (inclusive). */
	listBetween(start: string, end: string, scope: THrScope): Promise<TScheduleSelect[]>;
	findById(id: string): Promise<TScheduleSelect | null>;
	/** The live row of an employee on a date, if any. */
	findByDay(employeeId: string, workDate: string): Promise<TScheduleSelect | null>;
	insert(row: TScheduleWrite): Promise<TScheduleSelect>;
	/** Inserts the rows whose (employee, date) has no live row yet; returns how many were written. */
	insertMissing(rows: TScheduleWrite[]): Promise<number>;
	update(id: string, data: Partial<TScheduleWrite>): Promise<TScheduleSelect | null>;
	softDelete(id: string): Promise<boolean>;
}
