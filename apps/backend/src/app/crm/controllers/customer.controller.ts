import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import { CUSTOMER_ADDRESS_SERVICE_TOKEN, CUSTOMER_CHANGE_REQUEST_SERVICE_TOKEN, CUSTOMER_SERVICE_TOKEN } from '../constants/di';
import { changeDecisionSchema, changeRequestParamSchema } from '../contracts/customer-change-request.contract';
import { requestBodyDoc } from '@http/openapi';
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
		const addresses = container.resolve(CUSTOMER_ADDRESS_SERVICE_TOKEN);
		const changeRequests = container.resolve(CUSTOMER_CHANGE_REQUEST_SERVICE_TOKEN);

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
			.get(
				'/:id/addresses',
				async ({ params }) => ok(await addresses.list(idParamSchema.parse(params).id)),
				{
					erp: { permission: ['customer:read'] },
					detail: { description: 'Addresses of a customer, primary first; installation sites (kind site) are kept by the customer in the portal (ERP-0075)' },
				},
			)
			.get('/:id/change-requests', async ({ params }) => ok(await changeRequests.list(idParamSchema.parse(params).id)), {
				erp: { permission: ['customer:read'] },
				detail: { description: 'Company-data change requests from the customer portal (ERP-0076), newest first' },
			})
			.post(
				'/:id/change-requests/:requestId/approve',
				async ({ params, body, erp }) => {
					const { id, requestId } = changeRequestParamSchema.parse(params);
					return ok(await changeRequests.approve(id, requestId, erp.session.user.id, changeDecisionSchema.parse(body ?? {}).note ?? null));
				},
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Approves the pending request: its values are written to the customer; 409 when it is not pending', ...requestBodyDoc(changeDecisionSchema) },
				},
			)
			.post(
				'/:id/change-requests/:requestId/reject',
				async ({ params, body, erp }) => {
					const { id, requestId } = changeRequestParamSchema.parse(params);
					return ok(await changeRequests.reject(id, requestId, erp.session.user.id, changeDecisionSchema.parse(body ?? {}).note ?? null));
				},
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Rejects the pending request (the customer keeps its data); 409 when it is not pending', ...requestBodyDoc(changeDecisionSchema) },
				},
			)
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
