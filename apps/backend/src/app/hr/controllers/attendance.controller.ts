import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { ATTENDANCE_SERVICE_TOKEN } from '../constants/di';
import { attendanceDayQuerySchema, attendanceDaySchema, attendanceMonthQuerySchema } from '../contracts/hr.contract';
import { fileOf } from '../utils/import-file';
import { xlsxResponse } from '../utils/spreadsheet';

/**
 * REST controller for attendance (`/hr/attendance`, M08 stage 1). Reading
 * needs `attendance:read`; entering, importing and the template
 * `attendance:record` (HR, admin).
 */
export class AttendanceController {
	static plugin() {
		const service = container.resolve(ATTENDANCE_SERVICE_TOKEN);

		return domainPlugin({ name: 'hr-attendance', prefix: '/hr/attendance', tags: ['HR'], guards: 'erp' })
			.get('/day', async ({ query }) => ok(await service.day(attendanceDayQuerySchema.parse(query).date)), {
				erp: { permission: ['attendance:read'] },
				detail: { description: 'The day sheet: active employees with that day’s record' },
			})
			.put(
				'/day',
				async ({ body, erp }) => {
					const { date, entries } = attendanceDaySchema.parse(body);
					return ok(await service.saveDay(erp.session.user.id, date, entries));
				},
				{ erp: { permission: ['attendance:record'] }, detail: { description: 'Saves the day sheet (leave days are kept)' } },
			)
			.get('/month', async ({ query }) => ok(await service.month(attendanceMonthQuerySchema.parse(query).period)), {
				erp: { permission: ['attendance:read'] },
				detail: { description: 'Status counts per employee for a month' },
			})
			.get('/template', async () => xlsxResponse(await service.template(), 'template-absensi.xlsx'), {
				erp: { permission: ['attendance:record'] },
				detail: { description: 'The attendance import template (.xlsx)' },
			})
			.post('/import', async ({ body, erp }) => ok(await service.import(erp.session.user.id, fileOf(body))), {
				erp: { permission: ['attendance:record'] },
				detail: { description: 'Imports a filled template; all rows or none, errors per row' },
			});
	}
}
