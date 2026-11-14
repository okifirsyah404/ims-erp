import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok } from '@http/response';
import { PORTAL_ACCOUNT_SERVICE_TOKEN } from '../constants/di';
import { inviteCustomerPortalSchema, portalAccountIdParamSchema, portalAccountQuerySchema } from '../contracts/portal-account.contract';

/**
 * Staff side of the customer portal logins (`/admin/portal-accounts`,
 * ERP-0022): see a customer's login, invite it, resend the password link,
 * revoke it. Permission `portal_account:read | invite | revoke`.
 */
export class PortalAccountController {
	static plugin() {
		const service = container.resolve(PORTAL_ACCOUNT_SERVICE_TOKEN);
		const id = (params: unknown) => portalAccountIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'user-portal-accounts', prefix: '/admin/portal-accounts', tags: ['Customer portal'], guards: 'erp' })
			.get('', async ({ query }) => ok(await service.getForCustomer(portalAccountQuerySchema.parse(query).customerId)), {
				erp: { permission: ['portal_account:read'] },
				detail: { description: "The customer's live portal login, or null" },
			})
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.invite(erp.session.user.id, inviteCustomerPortalSchema.parse(body)))),
				{ erp: { permission: ['portal_account:invite'] }, detail: { description: 'Creates the login and emails a "set your password" link' } },
			)
			.post('/:id/resend', async ({ params }) => ok(await service.resend(id(params))), {
				erp: { permission: ['portal_account:invite'] },
				detail: { description: 'Emails a fresh "set your password" link' },
			})
			.post(
				'/:id/revoke',
				async ({ params }) => {
					await service.revoke(id(params));
					return noContent();
				},
				{ erp: { permission: ['portal_account:revoke'] }, detail: { description: 'Revokes the login and ends its sessions' } },
			);
	}
}
