import type { DependencyContainer } from 'tsyringe';
import { CodeNumberRepository } from './repositories/code-number.repository';
import { CodeNumberService } from './services/code-number.service';
import { CODE_NUMBER_REPOSITORY_TOKEN, CODE_NUMBER_SERVICE_TOKEN } from './constants/di';

export * from './constants/di';

/**
 * Registers the code-number module's repository and service.
 *
 * @remarks
 * Called from the composition root (`src/index.ts`) after the company module:
 * the service reads the company document code through
 * {@link COMPANY_SERVICE_TOKEN}.
 */
export function registerCodeNumber(container: DependencyContainer): void {
	container.register(CODE_NUMBER_REPOSITORY_TOKEN, { useClass: CodeNumberRepository });
	container.register(CODE_NUMBER_SERVICE_TOKEN, { useClass: CodeNumberService });
}
