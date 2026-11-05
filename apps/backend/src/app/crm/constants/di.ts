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
import type {
	ILeadActivityRepository,
	ILeadRepository,
} from '../contracts/lead.repository.interface';
import type { LeadService } from '../services/lead.service';
import type { WebsiteInquiryService } from '../services/website-inquiry.service';

export const CUSTOMER_REPOSITORY_TOKEN: InjectionToken<ICustomerRepository> = Symbol('CUSTOMER_REPOSITORY');
export const CUSTOMER_CONTACT_REPOSITORY_TOKEN: InjectionToken<ICustomerContactRepository> =
	Symbol('CUSTOMER_CONTACT_REPOSITORY');
export const CUSTOMER_SERVICE_TOKEN: InjectionToken<CustomerService> = Symbol('CUSTOMER_SERVICE');
export const LEAD_REPOSITORY_TOKEN: InjectionToken<ILeadRepository> = Symbol('LEAD_REPOSITORY');
export const LEAD_ACTIVITY_REPOSITORY_TOKEN: InjectionToken<ILeadActivityRepository> =
	Symbol('LEAD_ACTIVITY_REPOSITORY');
export const LEAD_SERVICE_TOKEN: InjectionToken<LeadService> = Symbol('LEAD_SERVICE');
export const WEBSITE_INQUIRY_SERVICE_TOKEN: InjectionToken<WebsiteInquiryService> =
	Symbol('WEBSITE_INQUIRY_SERVICE');
