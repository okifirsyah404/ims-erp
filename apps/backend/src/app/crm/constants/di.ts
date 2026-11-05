/**
 * Injection tokens for the CRM module.
 *
 * @remarks
 * `CUSTOMER_SERVICE_TOKEN` is the module's exported API for other modules
 * (e.g. sales resolving the customer of a quotation).
 */
import type { InjectionToken } from 'tsyringe';
import type {
	ICustomerContactRepository,
	ICustomerRepository,
} from '../contracts/customer.repository.interface';
import type { CustomerService } from '../services/customer.service';

export const CUSTOMER_REPOSITORY_TOKEN: InjectionToken<ICustomerRepository> = Symbol('CUSTOMER_REPOSITORY');
export const CUSTOMER_CONTACT_REPOSITORY_TOKEN: InjectionToken<ICustomerContactRepository> =
	Symbol('CUSTOMER_CONTACT_REPOSITORY');
export const CUSTOMER_SERVICE_TOKEN: InjectionToken<CustomerService> = Symbol('CUSTOMER_SERVICE');
