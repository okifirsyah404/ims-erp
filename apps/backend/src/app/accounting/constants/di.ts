/**
 * DI tokens for the accounting module (tax slice).
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation. A bare `Symbol()`
 * would make `container.resolve()` return `unknown`.
 */
import type { InjectionToken } from 'tsyringe';
import type { TTaxRepository } from '../contracts/tax.repository.interface';
import type { TaxService } from '../services/tax.service';

export const TAX_REPOSITORY_TOKEN: InjectionToken<TTaxRepository> =
	Symbol('TAX_REPOSITORY');
export const TAX_SERVICE_TOKEN: InjectionToken<TaxService> =
	Symbol('TAX_SERVICE');
