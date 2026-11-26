import type { DependencyContainer } from 'tsyringe';
import {
	COMPANY_ADDRESS_REPOSITORY_TOKEN,
	COMPANY_CONTACT_REPOSITORY_TOKEN,
	COMPANY_PROFILE_REPOSITORY_TOKEN,
	COMPANY_SERVICE_TOKEN,
	COMPANY_SETTING_REPOSITORY_TOKEN,
	EXPORTED_COMPANY_SERVICE_TOKEN,
	LETTERHEAD_REPOSITORY_TOKEN,
	LETTERHEAD_SERVICE_TOKEN,
} from './constants/di';
import { CompanyAddressRepository } from './repositories/company-address.repository';
import { CompanyContactRepository } from './repositories/company-contact.repository';
import { CompanyProfileRepository } from './repositories/company-profile.repository';
import { CompanySettingRepository } from './repositories/company-setting.repository';
import { LetterheadRepository } from './repositories/letterhead.repository';
import { CompanyService } from './services/company.service';
import { ExportedCompanyService } from './services/exported-company.service';
import { LetterheadService } from './services/letterhead.service';

export * from './constants/di';

/**
 * Registers the company module's repositories, service and exported facade.
 *
 * @remarks
 * Called from the composition root (`src/index.ts`) before the HTTP app is
 * built. Company is registered early: document numbering reads its
 * `document_code` through {@link EXPORTED_COMPANY_SERVICE_TOKEN}.
 */
export function registerCompany(container: DependencyContainer): void {
	container.register(COMPANY_PROFILE_REPOSITORY_TOKEN, { useClass: CompanyProfileRepository });
	container.register(COMPANY_ADDRESS_REPOSITORY_TOKEN, { useClass: CompanyAddressRepository });
	container.register(COMPANY_CONTACT_REPOSITORY_TOKEN, { useClass: CompanyContactRepository });
	container.register(COMPANY_SETTING_REPOSITORY_TOKEN, { useClass: CompanySettingRepository });
	container.register(LETTERHEAD_REPOSITORY_TOKEN, { useClass: LetterheadRepository });
	container.register(COMPANY_SERVICE_TOKEN, { useClass: CompanyService });
	container.register(LETTERHEAD_SERVICE_TOKEN, { useClass: LetterheadService });
	container.register(EXPORTED_COMPANY_SERVICE_TOKEN, { useClass: ExportedCompanyService });
}
