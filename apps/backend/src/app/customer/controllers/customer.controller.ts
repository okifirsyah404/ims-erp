import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import { CUSTOMER_SERVICE_TOKEN } from '../constants/di';
import {
	addressParamSchema,
	companyAddressSchema,
	companyListQuerySchema,
	createCompanySchema,
	createCustomerSchema,
	customerAddressSchema,
	customerListQuerySchema,
	idParamSchema,
	updateCompanyAddressSchema,
	updateCompanySchema,
	updateCustomerAddressSchema,
	updateCustomerSchema,
} from '../contracts/customer.contract';

/**
 * REST controller for the customer master (`/customers`).
 *
 * @remarks
 * HTTP concerns only. Customers are company-wide (ADR-0011). The actor always
 * comes from `ctx.erp`, never from the body. Companies live under
 * `/customers/companies`, people under `/customers/people`, and each carries
 * its own address collection.
 */
export class CustomerController {
	static plugin() {
		const service = container.resolve(CUSTOMER_SERVICE_TOKEN);

		return domainPlugin({
			name: 'customer-master',
			prefix: '/customers',
			tags: ['Customer'],
			guards: 'erp',
		})
			.get(
				'/companies',
				async ({ query }) =>
					okPaginated(
						await service.listCompanies(
							companyListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['customer:read'] },
					detail: { description: 'Paginated customer companies' },
				},
			)
			.get(
				'/companies/:id',
				async ({ params }) =>
					ok(
						await service.getCompany(idParamSchema.parse(params).id),
					),
				{
					erp: { permission: ['customer:read'] },
					detail: { description: 'One company with its addresses' },
				},
			)
			.post(
				'/companies',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await service.createCompany(
								createCompanySchema.parse(body),
								erp.session.user.id,
								erp.organizationId,
							),
						),
					),
				{
					erp: { permission: ['customer:create'] },
					detail: { description: 'Creates a customer company' },
				},
			)
			.patch(
				'/companies/:id',
				async ({ params, body }) =>
					ok(
						await service.updateCompany(
							idParamSchema.parse(params).id,
							updateCompanySchema.parse(body),
						),
					),
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Updates a customer company' },
				},
			)
			.post(
				'/companies/:id/activate',
				async ({ params }) =>
					ok(
						await service.setCompanyActive(
							idParamSchema.parse(params).id,
							true,
						),
					),
				{
					erp: { permission: ['customer:archive'] },
					detail: { description: 'Reactivates a company' },
				},
			)
			.post(
				'/companies/:id/deactivate',
				async ({ params }) =>
					ok(
						await service.setCompanyActive(
							idParamSchema.parse(params).id,
							false,
						),
					),
				{
					erp: { permission: ['customer:archive'] },
					detail: {
						description: 'Deactivates a company (no new documents)',
					},
				},
			)
			.post(
				'/companies/:id/addresses',
				async ({ params, body, status }) =>
					status(
						201,
						created(
							await service.addCompanyAddress(
								idParamSchema.parse(params).id,
								companyAddressSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Adds a company address' },
				},
			)
			.patch(
				'/companies/:id/addresses/:addressId',
				async ({ params, body }) => {
					const { id, addressId } = addressParamSchema.parse(params);
					return ok(
						await service.updateCompanyAddress(
							id,
							addressId,
							updateCompanyAddressSchema.parse(body),
						),
					);
				},
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Updates a company address' },
				},
			)
			.delete(
				'/companies/:id/addresses/:addressId',
				async ({ params }) => {
					const { id, addressId } = addressParamSchema.parse(params);
					await service.removeCompanyAddress(id, addressId);
					return noContent();
				},
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Removes a company address' },
				},
			)
			.get(
				'/people',
				async ({ query }) =>
					okPaginated(
						await service.listCustomers(
							customerListQuerySchema.parse(query),
						),
					),
				{
					erp: { permission: ['customer:read'] },
					detail: { description: 'Paginated customer people' },
				},
			)
			.get(
				'/people/:id',
				async ({ params }) =>
					ok(
						await service.getCustomer(idParamSchema.parse(params).id),
					),
				{
					erp: { permission: ['customer:read'] },
					detail: { description: 'One person with their addresses' },
				},
			)
			.post(
				'/people',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await service.createCustomer(
								createCustomerSchema.parse(body),
								erp.session.user.id,
								erp.organizationId,
							),
						),
					),
				{
					erp: { permission: ['customer:create'] },
					detail: { description: 'Creates a customer person' },
				},
			)
			.patch(
				'/people/:id',
				async ({ params, body }) =>
					ok(
						await service.updateCustomer(
							idParamSchema.parse(params).id,
							updateCustomerSchema.parse(body),
						),
					),
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Updates a customer person' },
				},
			)
			.post(
				'/people/:id/activate',
				async ({ params }) =>
					ok(
						await service.setCustomerActive(
							idParamSchema.parse(params).id,
							true,
						),
					),
				{
					erp: { permission: ['customer:archive'] },
					detail: { description: 'Reactivates a person' },
				},
			)
			.post(
				'/people/:id/deactivate',
				async ({ params }) =>
					ok(
						await service.setCustomerActive(
							idParamSchema.parse(params).id,
							false,
						),
					),
				{
					erp: { permission: ['customer:archive'] },
					detail: { description: 'Deactivates a person' },
				},
			)
			.post(
				'/people/:id/addresses',
				async ({ params, body, status }) =>
					status(
						201,
						created(
							await service.addCustomerAddress(
								idParamSchema.parse(params).id,
								customerAddressSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Adds a person address' },
				},
			)
			.patch(
				'/people/:id/addresses/:addressId',
				async ({ params, body }) => {
					const { id, addressId } = addressParamSchema.parse(params);
					return ok(
						await service.updateCustomerAddress(
							id,
							addressId,
							updateCustomerAddressSchema.parse(body),
						),
					);
				},
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Updates a person address' },
				},
			)
			.delete(
				'/people/:id/addresses/:addressId',
				async ({ params }) => {
					const { id, addressId } = addressParamSchema.parse(params);
					await service.removeCustomerAddress(id, addressId);
					return noContent();
				},
				{
					erp: { permission: ['customer:update'] },
					detail: { description: 'Removes a person address' },
				},
			);
	}
}
