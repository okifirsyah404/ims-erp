import { ATTENDANCE_STATUSES, type AttendanceStatus, type TAttendanceSelect, type TEmployeeSelect } from '@drizzle/schemas/hr.schema';
import { inject, injectable } from 'tsyringe';
import { ATTENDANCE_REPOSITORY_TOKEN, HR_PEOPLE_SERVICE_TOKEN } from '../constants/di';
import type { TAttendanceEntry, THrScope } from '../contracts/hr-records.contract';
import type { IAttendanceRepository, TAttendanceUpsert } from '../contracts/hr-records.repository.interface';
import { AttendanceTimeError, ImportFileError } from '../errors/hr.errors';
import { isBusinessDate, jakartaTime, periodRange, toJakartaTime } from '../utils/hr';
import { MAX_IMPORT_ROWS, readRows, templateWorkbook } from '../utils/spreadsheet';
import { type HrPeopleService, personOf, type TPersonRef, worksOn } from './people.service';
import { assertImportFile, type TImportResult, type TRowError } from '../utils/import-file';

export type TAttendanceView = {
	status: AttendanceStatus;
	checkIn: string | null;
	checkOut: string | null;
	notes: string | null;
	source: TAttendanceSelect['source'];
	leaveRequestId: string | null;
};

export type TAttendanceDayRow = {
	employee: TPersonRef;
	record: TAttendanceView | null;
};

export type TAttendanceMonthRow = {
	employee: TPersonRef;
	counts: Record<AttendanceStatus, number>;
};

/** Indonesian words accepted in imports for each status. */
const STATUS_WORDS: Record<string, AttendanceStatus> = {
	hadir: 'present',
	izin: 'permit',
	sakit: 'sick',
	cuti: 'leave',
	alpa: 'absent',
	alpha: 'absent',
	libur: 'holiday',
};

const view = (record: TAttendanceSelect): TAttendanceView => ({
	status: record.status,
	checkIn: toJakartaTime(record.checkInAt),
	checkOut: toJakartaTime(record.checkOutAt),
	notes: record.notes,
	source: record.source,
	leaveRequestId: record.leaveRequestId,
});


/** Employees by upper-cased code; a code used in two organizations maps to `null` (ambiguous). */
function byCode(employees: TEmployeeSelect[]): Map<string, TEmployeeSelect | null> {
	const map = new Map<string, TEmployeeSelect | null>();
	for (const employee of employees) {
		const key = employee.employeeCode.toUpperCase();
		map.set(key, map.has(key) ? null : employee);
	}
	return map;
}

/**
 * Attendance (M08 stage 1, decision of 2026-11-07): HR/admin enter one
 * status per employee per day, or import a template; days written by an
 * approved leave request belong to that request and are not overwritten
 * here.
 */
@injectable()
export class AttendanceService {
	constructor(
		@inject(ATTENDANCE_REPOSITORY_TOKEN) private readonly repository: IAttendanceRepository,
		@inject(HR_PEOPLE_SERVICE_TOKEN) private readonly employees: Pick<HrPeopleService, 'listVisible' | 'findByCodes' | 'require'>,
	) {}

	/** The day sheet: every active employee with that day's record, if any. */
	async day(scope: THrScope, date: string): Promise<TAttendanceDayRow[]> {
		const [people, records] = await Promise.all([this.employees.listVisible(scope), this.repository.listByDate(date)]);
		const byEmployee = new Map(records.map((record) => [record.employeeId, record]));
		return people
			.filter((employee) => worksOn(employee, date))
			.map((employee) => {
				const record = byEmployee.get(employee.id);
				return {
					employee: personOf(employee),
					record: record ? view(record) : null,
				};
			});
	}

	/** Saves the day sheet; rows owned by a leave request are left as they are. */
	async saveDay(scope: THrScope, actorUserId: string, date: string, entries: TAttendanceEntry[]): Promise<{ saved: number; skipped: number }> {
		const existing = new Map((await this.repository.listByDate(date)).map((record) => [record.employeeId, record]));
		const rows: TAttendanceUpsert[] = [];
		let skipped = 0;
		for (const entry of entries) {
			await this.employees.require(scope, entry.employeeId);
			if (existing.get(entry.employeeId)?.source === 'leave') {
				skipped += 1;
				continue;
			}
			rows.push({
				employeeId: entry.employeeId,
				attendanceDate: date,
				status: entry.status,
				checkInAt: jakartaTime(date, entry.checkIn),
				checkOutAt: jakartaTime(date, entry.checkOut),
				source: 'manual',
				leaveRequestId: null,
				notes: entry.notes,
				recordedBy: actorUserId,
			});
		}
		const bad = rows.find((row) => row.checkInAt && row.checkOutAt && row.checkOutAt < row.checkInAt);
		if (bad) throw new AttendanceTimeError();
		return { saved: await this.repository.upsertMany(rows), skipped };
	}

