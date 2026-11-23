import { InjectionToken } from 'tsyringe';
import type { IPortalMailer } from '../contracts/portal-account.contract';
import type { IPortalSessionGateway } from '../contracts/portal.contract';
import type {
	ICompanyAddressRepository,
	ICompanyRepository,
	ICustomerAddressRepository,
	ICustomerPersonRepository,
} from '../contracts/customer.repository.interface';
import type { CustomerService } from '../services/customer.service';
import type { CustomerAccountService } from '../services/customer-account.service';
import type { CustomerNumberingService } from '../services/customer-numbering.service';
import type { CustomerCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { ExportedCustomerService } from '../services/exported-customer.service';
import type { PortalAccountService } from '../services/portal-account.service';
import type { PortalAuthService } from '../services/portal-auth.service';
import type { PortalService } from '../services/portal.service';

/** Token resolving to the {@link ICompanyRepository} implementation. */
export const COMPANY_REPOSITORY_TOKEN: InjectionToken<ICompanyRepository> =
	Symbol('CUSTOMER_COMPANY_REPOSITORY');

/** Token resolving to the {@link ICustomerPersonRepository} implementation. */
export const CUSTOMER_PERSON_REPOSITORY_TOKEN: InjectionToken<ICustomerPersonRepository> =
	Symbol('CUSTOMER_PERSON_REPOSITORY');

/** Token resolving to the {@link ICompanyAddressRepository} implementation. */
export const COMPANY_ADDRESS_REPOSITORY_TOKEN: InjectionToken<ICompanyAddressRepository> =
	Symbol('CUSTOMER_COMPANY_ADDRESS_REPOSITORY');

/** Token resolving to the {@link ICustomerAddressRepository} implementation. */
export const CUSTOMER_ADDRESS_REPOSITORY_TOKEN: InjectionToken<ICustomerAddressRepository> =
	Symbol('CUSTOMER_ADDRESS_REPOSITORY');

/** Token resolving to the {@link CustomerAccountService} (Better Auth account of a person, ERP-0114). */
export const CUSTOMER_ACCOUNT_SERVICE_TOKEN: InjectionToken<CustomerAccountService> = Symbol(
	'CUSTOMER_ACCOUNT_SERVICE',
);

/** Token resolving to the {@link CustomerService} implementation. */
export const CUSTOMER_SERVICE_TOKEN: InjectionToken<CustomerService> = Symbol(
	'CUSTOMER_SERVICE',
);

/** Token resolving to the repository of `customer.code_numberings`. */
export const CUSTOMER_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<CustomerCodeNumberingRepository> =
	Symbol('CUSTOMER_CODE_NUMBERING_REPOSITORY');

/** Token resolving to the {@link CustomerNumberingService} (codes + numbering settings). */
export const CUSTOMER_NUMBERING_SERVICE_TOKEN: InjectionToken<CustomerNumberingService> =
	Symbol('CUSTOMER_NUMBERING_SERVICE');

/** Token resolving to the repository-only {@link ExportedCustomerService}. */
export const EXPORTED_CUSTOMER_SERVICE_TOKEN: InjectionToken<ExportedCustomerService> =
	Symbol('EXPORTED_CUSTOMER_SERVICE');

/* ------------------------------------------------------------------------ *
 * Customer portal (ERP-0022, absorbed from the `portal` module, ADR-0024 Q28)
 * ------------------------------------------------------------------------ */

/** Mail port: portal invitation, reset and sign-up code emails. */
export const PORTAL_MAILER_TOKEN: InjectionToken<IPortalMailer> = Symbol('PORTAL_MAILER');
/** Better Auth session port of the portal sign-in. */
export const PORTAL_SESSION_GATEWAY_TOKEN: InjectionToken<IPortalSessionGateway> = Symbol('PORTAL_SESSION_GATEWAY');
/** Staff and member use cases for portal logins. */
export const PORTAL_ACCOUNT_SERVICE_TOKEN: InjectionToken<PortalAccountService> = Symbol('PORTAL_ACCOUNT_SERVICE');
export const PORTAL_AUTH_SERVICE_TOKEN: InjectionToken<PortalAuthService> = Symbol('PORTAL_AUTH_SERVICE');
export const PORTAL_SERVICE_TOKEN: InjectionToken<PortalService> = Symbol('PORTAL_SERVICE');
