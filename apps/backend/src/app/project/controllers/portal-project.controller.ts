import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { PORTAL_PROJECT_SERVICE_TOKEN, SITE_ATTENDANCE_SERVICE_TOKEN } from '../constants/di';
import type { TPortalActor } from '../services/site-attendance.service';
import {
	evidenceUploadSchema,
	projectChildParamSchema,
	projectIdParamSchema,
	projectListQuerySchema,
	taskBodySchema,
	taskStatusSchema,
} from '../contracts/project.contract';
import {
	siteAttendanceIdParamSchema,
	siteAttendanceListQuerySchema,
	siteCheckInSchema,
	siteCheckOutSchema,
} from '../contracts/site-attendance.contract';
import type { EmployeePortalContext } from '@authorization/employee-portal-guard';

/**
 * Employee portal project routes (`/projects/me/*`, Phase B).
 *
 * @remarks
 * Mounted behind the `employee-portal` guard: every handler derives the actor
 * from `ctx.erp.employee` and `ctx.erp.session.user.id`, so no route carries an
 * `employeeId`. Visibility and PIC rights are record-level facts resolved in
 * the services (involved in the project / `pic_user_id`), not organization
 * permissions.
 *
 * Route order matters: the static `/projects/me/...` paths are mounted as their
 * own plugin so the admin `/projects/:id` routes cannot swallow them.
 */
export class PortalProjectController {
	static plugin() {
		const projects = container.resolve(PORTAL_PROJECT_SERVICE_TOKEN);
		const attendance = container.resolve(SITE_ATTENDANCE_SERVICE_TOKEN);
		const actorOf = (erp: EmployeePortalContext): TPortalActor => ({
			employeeId: erp.employee.id,
			userId: erp.session.user.id,
			fullName: erp.employee.fullName,
			organizationId: erp.organizationId,
		});
		const id = (params: unknown) => projectIdParamSchema.parse(params).id;
		const child = (params: unknown) => projectChildParamSchema.parse(params);

		return domainPlugin({
			name: 'projects-employee-portal',
			prefix: '/projects/me',
			tags: ['Projects'],
			guards: 'employee-portal',
		})
			.get('/staff', async ({ erp }) => ok(await projects.staff(actorOf(erp))), {
				employeePortal: {},
				detail: { description: 'Organization members who can be a PIC or work a task (assignee picker)' },
			})
			.get('/projects', async ({ query, erp }) => okPaginated(await projects.list(actorOf(erp), projectListQuerySchema.parse(query))), {
				employeePortal: {},
				detail: { description: 'Projects the caller is the PIC of or has a live task in' },
			})
			.get('/projects/:id', async ({ params, erp }) => ok(await projects.get(actorOf(erp), id(params))), {
				employeePortal: {},
				detail: { description: 'Project detail (tasks, evidence, closing checklist) with `isPic`' },
			})
			.post(
				'/projects/:id/tasks',
				async ({ params, body, erp, status }) =>
					status(201, created(await projects.addTask(actorOf(erp), id(params), taskBodySchema.parse(body)))),
				{ employeePortal: {}, detail: { description: 'Adds a task (PIC only)' } },
			)
			.put(
				'/projects/:id/tasks/:childId',
				async ({ params, body, erp }) => {
					const { id: projectId, childId } = child(params);
					return ok(await projects.updateTask(actorOf(erp), projectId, childId, taskBodySchema.parse(body)));
				},
				{ employeePortal: {}, detail: { description: 'Updates a task (PIC only)' } },
			)
			.post(
				'/projects/:id/tasks/:childId/status',
				async ({ params, body, erp }) => {
					const { id: projectId, childId } = child(params);
					return ok(await projects.setTaskStatus(actorOf(erp), projectId, childId, taskStatusSchema.parse(body).status));
				},
				{ employeePortal: {}, detail: { description: 'Moves a task (own task, or any task as PIC)' } },
			)
			.delete(
				'/projects/:id/tasks/:childId',
				async ({ params, erp }) => {
					const { id: projectId, childId } = child(params);
					return ok(await projects.removeTask(actorOf(erp), projectId, childId));
				},
				{ employeePortal: {}, detail: { description: 'Removes a task (PIC only)' } },
			)
			.post(
				'/projects/:id/evidence',
				async ({ params, body, erp, status }) =>
					status(201, created(await projects.addEvidence(actorOf(erp), id(params), evidenceUploadSchema.parse(body)))),
				{ employeePortal: {}, detail: { description: 'Uploads evidence (own task, or any as PIC; JPG/PNG/WebP/PDF; 15 MB)' } },
			)
			.delete(
				'/projects/:id/evidence/:childId',
				async ({ params, erp }) => {
					const { id: projectId, childId } = child(params);
					return ok(await projects.removeEvidence(actorOf(erp), projectId, childId));
				},
				{ employeePortal: {}, detail: { description: 'Removes evidence (uploader, or any as PIC)' } },
			)
			.get('/site-attendance', async ({ query, erp }) => okPaginated(await attendance.listMine(actorOf(erp), siteAttendanceListQuerySchema.parse(query))), {
				employeePortal: {},
				detail: { description: "The caller's own site check-ins, newest first" },
			})
			.get(
				'/projects/:id/site-attendance',
				async ({ params, query, erp }) =>
					okPaginated(await attendance.listProject(actorOf(erp), id(params), siteAttendanceListQuerySchema.parse(query))),
				{ employeePortal: {}, detail: { description: "Everyone's site check-ins on the project (PIC only)" } },
			)
			.post('/site-attendance/check-in', async ({ body, erp, status }) =>
				status(201, created(await attendance.checkIn(actorOf(erp), siteCheckInSchema.parse(body)))),
			{
				employeePortal: {},
				detail: { description: 'Site check-in: mandatory selfie, PostGIS radius check, server-stamped time' },
			})
			.post(
				'/site-attendance/:id/check-out',
				async ({ params, body, erp }) => {
					const { id: attendanceId } = siteAttendanceIdParamSchema.parse(params);
					return ok(await attendance.checkOut(actorOf(erp), attendanceId, siteCheckOutSchema.parse(body)));
				},
				{ employeePortal: {}, detail: { description: 'Site check-out of the caller own visit' } },
			);
	}
}

