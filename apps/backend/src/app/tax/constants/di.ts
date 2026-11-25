import type { CoretaxExportService } from '../services/coretax-export.service';
import type { ExportedTaxService } from '../services/exported-tax.service';
import type { InjectionToken } from 'tsyringe';
import type { TTaxRepository } from '../contracts/tax.repository.interface';
import type { TaxCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { TaxNumberingService } from '../services/tax-numbering.service';
import type { TaxService } from '../services/tax.service';

/** Token resolving to the tax repository (taxes, records, corrections, withholdings). */
export const TAX_REPOSITORY_TOKEN: InjectionToken<TTaxRepository> = Symbol('TAX_REPOSITORY');

/** Token resolving to the {@link TaxService}. */
export const TAX_SERVICE_TOKEN: InjectionToken<TaxService> = Symbol('TAX_SERVICE');

/** Token resolving to the repository of `tax.code_numberings`. */
export const TAX_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<TaxCodeNumberingRepository> = Symbol('TAX_CODE_NUMBERING_REPOSITORY');

/** Token resolving to the {@link TaxNumberingService}. */
export const TAX_NUMBERING_SERVICE_TOKEN: InjectionToken<TaxNumberingService> = Symbol('TAX_NUMBERING_SERVICE');

/** The tax module's contract for payment and finance (ERP-0140). */
export const EXPORTED_TAX_SERVICE_TOKEN: InjectionToken<ExportedTaxService> = Symbol('EXPORTED_TAX_SERVICE');

/** Coretax XML export (ERP-0140). */
export const CORETAX_EXPORT_SERVICE_TOKEN: InjectionToken<CoretaxExportService> = Symbol('CORETAX_EXPORT_SERVICE');
