/**
 * Injection tokens for the company module.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition root
 * can both import them without a circular dependency. One repository token
 * per table (ADR-0024).
 */
import type { InjectionToken } from 'tsyringe';
import type {
	ICompanyAddressRepository,
	ICompanyContactRepository,
	ICompanyProfileRepository,
	ICompanySettingRepository,
	ILetterheadRepository,
} from '../contracts/company.repository.interface';
import type { CompanyService } from '../services/company.service';
import type { LetterheadService } from '../services/letterhead.service';
import type { ExportedCompanyService } from '../services/exported-company.service';

/** `company.profiles` repository. */
export const COMPANY_PROFILE_REPOSITORY_TOKEN: InjectionToken<ICompanyProfileRepository> =
	Symbol('COMPANY_PROFILE_REPOSITORY_TOKEN');

/** `company.addresses` repository. */
export const COMPANY_ADDRESS_REPOSITORY_TOKEN: InjectionToken<ICompanyAddressRepository> =
	Symbol('COMPANY_ADDRESS_REPOSITORY_TOKEN');

/** `company.contacts` repository. */
export const COMPANY_CONTACT_REPOSITORY_TOKEN: InjectionToken<ICompanyContactRepository> =
	Symbol('COMPANY_CONTACT_REPOSITORY_TOKEN');

/** `company.settings` repository. */
export const COMPANY_SETTING_REPOSITORY_TOKEN: InjectionToken<ICompanySettingRepository> =
	Symbol('COMPANY_SETTING_REPOSITORY_TOKEN');

/** `company.letterheads` repository (ERP-0165). */
export const LETTERHEAD_REPOSITORY_TOKEN: InjectionToken<ILetterheadRepository> =
	Symbol('LETTERHEAD_REPOSITORY_TOKEN');

/** Letterhead template use cases (ERP-0165). */
export const LETTERHEAD_SERVICE_TOKEN: InjectionToken<LetterheadService> =
	Symbol('LETTERHEAD_SERVICE_TOKEN');

/** Full company service: the settings-page use cases (profile, images, settings). */
export const COMPANY_SERVICE_TOKEN: InjectionToken<CompanyService> =
	Symbol('COMPANY_SERVICE_TOKEN');

/**
 * Repository-only facade other modules use for the letterhead and the
 * document code. Never inject {@link COMPANY_SERVICE_TOKEN} across modules.
 */
export const EXPORTED_COMPANY_SERVICE_TOKEN: InjectionToken<ExportedCompanyService> =
	Symbol('EXPORTED_COMPANY_SERVICE_TOKEN');
