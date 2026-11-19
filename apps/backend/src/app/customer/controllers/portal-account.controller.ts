import { domainPlugin } from '@http/plugin';
import { created, noContent, ok } from '@http/response';
import { container } from 'tsyringe';
import { PORTAL_ACCOUNT_SERVICE_TOKEN } from '../constants/di';
import {
	inviteCustomerPortalSchema,
	portalAccountIdParamSchema,
	portalAccountQuerySchema,
} from '../contracts/portal-account.contract';

/**
 * Staff side of the customer portal logins (`/admin/customers/portal-accounts`,
 * ERP-0022): see a company's (or an individual's) logins, invite one, resend
 * the password link, revoke it. Permission `portal_account:read | invite |
 * revoke`. A login is the person's `customer.customers` row, so `:id` is the
 * person id.
 */
export class PortalAccountController {
	static plugin() {
		const service = container.resolve(PORTAL_ACCOUNT_SERVICE_TOKEN);
		const id = (params: unknown) => portalAccountIdParamSchema.parse(params).id;

		return domainPlugin({
			name: 'customer-portal-accounts',
			prefix: '/admin/customers/portal-accounts',
			tags: ['Customer portal'],
			guards: 'erp',
		})
			.get('', async ({ query }) => ok(await service.listForScope(portalAccountQuerySchema.parse(query))), {
				erp: { permission: ['portal_account:read'] },
				detail: { description: "A company's (or an individual customer's) live portal logins" },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.invite(erp.session.user.id, inviteCustomerPortalSchema.parse(body)))),
				{
					erp: { permission: ['portal_account:invite'] },
					detail: {
						description:
							'Invites one person (an existing customerId, or a new contact under companyId) with a role and emails a "set your password" link',
					},
				},
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
				{
					erp: { permission: ['portal_account:revoke'] },
					detail: { description: 'Revokes the login and ends its sessions' },
				},
			);
	}
}
