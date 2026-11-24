import type { TTx } from '@drizzle/types';
import type { TPostingRuleSelect } from '@drizzle/schemas/finance.schema';

export type TPostingRuleListFilter = {
	organizationId: string;
	eventType?: string;
	role?: string;
	includeInactive?: boolean;
};

/** Data access over `finance.posting_rules` (ERP-0128). */
export interface IPostingRuleRepository {
	/**
	 * Active rules for `role` whose event type is `eventType` or `'*'`; the
	 * service picks the most specific one.
	 */
	findCandidates(
		organizationId: string,
		role: string,
		eventType: string,
		tx?: TTx,
	): Promise<TPostingRuleSelect[]>;
	findById(organizationId: string, id: string): Promise<TPostingRuleSelect | null>;
	findByScope(
		organizationId: string,
		scope: {
			eventType: string;
			role: string;
			discriminatorType: string;
			discriminatorValue: string;
		},
	): Promise<TPostingRuleSelect | null>;
	list(filter: TPostingRuleListFilter): Promise<TPostingRuleSelect[]>;
	insert(row: {
		organizationId: string;
		eventType: string;
		role: string;
		discriminatorType: string;
		discriminatorValue: string;
		accountId: string;
		description: string | null;
	}): Promise<TPostingRuleSelect>;
	update(
		organizationId: string,
		id: string,
		patch: { accountId?: string; isActive?: boolean; description?: string | null },
	): Promise<TPostingRuleSelect | null>;
	softDelete(organizationId: string, id: string): Promise<TPostingRuleSelect | null>;
	/** True when an active, live rule points at the account (blocks deactivation). */
	isAccountReferenced(organizationId: string, accountId: string): Promise<boolean>;
}
