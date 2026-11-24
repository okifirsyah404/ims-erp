import { PostingRuleNotFoundError } from '../../src/app/finance/errors/ledger.errors';
import type { TRuleLookup } from '../../src/app/finance/services/posting-rule.service';

/**
 * Account codes the older flow fixtures seed, keyed by posting role.
 *
 * @remarks
 * Before ERP-0128 these were the hard-coded `AR_POSTING_DEFAULT_CODES`; the
 * flows now resolve through posting rules, so the fixtures map each role to
 * the same code they already seed.
 */
export const LEGACY_FIXTURE_CODES: Record<string, string> = {
	receivable: '1-1300',
	revenue: '4-1000',
	vat_output: '2-1000',
	payable: '2-1100',
	expense: '5-1000',
	vat_input: '1-1800',
	inventory: '1-1400',
	claim_payable: '2-1200',
	// ERP-0136: the older AP fixtures seed no GR/IR account; their bills carry
	// no stock lines, so these roles never resolve there.
	grir_clearing: '2-1150',
	purchase_price_variance: '5-1300',
};

type TAccountLookup = {
	findAccountByCode(
		organizationId: string,
		code: string,
	): Promise<{ id: string; isActive: boolean; isPostable: boolean } | null | undefined>;
};

/**
 * In-memory stand-in for `PostingRuleService.resolveAccountId`: one `'*'`
 * rule per role, pointing at the fixture account with that code. A missing
 * or unusable account behaves like a missing rule.
 */
export function fixturePostingRules(accounts: TAccountLookup, codes = LEGACY_FIXTURE_CODES) {
	return {
		async resolveAccountId(organizationId: string, lookup: TRuleLookup): Promise<string> {
			const code = codes[lookup.role];
			const account = code ? await accounts.findAccountByCode(organizationId, code) : null;
			if (!account || !account.isActive || !account.isPostable) {
				throw new PostingRuleNotFoundError(lookup.eventType, lookup.role);
			}
			return account.id;
		},
	};
}
