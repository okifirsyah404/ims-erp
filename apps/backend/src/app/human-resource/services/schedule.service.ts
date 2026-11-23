import type { TEmployeeSelect, TScheduleSelect } from '@drizzle/schemas/human-resource.schema';
import { inject, injectable } from 'tsyringe';
import { HR_PEOPLE_SERVICE_TOKEN, SCHEDULE_REPOSITORY_TOKEN } from '../constants/di';
import type { THrScope } from '../contracts/hr-records.contract';
import { MAX_FILL_DAYS, type TScheduleBody, type TScheduleFill } from '../contracts/schedule.contract';
import type { IScheduleRepository, TScheduleWrite } from '../contracts/schedule.repository.interface';
import { HrNotFoundError, ScheduleError } from '../errors/hr.errors';
import { addDays, datesBetween, weekdayIndex } from '../utils/hr';
import { type HrPeopleService, personOf, type TPersonRef, worksOn } from './people.service';

/** One cell of the grid. */
export type TScheduleView = Pick<TScheduleSelect, 'id' | 'employeeId' | 'workDate' | 'shiftStart' | 'shiftEnd' | 'shiftLabel' | 'isDayOff'>;

/** The week grid: seven dates and one row per employee working in them. */
export type TScheduleWeek = {
	start: string;
	dates: string[];
	rows: { employee: TPersonRef; cells: Record<string, TScheduleView | null> }[];
};

const view = (row: TScheduleSelect): TScheduleView => ({
	id: row.id,
	employeeId: row.employeeId,
	workDate: row.workDate,
	shiftStart: row.shiftStart,
	shiftEnd: row.shiftEnd,
	shiftLabel: row.shiftLabel,
	isDayOff: row.isDayOff,
});

/**
 * Employee work schedule (ERP-0118, grill-me Q9): one shift per employee per
 * date, entered per cell or filled from a weekly pattern. A fill never
 * overwrites a cell that already has a schedule. Only employees the caller
 * sees (the ERP-0034 scope) are listed or written.
 */
@injectable()
export class ScheduleService {
	constructor(
		@inject(SCHEDULE_REPOSITORY_TOKEN) private readonly repository: IScheduleRepository,
		@inject(HR_PEOPLE_SERVICE_TOKEN) private readonly employees: Pick<HrPeopleService, 'listVisible' | 'require' | 'requireActive'>,
	) {}

	/** The seven days starting at `start` (the UI sends a Monday). */
	async week(scope: THrScope, start: string): Promise<TScheduleWeek> {
		const dates = datesBetween(start, addDays(start, 6));
		const end = dates[6]!;
		const [people, rows] = await Promise.all([this.employees.listVisible(scope), this.repository.listBetween(start, end, scope)]);
		const byCell = new Map(rows.map((row) => [`${row.employeeId}|${row.workDate}`, row]));
		const working = people.filter((employee) => dates.some((date) => worksOn(employee, date)) || rows.some((row) => row.employeeId === employee.id));
		return {
			start,
			dates,
			rows: working.map((employee) => ({
				employee: personOf(employee),
				cells: Object.fromEntries(
					dates.map((date) => {
						const row = byCell.get(`${employee.id}|${date}`);
						return [date, row ? view(row) : null];
					}),
				),
			})),
		};
	}

	/** The row, if its employee is visible to the caller. */
	private async requireSchedule(scope: THrScope, id: string): Promise<TScheduleSelect> {
		const row = await this.repository.findById(id);
		const employee = row ? await this.employees.require(scope, row.employeeId).catch(() => null) : null;
		if (!row || !employee) throw new HrNotFoundError('schedule');
		return row;
	}

	private shift(body: Pick<TScheduleBody, 'isDayOff' | 'shiftStart' | 'shiftEnd' | 'shiftLabel'>) {
		return {
			isDayOff: body.isDayOff,
			shiftStart: body.isDayOff ? null : body.shiftStart,
			shiftEnd: body.isDayOff ? null : body.shiftEnd,
			shiftLabel: body.shiftLabel,
		};
	}

	/** Enters one cell; the employee may not have a schedule that day yet (409). */
	async create(scope: THrScope, actorUserId: string, body: TScheduleBody): Promise<TScheduleView> {
		await this.employees.requireActive(scope, body.employeeId);
		if (await this.repository.findByDay(body.employeeId, body.workDate)) throw new ScheduleError('duplicate');
		return view(
			await this.repository.insert({ employeeId: body.employeeId, workDate: body.workDate, ...this.shift(body), createdBy: actorUserId }),
		);
	}

	/** Edits one cell; moving it onto a taken (employee, date) is refused (409). */
	async update(scope: THrScope, id: string, body: TScheduleBody): Promise<TScheduleView> {
		const current = await this.requireSchedule(scope, id);
		if (body.employeeId !== current.employeeId) await this.employees.requireActive(scope, body.employeeId);
		if (body.employeeId !== current.employeeId || body.workDate !== current.workDate) {
			const clash = await this.repository.findByDay(body.employeeId, body.workDate);
			if (clash && clash.id !== id) throw new ScheduleError('duplicate');
		}
		const updated = await this.repository.update(id, { employeeId: body.employeeId, workDate: body.workDate, ...this.shift(body) });
		if (!updated) throw new HrNotFoundError('schedule');
		return view(updated);
	}

	/** Soft deletes one cell. */
	async remove(scope: THrScope, id: string): Promise<{ removed: true }> {
		await this.requireSchedule(scope, id);
		if (!(await this.repository.softDelete(id))) throw new HrNotFoundError('schedule');
		return { removed: true };
	}

	/**
	 * Fills `from`..`to` from the weekly pattern for the chosen (or every
	 * visible active) employee, on the days each one works. Existing cells are
	 * skipped.
	 */
	async fill(scope: THrScope, actorUserId: string, body: TScheduleFill): Promise<{ created: number; skipped: number }> {
		const dates = datesBetween(body.from, body.to);
		if (dates.length > MAX_FILL_DAYS) throw new ScheduleError('rangeTooLong', { max: MAX_FILL_DAYS });
		const people: TEmployeeSelect[] = body.employeeIds
			? await Promise.all([...new Set(body.employeeIds)].map((id) => this.employees.requireActive(scope, id)))
			: (await this.employees.listVisible(scope)).filter((employee) => employee.employmentStatus === 'active');
		const rows: TScheduleWrite[] = [];
		for (const employee of people) {
			for (const date of dates) {
				if (!worksOn(employee, date)) continue;
				rows.push({ employeeId: employee.id, workDate: date, ...this.shift(body.pattern[weekdayIndex(date)]!), createdBy: actorUserId });
			}
		}
		const created = await this.repository.insertMissing(rows);
		return { created, skipped: rows.length - created };
	}
}
