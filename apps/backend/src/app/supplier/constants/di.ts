import { InjectionToken } from 'tsyringe';
import type { ISupplierAddressRepository, ISupplierCompanyAddressRepository, ISupplierCompanyRepository } from '../contracts/supplier.repository.interface';
import type { ISupplierRepository } from '../contracts/supplier.repository.interface';
import type { SupplierService } from '../services/supplier.service';
import type { ExportedSupplierService } from '../services/exported-supplier.service';
import type { SupplierNumberingService } from '../services/supplier-numbering.service';
import type { SupplierCodeNumberingRepository } from '../repositories/code-numbering.repository';

/** Token resolving to the repository of `supplier.code_numberings`. */
export const SUPPLIER_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<SupplierCodeNumberingRepository> =
	Symbol('SUPPLIER_CODE_NUMBERING_REPOSITORY');

/** Token resolving to the {@link SupplierNumberingService} (codes + numbering settings). */
export const SUPPLIER_NUMBERING_SERVICE_TOKEN: InjectionToken<SupplierNumberingService> =
	Symbol('SUPPLIER_NUMBERING_SERVICE');

/** Token resolving to the {@link ISupplierCompanyRepository} implementation. */
export const SUPPLIER_COMPANY_REPOSITORY_TOKEN: InjectionToken<ISupplierCompanyRepository> =
	Symbol('SUPPLIER_COMPANY_REPOSITORY');

/** Token resolving to the {@link ISupplierRepository} implementation. */
export const SUPPLIER_PERSON_REPOSITORY_TOKEN: InjectionToken<ISupplierRepository> =
	Symbol('SUPPLIER_PERSON_REPOSITORY');

/** Token resolving to the {@link ISupplierCompanyAddressRepository} implementation. */
export const SUPPLIER_COMPANY_ADDRESS_REPOSITORY_TOKEN: InjectionToken<ISupplierCompanyAddressRepository> =
	Symbol('SUPPLIER_COMPANY_ADDRESS_REPOSITORY');

/** Token resolving to the {@link ISupplierAddressRepository} implementation. */
export const SUPPLIER_ADDRESS_REPOSITORY_TOKEN: InjectionToken<ISupplierAddressRepository> =
	Symbol('SUPPLIER_ADDRESS_REPOSITORY');

/** Token resolving to the {@link SupplierService} implementation. */
export const SUPPLIER_SERVICE_TOKEN: InjectionToken<SupplierService> = Symbol(
	'SUPPLIER_SERVICE',
);

/**
 * Token resolving to the repository-only `ExportedSupplierService`.
 *
 * @remarks
 * `procurement` (PO snapshot) and `inventory` (`items.supplier_company_id`)
 * consume this facade; it depends only on this module's repositories, so it
 * cannot create a cycle.
 */
export const EXPORTED_SUPPLIER_SERVICE_TOKEN: InjectionToken<ExportedSupplierService> =
	Symbol('EXPORTED_SUPPLIER_SERVICE');
