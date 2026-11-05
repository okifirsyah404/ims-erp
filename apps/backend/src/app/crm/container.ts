import type { DependencyContainer } from 'tsyringe';
import {
	CUSTOMER_CONTACT_REPOSITORY_TOKEN,
	CUSTOMER_REPOSITORY_TOKEN,
	CUSTOMER_SERVICE_TOKEN,
} from './constants/di';
import { CustomerContactRepository } from './repositories/customer-contact.repository';
import { CustomerRepository } from './repositories/customer.repository';
import { CustomerService } from './services/customer.service';

export * from './constants/di';

/** Registers the CRM module's repositories and services. */
export function registerCrm(container: DependencyContainer): void {
	container.register(CUSTOMER_REPOSITORY_TOKEN, { useClass: CustomerRepository });
	container.register(CUSTOMER_CONTACT_REPOSITORY_TOKEN, { useClass: CustomerContactRepository });
	container.register(CUSTOMER_SERVICE_TOKEN, { useClass: CustomerService });
}
