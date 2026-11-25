import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { PAYROLL_SCHEDULE_SERVICE_TOKEN, PAYROLL_STATUTORY_SERVICE_TOKEN } from '../constants/di';
import { payrollSettingsSchema, payrollStatutorySchema } from '../contracts/payroll-settings.contract';

/**
 * Payroll settings (`/settings/payroll`, ERP-0120): the company-wide payday
 * of the daily draft run. Application administrators only (grill-me Q31),
 * read and write alike — `adminOrErpGuard` with `appAdminOnly`.
 */
export class PayrollSettingsController {
	static plugin() {
		const service = container.resolve(PAYROLL_SCHEDULE_SERVICE_TOKEN);
		const statutory = container.resolve(PAYROLL_STATUTORY_SERVICE_TOKEN);
		const appAdminOnly = { appAdminOnly: true } as const;

		return domainPlugin({ name: 'hr-payroll-settings', prefix: '/human-resources/payroll-settings', tags: ['Human Resource'], guards: 'admin-or-erp' })
			.get('', async () => ok(await service.get()), {
				adminOrErp: appAdminOnly,
				detail: { description: 'The payday and the next run date (application admins only)' },
			})
			.put('', async ({ body, erp }) => ok(await service.save(erp.session.user.id, payrollSettingsSchema.parse(body))), {
				adminOrErp: appAdminOnly,
				detail: { description: 'Sets the payday (1-31, null turns the run off; application admins only)' },
			})
			.get('/statutory', async () => ok(await statutory.get()), {
				adminOrErp: appAdminOnly,
				detail: { description: 'PPh 21 and BPJS toggles and parameters (ERP-0138; application admins only)' },
			})
			.put(
				'/statutory',
				async ({ body, erp }) => ok(await statutory.save(erp.session.user.id, payrollStatutorySchema.parse(body))),
				{
					adminOrErp: appAdminOnly,
					detail: { description: 'Sets the PPh 21 and BPJS toggles and parameters (application admins only)' },
				},
			);
	}
}
