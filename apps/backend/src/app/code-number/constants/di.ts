/**
 * Injection tokens for the code-number module.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition root
 * can both import them without a circular dependency.
 */
import type { InjectionToken } from 'tsyringe';
import type { ICodeNumberRepository } from '../contracts/code-number.repository.interface';
import type { CodeNumberService } from '../services/code-number.service';

/** Token resolving to the {@link ICodeNumberRepository} implementation. */
export const CODE_NUMBER_REPOSITORY_TOKEN: InjectionToken<ICodeNumberRepository> =
	Symbol('CODE_NUMBER_REPOSITORY_TOKEN');

/**
 * Token resolving to the {@link CodeNumberService} — the exported API other
 * modules use to number their documents.
 */
export const CODE_NUMBER_SERVICE_TOKEN: InjectionToken<CodeNumberService> =
	Symbol('CODE_NUMBER_SERVICE_TOKEN');
