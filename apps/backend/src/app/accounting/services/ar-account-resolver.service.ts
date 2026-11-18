import { inject, injectable } from 'tsyringe';
import { CHART_OF_ACCOUNT_REPOSITORY_TOKEN } from '../constants/di';
import { AR_POSTING_DEFAULT_CODES, type TArPostingRole } from '../constants/ar-posting';
import { ArAccountNotConfiguredError } from '../errors/ledger.errors';
import type { IChartOfAccountRepository } from '../contracts/ledger.repositories';

/**
 * Resolves the GL accounts the invoice/payment flows post against (F4, 1c).
 *
 * @remarks
 * Resolution is by `chart_of_accounts.code` using the provisional default
 * codes in `AR_POSTING_DEFAULT_CODES`. Deliberately a tiny seam: once
 * `accounting.accounting_settings` enters the drizzle schema, a settings
 * lookup overrides the defaults here and callers stay untouched.
 */
@injectable()
export class ArAccountResolverService {
	constructor(
				@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN) private readonly accounts: IChartOfAccountRepository,
	) {}

	/** Resolves one role to a postable, active COA account id. */
	async resolve(
		organizationId: string,
		role: TArPostingRole,
	): Promise<string> {
		const code = AR_POSTING_DEFAULT_CODES[role];
		const account = await this.accounts.findAccountByCode(organizationId, code);
		if (!account || !account.isActive || !account.isPostable) {
			throw new ArAccountNotConfiguredError(code, role);
		}
		return account.id;
	}

	/** Resolves all invoice-side roles in one round of lookups. */
	async resolveAll(organizationId: string): Promise<
		Record<'ar' | 'revenue' | 'taxPayable', string>
	> {
		const roles = ['ar', 'revenue', 'taxPayable'] as const;
		const entries = await Promise.all(
			roles.map(async (role) => [role, await this.resolve(organizationId, role)] as const),
		);
		return Object.fromEntries(entries) as Record<
			'ar' | 'revenue' | 'taxPayable',
			string
		>;
	}

	/** Resolves all bill-side roles in one round of lookups (F5). */
	async resolveAllBill(organizationId: string): Promise<
		Record<'ap' | 'expense' | 'taxInput', string>
	> {
		const roles = ['ap', 'expense', 'taxInput'] as const;
		const entries = await Promise.all(
			roles.map(async (role) => [role, await this.resolve(organizationId, role)] as const),
		);
		return Object.fromEntries(entries) as Record<
			'ap' | 'expense' | 'taxInput',
			string
		>;
	}
}
