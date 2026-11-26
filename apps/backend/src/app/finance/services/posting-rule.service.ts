import type { TTx } from '@drizzle/types';
import {
	ANY_POSTING_EVENT,
	type TPostingRuleSelect,
} from '@drizzle/schemas/finance.schema';
import { inject, injectable } from 'tsyringe';
import type { AuditWriter } from '@shared/audit';
import {
	CHART_OF_ACCOUNT_REPOSITORY_TOKEN,
	FINANCE_AUDIT_WRITER_TOKEN,
	POSTING_RULE_REPOSITORY_TOKEN,
} from '../constants/di';
import {
	AccountInactiveError,
	AccountNotFoundError,
	AccountNotPostableError,
	PostingRuleNotFoundByIdError,
	PostingRuleNotFoundError,
	PostingRuleScopeTakenError,
} from '../errors/ledger.errors';
import type { IChartOfAccountRepository } from '../contracts/chart-of-account.repository.interface';
import type { IPostingRuleRepository } from '../contracts/posting-rule.repository.interface';

export type TRuleLookup = {
	eventType: string;
	role: string;
	discriminatorType?: string | null;
	discriminatorValue?: string | null;
};

export type TRuleActor = { organizationId: string; actorUserId: string };

/**
 * Picks the most specific rule from the candidates (ERP-0128).
 *
 * @remarks
 * Order: event + discriminator, event, `'*'` + discriminator, `'*'`. A rule
 * with a discriminator only matches the same discriminator; rules carrying a
 * different discriminator are ignored.
 */
export function pickPostingRule(
	candidates: readonly TPostingRuleSelect[],
	lookup: TRuleLookup,
): TPostingRuleSelect | null {
	const discType = lookup.discriminatorType ?? '';
	const discValue = lookup.discriminatorValue ?? '';
	const score = (rule: TPostingRuleSelect): number => {
		const eventScore = rule.eventType === lookup.eventType ? 2 : rule.eventType === ANY_POSTING_EVENT ? 0 : -100;
		let discScore: number;
		if (rule.discriminatorType === '') discScore = 0;
		else if (discType !== '' && rule.discriminatorType === discType && rule.discriminatorValue === discValue) discScore = 1;
		else discScore = -100;
		return eventScore + discScore;
	};
	let best: TPostingRuleSelect | null = null;
	let bestScore = -1;
	for (const rule of candidates) {
		const value = score(rule);
		if (value > bestScore) {
			best = rule;
			bestScore = value;
		}
	}
	return bestScore >= 0 ? best : null;
}

/**
 * Account determination for business-event postings, plus the accountant's
 * maintenance surface for `finance.posting_rules` (ERP-0128, ADR-0030).
 */
@injectable()
export class PostingRuleService {
	constructor(
		@inject(POSTING_RULE_REPOSITORY_TOKEN) private readonly rules: IPostingRuleRepository,
		@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN) private readonly accounts: IChartOfAccountRepository,
		@inject(FINANCE_AUDIT_WRITER_TOKEN) private readonly audit?: AuditWriter,
	) {}

	/**
	 * Resolves a role to an account id; throws when no active rule matches.
	 * The account's postability is checked again by the posting service.
	 */
	async resolveAccountId(organizationId: string, lookup: TRuleLookup, tx?: TTx): Promise<string> {
		const candidates = await this.rules.findCandidates(organizationId, lookup.role, lookup.eventType, tx);
		const rule = pickPostingRule(candidates, lookup);
		if (!rule) throw new PostingRuleNotFoundError(lookup.eventType, lookup.role);
		return rule.accountId;
	}

	async list(organizationId: string, filter: { eventType?: string; role?: string; includeInactive?: boolean }) {
		return this.rules.list({ organizationId, ...filter });
	}

	async create(
		ctx: TRuleActor,
		input: {
			eventType: string;
			role: string;
			discriminatorType: string;
			discriminatorValue: string;
			accountId: string;
			description: string | null;
		},
	): Promise<TPostingRuleSelect> {
		await this.assertPostableAccount(ctx.organizationId, input.accountId);
		const existing = await this.rules.findByScope(ctx.organizationId, input);
		if (existing) throw new PostingRuleScopeTakenError();
		const created = await this.rules.insert({ organizationId: ctx.organizationId, ...input });
		await this.audit?.record({
			actor: { userId: ctx.actorUserId },
			action: 'posting_rule.created',
			targetType: 'posting_rule',
			targetId: created.id,
			organizationId: ctx.organizationId,
			meta: { eventType: created.eventType, role: created.role, accountId: created.accountId },
		});
		return created;
	}

	async update(
		ctx: TRuleActor,
		id: string,
		patch: { accountId?: string; isActive?: boolean; description?: string | null },
	): Promise<TPostingRuleSelect> {
		const before = await this.rules.findById(ctx.organizationId, id);
		if (!before) throw new PostingRuleNotFoundByIdError();
		if (patch.accountId) await this.assertPostableAccount(ctx.organizationId, patch.accountId);
		const updated = await this.rules.update(ctx.organizationId, id, patch);
		if (!updated) throw new PostingRuleNotFoundByIdError();
		await this.audit?.record({
			actor: { userId: ctx.actorUserId },
			action: 'posting_rule.updated',
			targetType: 'posting_rule',
			targetId: id,
			organizationId: ctx.organizationId,
			meta: {
				before: { accountId: before.accountId, isActive: before.isActive },
				after: { accountId: updated.accountId, isActive: updated.isActive },
			},
		});
		return updated;
	}

	async archive(ctx: TRuleActor, id: string): Promise<TPostingRuleSelect> {
		const archived = await this.rules.softDelete(ctx.organizationId, id);
		if (!archived) throw new PostingRuleNotFoundByIdError();
		await this.audit?.record({
			actor: { userId: ctx.actorUserId },
			action: 'posting_rule.archived',
			targetType: 'posting_rule',
			targetId: id,
			organizationId: ctx.organizationId,
			meta: { eventType: archived.eventType, role: archived.role },
		});
		return archived;
	}

	private async assertPostableAccount(organizationId: string, accountId: string): Promise<void> {
		const account = await this.accounts.findAccountById(organizationId, accountId);
		if (!account) throw new AccountNotFoundError();
		if (!account.isActive) throw new AccountInactiveError();
		if (!account.isPostable) throw new AccountNotPostableError();
	}
}
