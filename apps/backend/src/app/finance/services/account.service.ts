import type { TChartOfAccountSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { CHART_OF_ACCOUNT_REPOSITORY_TOKEN } from '../constants/di';
import {
	AccountCodeTakenError,
	AccountInUseError,
	AccountNotFoundError,
} from '../errors/ledger.errors';
import type {
	IChartOfAccountRepository,
	TAccountPaginationRequest,
} from '../contracts/chart-of-account.repository.interface';

export type TCreateAccountInput = {
	code: string;
	name: string;
	accountType: string;
	normalBalance: string;
	parentAccountId: string | null;
	isPostable: boolean;
	cashFlowCategory: string | null;
	description: string | null;
};

export type TUpdateAccountInput = {
	name?: string;
	isPostable?: boolean;
	isActive?: boolean;
	cashFlowCategory?: string | null;
	description?: string | null;
};

/**
 * Chart-of-accounts application service (M09 F2).
 *
 * @remarks
 * Enforces what the schema cannot: unique codes within the tenant, a parent
 * account from the same organization, and that an account with journal
 * history can only be deactivated (never deleted — the schema has no delete;
 * `is_active` is the switch). Codes are immutable; the code is the stable
 * key the posting service resolves.
 */
@injectable()
export class AccountService {
	constructor(
		@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN) private readonly accounts: IChartOfAccountRepository,
	) {}

	/** Fetches one page of the tenant's chart of accounts. */
	async listAccounts(
		request: TAccountPaginationRequest,
	): Promise<TPaginationResult<TChartOfAccountSelect>> {
		return this.accounts.paginateAccounts(request);
	}

	async getAccount(
		organizationId: string,
		id: string,
	): Promise<TChartOfAccountSelect> {
		const row = await this.accounts.findAccountById(organizationId, id);
		if (!row) throw new AccountNotFoundError();
		return row;
	}

	async createAccount(
		organizationId: string,
		input: TCreateAccountInput,
	): Promise<TChartOfAccountSelect> {
		const existing = await this.accounts.findAccountByCode(
			organizationId,
			input.code,
		);
		if (existing) throw new AccountCodeTakenError();

		let level = 1;
		if (input.parentAccountId) {
			const parent = await this.accounts.findAccountById(
				organizationId,
				input.parentAccountId,
			);
			if (!parent) throw new AccountNotFoundError();
			level = parent.level + 1;
		}

		return this.accounts.insertAccount({
			organizationId,
			code: input.code,
			name: input.name,
			accountType: input.accountType,
			normalBalance: input.normalBalance,
			parentAccountId: input.parentAccountId,
			level,
			isPostable: input.isPostable,
			isSystem: false,
			isActive: true,
			cashFlowCategory: input.cashFlowCategory,
			description: input.description,
		});
	}

	async updateAccount(
		organizationId: string,
		id: string,
		patch: TUpdateAccountInput,
	): Promise<TChartOfAccountSelect> {
		const account = await this.accounts.findAccountById(organizationId, id);
		if (!account) throw new AccountNotFoundError();

		// Deactivating (or un-postable-ing) an account that has journal history
		// is fine — history keeps its rows. Reactivating is always allowed.
		if (patch.isActive === false && account.isSystem && patch.isPostable === false) {
			throw new AccountInUseError();
		}

		const updated = await this.accounts.updateAccount(organizationId, id, patch);
		if (!updated) throw new AccountNotFoundError();
		return updated;
	}

	/** Soft-deactivate: refuses when the account still has journal lines. */
	async archiveAccount(
		organizationId: string,
		id: string,
	): Promise<TChartOfAccountSelect> {
		const account = await this.accounts.findAccountById(organizationId, id);
		if (!account) throw new AccountNotFoundError();
		if (account.isSystem) throw new AccountInUseError();
		if (await this.accounts.accountHasJournalLines(organizationId, id)) {
			throw new AccountInUseError();
		}
		const updated = await this.accounts.updateAccount(
			organizationId,
			id,
			{ isActive: false, isPostable: false },
		);
		if (!updated) throw new AccountNotFoundError();
		return updated;
	}
}
