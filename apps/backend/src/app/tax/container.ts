import type { DependencyContainer } from 'tsyringe';
import {
	TAX_CODE_NUMBERING_REPOSITORY_TOKEN,
	TAX_NUMBERING_SERVICE_TOKEN,
	TAX_REPOSITORY_TOKEN,
	TAX_SERVICE_TOKEN,
} from './constants/di';
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
	container.register(TAX_SERVICE_TOKEN, { useClass: TaxService });
}
