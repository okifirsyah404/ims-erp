/**
 * Public entry point of the company module.
 *
 * @remarks
 * Re-exports the composition-root registration, the controller and the
 * exported service contract so consumers only import from `@app/company`.
 */
import Elysia from 'elysia';

import { CompanyController } from './controllers/company.controller';

export * from './container';
export * from './controllers/company.controller';
export type { CompanyService } from './services/company.service';
export type { ICompanyService } from './contracts/company.service.interface';
export type {
	TCompanyProfileSnapshot,
	TCompanyProfileView,
	TInvoiceBankAccount,
} from './contracts/company.contract';

/** Elysia instance mounting the company controller. */
export function companyModule() {
	return new Elysia({ name: 'company' }).use(CompanyController.plugin());
}
