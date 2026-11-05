/**
 * Public entry point of the CRM module: composition-root registration, the
 * HTTP controller, and the exported customer API for other modules.
 */
export { registerCrm } from './container';
export { CustomerController } from './controllers/customer.controller';
export { CUSTOMER_SERVICE_TOKEN } from './constants/di';
export type { CustomerService } from './services/customer.service';
