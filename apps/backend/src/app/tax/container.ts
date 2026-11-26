import { CoretaxExportService } from './services/coretax-export.service';
import { ExportedTaxService } from './services/exported-tax.service';
import type { DependencyContainer } from 'tsyringe';
import {
	TAX_CODE_NUMBERING_REPOSITORY_TOKEN,
	TAX_NUMBERING_SERVICE_TOKEN,
	TAX_REPOSITORY_TOKEN,
	TAX_SERVICE_TOKEN,
	EXPORTED_TAX_SERVICE_TOKEN,
	CORETAX_EXPORT_SERVICE_TOKEN,
	PPH21_REPOSITORY_TOKEN,
	PPH21_TABLE_SERVICE_TOKEN,
} from './constants/di';
import { Pph21Repository } from './repositories/pph21.repository';
import { Pph21TableService } from './services/pph21-table.service';
import { TaxCodeNumberingRepository } from './repositories/code-numbering.repository';
import { TaxRepository } from './repositories/tax.repository';
import { TaxNumberingService } from './services/tax-numbering.service';
import { TaxService } from './services/tax.service';

export * from './constants/di';

/** Registers the tax module's repositories and services. */
export function registerTax(container: DependencyContainer): void {
	container.register(TAX_REPOSITORY_TOKEN, { useClass: TaxRepository });
	container.register(TAX_CODE_NUMBERING_REPOSITORY_TOKEN, { useClass: TaxCodeNumberingRepository });
	container.register(TAX_NUMBERING_SERVICE_TOKEN, { useClass: TaxNumberingService });
	container.register(PPH21_REPOSITORY_TOKEN, { useClass: Pph21Repository });
	container.register(PPH21_TABLE_SERVICE_TOKEN, { useClass: Pph21TableService });
	container.register(TAX_SERVICE_TOKEN, { useClass: TaxService });
	container.register(EXPORTED_TAX_SERVICE_TOKEN, { useClass: ExportedTaxService });
	container.register(CORETAX_EXPORT_SERVICE_TOKEN, { useClass: CoretaxExportService });
}
