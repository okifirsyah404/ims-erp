import { inject, injectable } from 'tsyringe';
import { POSTING_RULE_SERVICE_TOKEN } from '../constants/di';
import { LEGACY_ROLE_MAP, type TLegacyPostingRole } from '../constants/posting-roles';
import type { PostingRuleService } from './posting-rule.service';

/** Legacy role keys accepted by {@link ArAccountResolverService}. */
export type TArPostingRole = TLegacyPostingRole;

/**
 * Resolves the GL accounts the invoice, bill, claim and settlement flows
 * post against.
 *
 * @remarks
 * Since ERP-0128 this is a thin adapter over {@link PostingRuleService}: the
 * hard-coded `AR_POSTING_DEFAULT_CODES` became seeded `'*'` rules in
 * `finance.posting_rules`, so an accountant can remap an account without a
 * deploy. Callers keep their legacy role keys (`ar`, `taxPayable`, ...);
 * `eventType` lets a caller ask for an event-specific rule.
 */
@injectable()
export class ArAccountResolverService {
	constructor(
		@inject(POSTING_RULE_SERVICE_TOKEN)
		private readonly rules: Pick<PostingRuleService, 'resolveAccountId'>,
	) {}

	/** Resolves one role to the account id of the most specific active rule. */
	async resolve(
		organizationId: string,
		role: TArPostingRole,
		eventType = '*',
	): Promise<string> {
		return this.rules.resolveAccountId(organizationId, {
			eventType,
			role: LEGACY_ROLE_MAP[role],
		});
	}

	/** Resolves all invoice-side roles in one round of lookups. */
	async resolveAll(organizationId: string): Promise<
		Record<'ar' | 'revenue' | 'taxPayable', string>
	> {
		const roles = ['ar', 'revenue', 'taxPayable'] as const;
		const entries = await Promise.all(
			roles.map(async (role) => [role, await this.resolve(organizationId, role, 'sale.invoice_issued')] as const),
		);
		return Object.fromEntries(entries) as Record<'ar' | 'revenue' | 'taxPayable', string>;
	}

	/** Resolves all bill-side roles in one round of lookups (F5). */
	async resolveAllBill(organizationId: string): Promise<
		Record<'ap' | 'expense' | 'taxInput', string>
	> {
		const roles = ['ap', 'expense', 'taxInput'] as const;
		const entries = await Promise.all(
			roles.map(
				async (role) => [role, await this.resolve(organizationId, role, 'finance.supplier_bill_recorded')] as const,
			),
		);
		return Object.fromEntries(entries) as Record<'ap' | 'expense' | 'taxInput', string>;
	}
}
