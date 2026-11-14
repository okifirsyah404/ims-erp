import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { ATTENDANCE_SERVICE_TOKEN } from '../constants/di';
import { attendanceDayQuerySchema, attendanceDaySchema, attendanceMonthQuerySchema } from '../contracts/hr-records.contract';
import { fileOf } from '../utils/import-file';
import { xlsxResponse } from '../utils/spreadsheet';
import { hrContext } from './hr-context';

/**
 * Attendance (`/hr/attendance`, M08). Reading needs `attendance:read`;
 * entering or importing `attendance:record`. Only employees the caller sees
 * (ERP-0034 scope) are listed or written.
 */
export class AttendanceController {
	static plugin() {
		const service = container.resolve(ATTENDANCE_SERVICE_TOKEN);
		const context = hrContext();

		return domainPlugin({ name: 'hr-attendance', prefix: '/hr/attendance', tags: ['HR'], guards: 'erp' })
			.get('/day', async ({ query, erp }) => ok(await service.day((await context(erp)).scope, attendanceDayQuerySchema.parse(query).date)), {
				erp: { permission: ['attendance:read'] },
				detail: { description: 'The day sheet: employees working that day with their record' },
			})
			.put(
				'/day',
				async ({ body, erp }) => {
					const { date, entries } = attendanceDaySchema.parse(body);
					const ctx = await context(erp);
					return ok(await service.saveDay(ctx.scope, ctx.actorUserId, date, entries));
				},
				{ erp: { permission: ['attendance:record'] }, detail: { description: 'Saves the day sheet (leave days are kept)' } },
			)
			.get(
				'/month',
				async ({ query, erp }) => ok(await service.month((await context(erp)).scope, attendanceMonthQuerySchema.parse(query).period)),
				{ erp: { permission: ['attendance:read'] }, detail: { description: 'Status counts per employee for a month' } },
			)
			.get('/template', async () => xlsxResponse(await service.template(), 'template-absensi.xlsx'), {
				erp: { permission: ['attendance:record'] },
				detail: { description: 'The attendance import template (.xlsx)' },
			})
			.post(
				'/import',
				async ({ body, erp }) => {
					const ctx = await context(erp);
					return ok(await service.import(ctx.scope, ctx.actorUserId, fileOf(body)));
				},
				{ erp: { permission: ['attendance:record'] }, detail: { description: 'Imports a filled template; all rows or none, errors per row' } },
			);
	}
}
