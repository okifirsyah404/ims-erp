import { EXPORTED_NOTIFICATION_SERVICE_TOKEN } from '@app/notification/constants/di';
import type { ExportedNotificationService } from '@app/notification/services/exported-notification.service';
import type { TCompanyChanges, TCustomerChangeRequestSelect } from '@drizzle/schemas/crm.schema';
import { inject, injectable } from 'tsyringe';
import { CUSTOMER_CHANGE_REQUEST_REPOSITORY_TOKEN, CUSTOMER_SERVICE_TOKEN } from '../constants/di';
import type { ICustomerChangeRequestRepository, TCompanyChangeInput } from '../contracts/customer-change-request.contract';
import { CustomerChangeNotCompanyError, CustomerChangeNotPendingError, CustomerChangeUnchangedError, CustomerNotFoundError } from '../errors/crm.errors';
import type { CustomerService } from './customer.service';

/** The business labels of the fields (stored in Indonesian for the notification, like lead summaries). */
const FIELD_LABEL: Record<keyof TCompanyChanges, string> = { name: 'nama', taxId: 'NPWP', industry: 'bidang usaha' };

/**
 * Company-data change requests (ERP-0076). The customer portal asks
 * (`request`); staff with `customer:update` approve or reject. Approving
 * writes the requested values to the customer; a new request supersedes a
 * pending one. The account manager is notified of each request.
 */
@injectable()
export class CustomerChangeRequestService {
	constructor(
		@inject(CUSTOMER_CHANGE_REQUEST_REPOSITORY_TOKEN) private readonly requests: ICustomerChangeRequestRepository,
		@inject(CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<CustomerService, 'getActiveCustomer' | 'update'>,
		@inject(EXPORTED_NOTIFICATION_SERVICE_TOKEN) private readonly notifications: Pick<ExportedNotificationService, 'notify'>,
	) {}

	/**
	 * Records what differs from the customer's current values.
	 *
	 * @throws {CustomerNotFoundError} the customer is gone or inactive
	 * @throws {CustomerChangeNotCompanyError} an individual customer has no company data
	 * @throws {CustomerChangeUnchangedError} nothing differs
	 */
	async request(customerId: string, actor: { userId: string; name: string }, input: TCompanyChangeInput): Promise<TCustomerChangeRequestSelect> {
		const customer = await this.customers.getActiveCustomer(customerId);
		if (!customer) throw new CustomerNotFoundError();
		if (customer.customerType === 'individual') throw new CustomerChangeNotCompanyError();
		const wanted = input;
		const current: TCompanyChanges = { name: customer.name, taxId: customer.taxId ?? null, industry: customer.industry ?? null };
		const changes: TCompanyChanges = {};
		const previous: TCompanyChanges = {};
		if (wanted.name !== current.name) {
			changes.name = wanted.name;
			previous.name = current.name;
		}
		// No NPWP sent means "leave it"; an empty one clears it.
		if (wanted.npwp !== undefined && wanted.npwp !== current.taxId) {
			changes.taxId = wanted.npwp;
			previous.taxId = current.taxId;
		}
		if (wanted.industry !== current.industry) {
			changes.industry = wanted.industry;
			previous.industry = current.industry;
		}
		if (Object.keys(changes).length === 0) throw new CustomerChangeUnchangedError();
		const created = await this.requests.create({ customerId, changes, previous, requestedByUserId: actor.userId, requestedByName: actor.name });
		if (customer.ownerUserId) {
			await this.notifications.notify({
				userIds: [customer.ownerUserId],
				templateCode: 'crm.company_change_requested',
				variables: {
					customerName: customer.name,
					requestedBy: actor.name,
					fields: (Object.keys(changes) as (keyof TCompanyChanges)[]).map((key) => FIELD_LABEL[key]).join(', '),
				},
				tags: [customer.code],
				sourceType: 'customer',
				sourceId: customer.id,
			});
		}
		return created;
	}

	list(customerId: string): Promise<TCustomerChangeRequestSelect[]> {
		return this.requests.list(customerId, 20);
	}

	pending(customerId: string): Promise<TCustomerChangeRequestSelect | null> {
		return this.requests.findPending(customerId);
	}

	/**
	 * Writes the requested values to the customer.
	 *
	 * @throws {CustomerChangeNotPendingError} not this customer's pending request
	 */
	async approve(customerId: string, id: string, actorUserId: string, note: string | null): Promise<TCustomerChangeRequestSelect> {
		const pending = await this.requests.findPending(customerId);
		if (!pending || pending.id !== id) throw new CustomerChangeNotPendingError();
		const { name, taxId, industry } = pending.changes;
		await this.customers.update(customerId, {
			...(name !== undefined ? { name } : {}),
			...(taxId !== undefined ? { taxId } : {}),
			...(industry !== undefined ? { industry } : {}),
		});
		const decided = await this.requests.decide(id, 'approved', actorUserId, note);
		if (!decided) throw new CustomerChangeNotPendingError();
		return decided;
	}

	/** @throws {CustomerChangeNotPendingError} not this customer's pending request */
	async reject(customerId: string, id: string, actorUserId: string, note: string | null): Promise<TCustomerChangeRequestSelect> {
		const pending = await this.requests.findPending(customerId);
		if (!pending || pending.id !== id) throw new CustomerChangeNotPendingError();
		const decided = await this.requests.decide(id, 'rejected', actorUserId, note);
		if (!decided) throw new CustomerChangeNotPendingError();
		return decided;
	}
}
