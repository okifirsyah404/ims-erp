import type { TPaginationResult } from '@ims-erp/common';
import type {
	CustomerStatus,
	TCustomerContactSelect,
	TCustomerSelect,
} from '@drizzle/schemas/crm.schema';
import type {
	TCreateContactInput,
	TCreateCustomerInput,
	TCustomerListQuery,
	TUpdateContactInput,
	TUpdateCustomerInput,
} from './customer.contract';

/** Persistence port for `crm.customers` (live rows only). */
export interface ICustomerRepository {
	paginate(query: TCustomerListQuery): Promise<TPaginationResult<TCustomerSelect>>;

	findById(id: string): Promise<TCustomerSelect | null>;

	findByCode(code: string): Promise<TCustomerSelect | null>;

	create(data: TCreateCustomerInput & { createdBy: string }): Promise<TCustomerSelect>;

	update(id: string, patch: TUpdateCustomerInput): Promise<TCustomerSelect | null>;

	/** Moves `from` → `to`; `null` when the customer is not in `from`. */
	transitionStatus(id: string, from: CustomerStatus, to: CustomerStatus): Promise<TCustomerSelect | null>;
}

/** Persistence port for `crm.customer_contacts` (live rows only). */
export interface ICustomerContactRepository {
	/** Primary contact first, then by name. */
	listByCustomer(customerId: string): Promise<TCustomerContactSelect[]>;

	/** One live contact of the customer, or `null`. */
	findById(customerId: string, id: string): Promise<TCustomerContactSelect | null>;

	/** Creates a contact; a new primary clears the previous one. */
	create(customerId: string, data: TCreateContactInput): Promise<TCustomerContactSelect>;

	update(customerId: string, id: string, patch: TUpdateContactInput): Promise<TCustomerContactSelect | null>;

	softDelete(customerId: string, id: string): Promise<boolean>;
}
