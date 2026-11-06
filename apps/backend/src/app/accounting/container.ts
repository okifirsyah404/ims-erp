import type { DependencyContainer } from 'tsyringe';
import { TAX_REPOSITORY_TOKEN, TAX_SERVICE_TOKEN } from './constants/di';
import { TaxRepository } from './repositories/tax.repository';
import { TaxService } from './services/tax.service';

/**
 * Registers the accounting module (tax slice) in the composition root.
 *
 * @remarks
 * Called from `src/index.ts`. Controllers resolve inside `plugin()`, so this
 * must run before `createApp()`.
 */
export function registerAccounting(container: DependencyContainer): void {
	container.register(TAX_REPOSITORY_TOKEN, { useClass: TaxRepository });
	container.register(TAX_SERVICE_TOKEN, { useClass: TaxService });
}
