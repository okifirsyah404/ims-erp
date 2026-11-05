import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import { CUSTOMER_SERVICE_TOKEN } from '../constants/di';
import {
	contactParamSchema,
	createCustomerSchema,
	customerContactSchema,
	customerListQuerySchema,
	idParamSchema,
	updateCustomerContactSchema,
	updateCustomerSchema,
} from '../contracts/customer.contract';

/**
 * REST controller for customers and their contacts (`/customers`).
 *
 * @remarks
 * HTTP concerns only. Customers are company-wide (ADR-0011): the caller's
 * organization decides the permissions, not which customers exist. The
 * actor always comes from `ctx.erp`, never from the body.
 */
export class CustomerController {
	static plugin() {
		const service = container.resolve(CUSTOMER_SERVICE_TOKEN);

		return domainPlugin({ name: 'crm-customers', prefix: '/customers', tags: ['CRM'], guards: 'erp' })
			.get('', async ({ query }) => okPaginated(await service.list(customerListQuerySchema.parse(query))), {
				erp: { permission: ['customer:read'] },
				detail: { description: 'Paginated customers' },
			})
			.get('/:id', async ({ params }) => ok(await service.get(idParamSchema.parse(params).id)), {
				erp: { permission: ['customer:read'] },
				detail: { description: 'One customer with its contacts' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.create(createCustomerSchema.parse(body), erp.session.user.id))),
				{ erp: { permission: ['customer:create'] }, detail: { description: 'Creates a customer' } },
			)
			.patch(
				'/:id',
				async ({ params, body }) =>
					ok(await service.update(idParamSchema.parse(params).id, updateCustomerSchema.parse(body))),
				{ erp: { permission: ['customer:update'] }, detail: { description: 'Updates a customer' } },
			)
			.post('/:id/deactivate', async ({ params }) => ok(await service.setActive(idParamSchema.parse(params).id, false)), {
				erp: { permission: ['customer:archive'] },
				detail: { description: 'Deactivates a customer (no new documents)' },
			})
			.post('/:id/activate', async ({ params }) => ok(await service.setActive(idParamSchema.parse(params).id, true)), {
				erp: { permission: ['customer:archive'] },
				detail: { description: 'Reactivates a customer' },
			})
			.post(
				'/:id/contacts',
				async ({ params, body, status }) =>
					status(
						201,
						created(await service.addContact(idParamSchema.parse(params).id, customerContactSchema.parse(body))),
					),
				{ erp: { permission: ['customer:update'] }, detail: { description: 'Adds a contact' } },
			)
			.patch(
				'/:id/contacts/:contactId',
				async ({ params, body }) => {
					const { id, contactId } = contactParamSchema.parse(params);
					return ok(await service.updateContact(id, contactId, updateCustomerContactSchema.parse(body)));
				},
				{ erp: { permission: ['customer:update'] }, detail: { description: 'Updates a contact' } },
			)
			.delete(
				'/:id/contacts/:contactId',
				async ({ params }) => {
					const { id, contactId } = contactParamSchema.parse(params);
					await service.removeContact(id, contactId);
					return noContent();
				},
				{ erp: { permission: ['customer:update'] }, detail: { description: 'Removes a contact (soft delete)' } },
			);
	}
}
