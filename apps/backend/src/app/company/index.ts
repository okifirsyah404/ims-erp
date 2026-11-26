/**
 * Public entry point of the company module.
 *
 * @remarks
 * Re-exports the composition-root registration, the controller and the
 * exported facade so consumers only import from `@app/company`.
 */
import Elysia from 'elysia';

import { CompanyController } from './controllers/company.controller';
import { LetterheadController } from './controllers/letterhead.controller';

export * from './container';
export * from './controllers/company.controller';
export * from './controllers/letterhead.controller';
export type { CompanyService } from './services/company.service';
export type { ExportedCompanyService } from './services/exported-company.service';
export type {
	TCompanyBranding,
	TCompanyProfileSnapshot,
	TCompanyProfileView,
} from './contracts/company.contract';
export type { TLetterheadPrint, TLetterheadView } from './contracts/letterhead.contract';

/** Elysia instance mounting the company controllers. */
export function companyModule() {
	return new Elysia({ name: 'company' }).use(CompanyController.plugin()).use(LetterheadController.plugin());
}
