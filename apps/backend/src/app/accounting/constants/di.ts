/**
 * DI tokens for the accounting module (tax + ledger slices).
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation. A bare `Symbol()`
 * would make `container.resolve()` return `unknown`.
 */
import type { InjectionToken } from 'tsyringe';
import type { TTaxRepository } from '../contracts/tax.repository.interface';
import type { TaxService } from '../services/tax.service';
import type { LedgerRepository } from '../repositories/ledger.repository';
import type { PostingService } from '../services/posting.service';
import type { AccountService } from '../services/account.service';
import type { PeriodService } from '../services/period.service';
import type { OpeningBalanceService } from '../services/opening-balance.service';
import type { CashBankService } from '../services/cash-bank.service';

export const TAX_REPOSITORY_TOKEN: InjectionToken<TTaxRepository> =
	Symbol('TAX_REPOSITORY');
export const TAX_SERVICE_TOKEN: InjectionToken<TaxService> =
	Symbol('TAX_SERVICE');

export const LEDGER_REPOSITORY_TOKEN: InjectionToken<LedgerRepository> =
	Symbol('LEDGER_REPOSITORY');
export const POSTING_SERVICE_TOKEN: InjectionToken<PostingService> =
	Symbol('POSTING_SERVICE');
export const ACCOUNT_SERVICE_TOKEN: InjectionToken<AccountService> =
	Symbol('ACCOUNT_SERVICE');
export const PERIOD_SERVICE_TOKEN: InjectionToken<PeriodService> =
	Symbol('PERIOD_SERVICE');
export const OPENING_BALANCE_SERVICE_TOKEN: InjectionToken<OpeningBalanceService> =
	Symbol('OPENING_BALANCE_SERVICE');
export const CASH_BANK_SERVICE_TOKEN: InjectionToken<CashBankService> =
	Symbol('CASH_BANK_SERVICE');
