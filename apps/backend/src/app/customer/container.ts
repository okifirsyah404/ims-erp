import { PORTAL_SESSION_RESOLVER_TOKEN } from '@authorization/portal-auth';
import type { DependencyContainer } from 'tsyringe';

import { BetterAuthPortalSessionGateway } from './adapters/better-auth-portal-session';
import { QueuePortalMailer } from './adapters/queue-portal-mailer';
import {
	COMPANY_ADDRESS_REPOSITORY_TOKEN,
	COMPANY_REPOSITORY_TOKEN,
	CUSTOMER_ACCOUNT_SERVICE_TOKEN,
	CUSTOMER_ADDRESS_REPOSITORY_TOKEN,
	CUSTOMER_CODE_NUMBERING_REPOSITORY_TOKEN,
	CUSTOMER_NUMBERING_SERVICE_TOKEN,
	CUSTOMER_PERSON_REPOSITORY_TOKEN,
	CUSTOMER_SERVICE_TOKEN,
	EXPORTED_CUSTOMER_SERVICE_TOKEN,
	PORTAL_ACCOUNT_SERVICE_TOKEN,
	PORTAL_AUTH_SERVICE_TOKEN,
	PORTAL_MAILER_TOKEN,
	PORTAL_SERVICE_TOKEN,
	PORTAL_SESSION_GATEWAY_TOKEN,
} from './constants/di';
import {
	CompanyAddressRepository,
	CustomerAddressRepository,
} from './repositories/address.repository';
import { CompanyRepository } from './repositories/company.repository';
import { CustomerCodeNumberingRepository } from './repositories/code-numbering.repository';
import { CustomerNumberingService } from './services/customer-numbering.service';
import { CustomerPersonRepository } from './repositories/customer.repository';
import { CustomerService } from './services/customer.service';
import { CustomerAccountService } from './services/customer-account.service';
import { ExportedCustomerService } from './services/exported-customer.service';
import { PortalAccountService } from './services/portal-account.service';
import { PortalAuthService } from './services/portal-auth.service';
import { PortalService } from './services/portal.service';

export * from './constants/di';

/**
 * Registers the customer module's repositories, services, exported facade and
 * the customer portal (ADR-0024 Q28: the former `portal` module).
 *
 * @remarks
 * One repository per table (ADR-0024): companies, people, company addresses
 * and person addresses each get their own class. The portal owns no table: its
 * logins are columns of `customer.customers`, its users and credentials come
 * from `ExportedUserService` (the `user` module must be registered first), and
 * it provides the portal guard's session resolver.
 */
export function registerCustomer(container: DependencyContainer): void {
	container.register(COMPANY_REPOSITORY_TOKEN, {
		useClass: CompanyRepository,
	});
	container.register(CUSTOMER_PERSON_REPOSITORY_TOKEN, {
		useClass: CustomerPersonRepository,
	});
	container.register(COMPANY_ADDRESS_REPOSITORY_TOKEN, {
		useClass: CompanyAddressRepository,
	});
	container.register(CUSTOMER_ADDRESS_REPOSITORY_TOKEN, {
		useClass: CustomerAddressRepository,
	});
	container.register(CUSTOMER_ACCOUNT_SERVICE_TOKEN, {
		useClass: CustomerAccountService,
	});
	container.register(CUSTOMER_SERVICE_TOKEN, {
		useClass: CustomerService,
	});
	container.register(EXPORTED_CUSTOMER_SERVICE_TOKEN, {
		useClass: ExportedCustomerService,
	});
	// Numbering (`customer.code_numberings`).
	container.register(CUSTOMER_CODE_NUMBERING_REPOSITORY_TOKEN, {
		useClass: CustomerCodeNumberingRepository,
	});
	container.register(CUSTOMER_NUMBERING_SERVICE_TOKEN, {
		useClass: CustomerNumberingService,
	});

	// Customer portal.
	container.register(PORTAL_MAILER_TOKEN, { useClass: QueuePortalMailer });
	container.register(PORTAL_SESSION_GATEWAY_TOKEN, { useClass: BetterAuthPortalSessionGateway });
	container.register(PORTAL_ACCOUNT_SERVICE_TOKEN, { useClass: PortalAccountService });
	container.register(PORTAL_AUTH_SERVICE_TOKEN, { useClass: PortalAuthService });
	container.register(PORTAL_SESSION_RESOLVER_TOKEN, { useToken: PORTAL_AUTH_SERVICE_TOKEN });
	container.register(PORTAL_SERVICE_TOKEN, { useClass: PortalService });
}
