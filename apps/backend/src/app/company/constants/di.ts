/**
 * Injection tokens for the company module.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition root
 * can both import them without a circular dependency.
 */
import type { InjectionToken } from 'tsyringe';
import type { ICompanyRepository } from '../contracts/company.repository.interface';
import type { CompanyService } from '../services/company.service';

/** Token resolving to the {@link ICompanyRepository} implementation. */
export const COMPANY_REPOSITORY_TOKEN: InjectionToken<ICompanyRepository> =
	Symbol('COMPANY_REPOSITORY_TOKEN');

/**
 * Token resolving to the company service — the exported API other modules use
 * for the letterhead (`getProfile`) and the settings page use cases.
 */
export const COMPANY_SERVICE_TOKEN: InjectionToken<CompanyService> =
	Symbol('COMPANY_SERVICE_TOKEN');
