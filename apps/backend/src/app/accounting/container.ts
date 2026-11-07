import type { DependencyContainer } from 'tsyringe';
import { DOCUMENT_NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import { DocumentNumberingService } from '@app/organization/services/document-numbering.service';
import {
	ACCOUNT_SERVICE_TOKEN,
	CASH_BANK_SERVICE_TOKEN,
	LEDGER_REPOSITORY_TOKEN,
	OPENING_BALANCE_SERVICE_TOKEN,
	PERIOD_SERVICE_TOKEN,
	POSTING_SERVICE_TOKEN,
	TAX_REPOSITORY_TOKEN,
	TAX_SERVICE_TOKEN,
} from './constants/di';
import { LedgerRepository } from './repositories/ledger.repository';
import { TaxRepository } from './repositories/tax.repository';
import { AccountService } from './services/account.service';
import { PeriodService } from './services/period.service';
import { PostingService } from './services/posting.service';
import { TaxService } from './services/tax.service';
import { OpeningBalanceService } from './services/opening-balance.service';
import { CashBankService } from './services/cash-bank.service';
import { ArAccountResolverService } from './services/ar-account-resolver.service';
import { PaymentService } from './services/payment.service';
import {
	AR_ACCOUNT_RESOLVER_TOKEN,
	PAYMENT_SERVICE_TOKEN,
} from './constants/ar-di';

/**
 * Registers the accounting module (tax + ledger slices) in the composition
 * root.
 *
 * @remarks
 * Called from `src/index.ts`. Controllers resolve inside `plugin()`, so this
 * must run before `createApp()`. The ledger slice (M09 F2) also re-registers
 * the organization numbering service under its own token alias so the
 * posting service can mint JE codes without depending on registration order.
 */
export function registerAccounting(container: DependencyContainer): void {
	container.register(TAX_REPOSITORY_TOKEN, { useClass: TaxRepository });
	container.register(TAX_SERVICE_TOKEN, { useClass: TaxService });

	container.register(DOCUMENT_NUMBERING_SERVICE_TOKEN, {
		useClass: DocumentNumberingService,
	});
	container.register(LEDGER_REPOSITORY_TOKEN, { useClass: LedgerRepository });
	container.register(POSTING_SERVICE_TOKEN, { useClass: PostingService });
	container.register(ACCOUNT_SERVICE_TOKEN, { useClass: AccountService });
	container.register(PERIOD_SERVICE_TOKEN, { useClass: PeriodService });
	container.register(OPENING_BALANCE_SERVICE_TOKEN, {
		useClass: OpeningBalanceService,
	});
	container.register(CASH_BANK_SERVICE_TOKEN, { useClass: CashBankService });
	container.register(AR_ACCOUNT_RESOLVER_TOKEN, {
		useClass: ArAccountResolverService,
	});
	container.register(PAYMENT_SERVICE_TOKEN, { useClass: PaymentService });
}
