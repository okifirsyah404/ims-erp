import type { DependencyContainer } from 'tsyringe';
import { CompanyRepository } from './repositories/company.repository';
import { CompanyService } from './services/company.service';
import { COMPANY_REPOSITORY_TOKEN, COMPANY_SERVICE_TOKEN } from './constants/di';

export * from './constants/di';

/**
 * Registers the company module's repository and service.
 *
 * @remarks
 * Called from the composition root (`src/index.ts`) before the HTTP app is
 * built. Company is registered early: the numbering module reads its
 * `document_code` through {@link COMPANY_SERVICE_TOKEN}.
 */
export function registerCompany(container: DependencyContainer): void {
	container.register(COMPANY_REPOSITORY_TOKEN, { useClass: CompanyRepository });
	container.register(COMPANY_SERVICE_TOKEN, { useClass: CompanyService });
}
