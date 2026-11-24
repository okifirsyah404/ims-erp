import type { TChartOfAccountSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import type { AuditWriter } from '@shared/audit';
import {
	CHART_OF_ACCOUNT_REPOSITORY_TOKEN,
	FINANCE_AUDIT_WRITER_TOKEN,
	POSTING_RULE_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IPostingRuleRepository } from '../contracts/posting-rule.repository.interface';
import {
	AccountBalanceNotZeroError,
	AccountCodeTakenError,
	AccountInUseError,
	AccountLockedError,
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
		@inject(POSTING_RULE_REPOSITORY_TOKEN)
		private readonly rules?: Pick<IPostingRuleRepository, 'isAccountReferenced'>,
		@inject(FINANCE_AUDIT_WRITER_TOKEN) private readonly audit?: AuditWriter,
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
		actorUserId?: string,
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

		const created = await this.accounts.insertAccount({
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
		await this.record(organizationId, actorUserId, 'chart_of_account.created', created.id, {
			code: created.code,
			accountType: created.accountType,
		});
		return created;
	}

	/**
	 * Updates an account under the locking rules (ERP-0127, grill Q55): once
	 * the account has journal lines its postable flag is frozen (type and
	 * normal balance are immutable at the contract); deactivation needs a zero
	 * balance and no active posting rule pointing at the account; system
	 * accounts are never deactivated.
	 */
	async updateAccount(
		organizationId: string,
		id: string,
		patch: TUpdateAccountInput,
		actorUserId?: string,
	): Promise<TChartOfAccountSelect> {
		const account = await this.accounts.findAccountById(organizationId, id);
		if (!account) throw new AccountNotFoundError();

		if (patch.isPostable !== undefined && patch.isPostable !== account.isPostable) {
			if (await this.accounts.accountHasJournalLines(organizationId, id)) {
				throw new AccountLockedError();
			}
		}
		if (patch.isActive === false && account.isActive) {
			await this.assertDeactivatable(organizationId, account);
		}

		const updated = await this.accounts.updateAccount(organizationId, id, patch);
		if (!updated) throw new AccountNotFoundError();
		await this.record(organizationId, actorUserId, 'chart_of_account.updated', id, {
			before: { name: account.name, isPostable: account.isPostable, isActive: account.isActive },
			after: { name: updated.name, isPostable: updated.isPostable, isActive: updated.isActive },
		});
		return updated;
	}

	/**
	 * Soft-deactivates an account (grill Q55): allowed with a zero balance
	 * and no active posting rule on it; an account with postings keeps its
	 * postable flag (frozen), an unused one is also made non-postable.
	 */
	async archiveAccount(
		organizationId: string,
		id: string,
		actorUserId?: string,
	): Promise<TChartOfAccountSelect> {
		const account = await this.accounts.findAccountById(organizationId, id);
		if (!account) throw new AccountNotFoundError();
		await this.assertDeactivatable(organizationId, account);
		const hasLines = await this.accounts.accountHasJournalLines(organizationId, id);
		const updated = await this.accounts.updateAccount(
			organizationId,
			id,
			hasLines ? { isActive: false } : { isActive: false, isPostable: false },
		);
		if (!updated) throw new AccountNotFoundError();
		await this.record(organizationId, actorUserId, 'chart_of_account.archived', id, { code: account.code });
		return updated;
	}

	private async assertDeactivatable(
		organizationId: string,
		account: TChartOfAccountSelect,
	): Promise<void> {
		if (account.isSystem) throw new AccountInUseError();
		if (this.rules && (await this.rules.isAccountReferenced(organizationId, account.id))) {
			throw new AccountInUseError();
		}
		if ((await this.accounts.accountNetBalance(organizationId, account.id)) !== 0) {
			throw new AccountBalanceNotZeroError();
		}
	}

	private async record(
		organizationId: string,
		actorUserId: string | undefined,
		action: 'chart_of_account.created' | 'chart_of_account.updated' | 'chart_of_account.archived',
		targetId: string,
		meta: Record<string, unknown>,
	): Promise<void> {
		if (!actorUserId) return;
		await this.audit?.record({
			actor: { userId: actorUserId },
			action,
			targetType: 'chart_of_account',
			targetId,
			organizationId,
			meta,
		});
	}
}
