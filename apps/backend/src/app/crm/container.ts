import type { DependencyContainer } from 'tsyringe';
import {
	CUSTOMER_ADDRESS_REPOSITORY_TOKEN,
	CUSTOMER_ADDRESS_SERVICE_TOKEN,
	CUSTOMER_CONTACT_REPOSITORY_TOKEN,
	CUSTOMER_REPOSITORY_TOKEN,
	CUSTOMER_SERVICE_TOKEN,
	LEAD_ACTIVITY_REPOSITORY_TOKEN,
	LEAD_REPOSITORY_TOKEN,
	LEAD_SERVICE_TOKEN,
	WEBSITE_INQUIRY_SERVICE_TOKEN,
} from './constants/di';
import { CustomerContactRepository } from './repositories/customer-contact.repository';
import { CustomerAddressRepository } from './repositories/customer-address.repository';
import { CustomerAddressService } from './services/customer-address.service';
import { CustomerRepository } from './repositories/customer.repository';
import { CustomerService } from './services/customer.service';
import { LeadActivityRepository } from './repositories/lead-activity.repository';
import { LeadRepository } from './repositories/lead.repository';
import { LeadService } from './services/lead.service';
import { WebsiteInquiryService } from './services/website-inquiry.service';

export * from './constants/di';

/** Registers the CRM module's repositories and services. */
export function registerCrm(container: DependencyContainer): void {
	container.register(CUSTOMER_REPOSITORY_TOKEN, { useClass: CustomerRepository });
	container.register(CUSTOMER_CONTACT_REPOSITORY_TOKEN, { useClass: CustomerContactRepository });
	container.register(CUSTOMER_SERVICE_TOKEN, { useClass: CustomerService });
	container.register(CUSTOMER_ADDRESS_REPOSITORY_TOKEN, { useClass: CustomerAddressRepository });
	container.register(CUSTOMER_ADDRESS_SERVICE_TOKEN, { useClass: CustomerAddressService });
	container.register(LEAD_REPOSITORY_TOKEN, { useClass: LeadRepository });
	container.register(LEAD_ACTIVITY_REPOSITORY_TOKEN, { useClass: LeadActivityRepository });
	container.register(LEAD_SERVICE_TOKEN, { useClass: LeadService });
	container.register(WEBSITE_INQUIRY_SERVICE_TOKEN, { useClass: WebsiteInquiryService });
}
