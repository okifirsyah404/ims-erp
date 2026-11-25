import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { businessDateOf } from '@utils/business-date.util';
import { container } from 'tsyringe';
import { z } from 'zod';
import { PAYSLIP_SERVICE_TOKEN } from '../constants/di';
import { recordIdParamSchema } from '../contracts/hr-records.contract';
import { payslipZipQuerySchema } from '../contracts/payslip.contract';
import { HrNotFoundError } from '../errors/hr.errors';
import { hrContext } from './hr-context';

/**
 * Payslips on the Payroll page (ERP-0122, grill-me Q35/Q37). Downloading one
 * or all (ZIP) needs `payroll:read`; regenerating a failed PDF
 * `payroll:update`. Only employees the caller sees (ERP-0034 scope).
 */
export class PayslipController {
	static plugin() {
		const service = container.resolve(PAYSLIP_SERVICE_TOKEN);
		const context = hrContext();
		const id = (params: unknown) => recordIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'hr-payslips', prefix: '/human-resources/salary-records', tags: ['Human Resource'], guards: 'erp' })
			.get(
				'/payslips.zip',
				async ({ query, erp }) => {
					const { period } = payslipZipQuerySchema.parse(query);
					const ctx = await context(erp);
					const bytes = await service.zip(ctx.scope, period, ctx.actorUserId);
					const [year = '', month = '', day = ''] = businessDateOf().split('-');
					const fileName = `slip_gaji_${period.replace('-', '_')}_${day}_${month}_${year}.zip`;
					return new Response(new Blob([bytes as BlobPart]), {
						headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${fileName}"` },
					});
				},
				{ erp: { permission: ['payroll:read'] }, detail: { description: 'Every ready payslip of a period in one ZIP' } },
			)
			.get(
				'/:id/payslip',
				async ({ params, erp }) => {
					const ctx = await context(erp);
					return ok(await service.download(ctx.scope, id(params), ctx.actorUserId));
				},
				{ erp: { permission: ['payroll:read'] }, detail: { description: 'A short-lived download URL of one payslip' } },
			)
			.post(
				'/:id/payslip/regenerate',
				async ({ params, erp }) => ok(await service.regenerate((await context(erp)).scope, id(params))),
				{ erp: { permission: ['payroll:update'] }, detail: { description: 'Queues the payslip PDF again (after a failed render)' } },
			);
	}
}

/**
 * The signed-in user's own payslips (`/users/me/payslips`, ERP-0122, grill-me
 * Q35). Session only: the employee is resolved from the session's user, so
 * nobody can read another person's payslip; anything else answers 404.
 */
export class MyPayslipController {
	static plugin() {
		const service = container.resolve(PAYSLIP_SERVICE_TOKEN);
		return domainPlugin({ name: 'hr-my-payslips', prefix: '/users/me/payslips', tags: ['Human Resource'], guards: 'session' })
			.get('', async ({ erp }) => ok(await service.mine(erp.session.user.id)), {
				erpSession: { session: true },
				detail: { description: "The caller's own payslips, newest period first" },
			})
			.get(
				'/:id/download',
				async ({ params, erp }) => {
					const parsed = z.object({ id: z.uuid() }).safeParse(params);
					if (!parsed.success) throw new HrNotFoundError('salary');
					return ok(await service.downloadMine(erp.session.user.id, parsed.data.id));
				},
				{ erpSession: { session: true }, detail: { description: 'A short-lived download URL of one of the caller’s payslips' } },
			);
	}
}

/**
 * Public render data of the payslip print view
 * (`/human-resources/public/v1/render/payslips/:id?token=…`, ERP-0122). The
 * short-lived render token is the only credential.
 */
export class PayslipRenderController {
	static plugin(prefix = '/human-resources/public/v1/render/payslips') {
		const service = container.resolve(PAYSLIP_SERVICE_TOKEN);
		return domainPlugin({ name: `payslip-render:${prefix}`, prefix, tags: ['Human Resource'] }).get(
			'/:id',
			async ({ params, query }) => {
				const { id } = z.object({ id: z.uuid() }).parse(params);
				const { token } = z.object({ token: z.string().min(1).max(200) }).parse(query);
				const data = await service.renderData(id, token);
				if (!data) throw new HrNotFoundError('document');
				return ok(data);
			},
			{ detail: { description: 'Payslip data for the print view (render token, no session)' } },
		);
	}
}
