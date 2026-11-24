import type { DependencyContainer } from 'tsyringe';

import {
	EXPORTED_SUPPLIER_SERVICE_TOKEN,
	SUPPLIER_ADDRESS_REPOSITORY_TOKEN,
	SUPPLIER_CODE_NUMBERING_REPOSITORY_TOKEN,
	SUPPLIER_COMPANY_ADDRESS_REPOSITORY_TOKEN,
	SUPPLIER_COMPANY_REPOSITORY_TOKEN,
	SUPPLIER_IMAGE_SERVICE_TOKEN,
	SUPPLIER_NUMBERING_SERVICE_TOKEN,
	SUPPLIER_PERSON_REPOSITORY_TOKEN,
	SUPPLIER_SERVICE_TOKEN,
} from './constants/di';
import { SupplierAddressRepository, SupplierCompanyAddressRepository } from './repositories/supplier-address.repository';
import { SupplierCodeNumberingRepository } from './repositories/code-numbering.repository';
import { SupplierNumberingService } from './services/supplier-numbering.service';
import { ExportedSupplierService } from './services/exported-supplier.service';
import { SupplierService } from './services/supplier.service';
import { SupplierImageService } from './services/supplier-image.service';
import { SupplierCompanyRepository } from './repositories/supplier-company.repository';
import { SupplierRepository } from './repositories/supplier.repository';

export * from './constants/di';

/**
 * Registers the supplier module's repositories, service and exported facade.
 *
 * @remarks
 * Called from the composition root (`src/index.ts`) before the HTTP app is
 * built.
 */
export function registerSupplier(container: DependencyContainer): void {
	container.register(SUPPLIER_COMPANY_REPOSITORY_TOKEN, {
		useClass: SupplierCompanyRepository,
	});
	container.register(SUPPLIER_PERSON_REPOSITORY_TOKEN, {
		useClass: SupplierRepository,
	});
	container.register(SUPPLIER_COMPANY_ADDRESS_REPOSITORY_TOKEN, {
		useClass: SupplierCompanyAddressRepository,
	});
	container.register(SUPPLIER_ADDRESS_REPOSITORY_TOKEN, {
		useClass: SupplierAddressRepository,
	});
	container.register(SUPPLIER_SERVICE_TOKEN, {
		useClass: SupplierService,
	});
	container.register(SUPPLIER_IMAGE_SERVICE_TOKEN, {
		useClass: SupplierImageService,
	});
	container.register(EXPORTED_SUPPLIER_SERVICE_TOKEN, {
		useClass: ExportedSupplierService,
	});
	// Numbering (`supplier.code_numberings`).
	container.register(SUPPLIER_CODE_NUMBERING_REPOSITORY_TOKEN, {
		useClass: SupplierCodeNumberingRepository,
	});
	container.register(SUPPLIER_NUMBERING_SERVICE_TOKEN, {
		useClass: SupplierNumberingService,
	});
}