	/** Status counts per employee for a month. */
	async month(scope: THrScope, period: string): Promise<TAttendanceMonthRow[]> {
		const { start, end } = periodRange(period);
		const [all, records] = await Promise.all([this.employees.listVisible(scope), this.repository.listBetween(start, end)]);
		const people = all.filter((employee) => worksOn(employee, end) || worksOn(employee, start));
		const empty = () => Object.fromEntries(ATTENDANCE_STATUSES.map((status) => [status, 0])) as Record<AttendanceStatus, number>;
		const rows = new Map<string, TAttendanceMonthRow>(
			people.map((employee) => [
				employee.id,
				{ employee: personOf(employee), counts: empty() },
			]),
		);
		for (const record of records) {
			const row = rows.get(record.employeeId);
			if (row) row.counts[record.status] += 1;
		}
		return [...rows.values()];
	}

	template(): Promise<Uint8Array> {
		return templateWorkbook(
			'Absensi',
			['kode_karyawan', 'tanggal', 'status', 'jam_masuk', 'jam_pulang', 'catatan'],
			[
				['EMP-0001', '2026-11-02', 'hadir', '08:00', '17:00', ''],
				['EMP-0002', '2026-11-02', 'sakit', '', '', 'Surat dokter'],
			],
		);
	}

	/**
	 * Imports a filled template. Every row is checked first; one bad row
	 * imports nothing and every problem is reported with its row number.
	 */
	async import(scope: THrScope, actorUserId: string, file: unknown): Promise<TImportResult> {
		const rows = await readRows(assertImportFile(file));
		if (rows.length === 0) throw new ImportFileError('empty');
		if (rows.length > MAX_IMPORT_ROWS) throw new ImportFileError('tooMany');
		const codes = [...new Set(rows.map(({ cells }) => (cells[0] ?? '').toUpperCase()))];
		const people = byCode(await this.employees.findByCodes(scope, codes));
		const dates = rows.map(({ cells }) => cells[1] ?? '').filter(isBusinessDate).sort();
		const existing =
			dates.length > 0 ? await this.repository.listBetween(dates[0]!, dates[dates.length - 1]!) : ([] as TAttendanceSelect[]);
		const leaveDays = new Set(existing.filter((record) => record.source === 'leave').map((record) => `${record.employeeId}|${record.attendanceDate}`));

		const errors: TRowError[] = [];
		const seen = new Set<string>();
		const upserts: TAttendanceUpsert[] = [];
		for (const { row, cells } of rows) {
			const [code = '', date = '', rawStatus = '', checkIn = '', checkOut = '', notes = ''] = cells;
			const found = people.get(code.toUpperCase());
			const employee = found ?? undefined;
			const status = (ATTENDANCE_STATUSES as readonly string[]).includes(rawStatus.toLowerCase())
				? (rawStatus.toLowerCase() as AttendanceStatus)
				: STATUS_WORDS[rawStatus.toLowerCase()];
			const validDate = isBusinessDate(date);
			const timeOk = (value: string) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
			if (found === null) errors.push({ row, code: 'employeeAmbiguous', value: code });
			else if (!employee) errors.push({ row, code: 'employeeUnknown', value: code });
			else if (validDate && !worksOn(employee, date)) errors.push({ row, code: 'employeeInactive', value: code });
			if (!validDate) errors.push({ row, code: 'dateInvalid', value: date });
			if (!status) errors.push({ row, code: 'statusInvalid', value: rawStatus });
			if (!timeOk(checkIn) || !timeOk(checkOut) || (checkIn && checkOut && checkOut < checkIn)) {
				errors.push({ row, code: 'timeInvalid', value: `${checkIn}-${checkOut}` });
			}
			if (!employee || !validDate || !status) continue;
			const key = `${employee.id}|${date}`;
			if (seen.has(key)) errors.push({ row, code: 'duplicate', value: `${code} ${date}` });
			if (leaveDays.has(key)) errors.push({ row, code: 'leaveDay', value: `${code} ${date}` });
			seen.add(key);
			upserts.push({
				employeeId: employee.id,
				attendanceDate: date,
				status,
				checkInAt: jakartaTime(date, checkIn || null),
				checkOutAt: jakartaTime(date, checkOut || null),
				source: 'import',
				leaveRequestId: null,
				notes: notes || null,
				recordedBy: actorUserId,
			});
		}
		if (errors.length > 0) return { imported: 0, errors };
		return { imported: await this.repository.upsertMany(upserts), errors: [] };
	}
}
