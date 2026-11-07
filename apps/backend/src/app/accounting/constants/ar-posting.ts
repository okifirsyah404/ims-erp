/**
 * Provisional AR-posting account codes (finance plan F4, decision 1c).
 *
 * @remarks
 * Defaults resolved by `chart_of_accounts.code` until the business gate
 * supplies the final COA (accounting F2 gate) — and until per-organization
 * overrides land in `accounting.accounting_settings` (already in DBML, not
 * yet in the drizzle schema; the resolver interface is built so that swap
 * requires no changes to callers).
 */
export const AR_POSTING_DEFAULT_CODES = {
	/** Trade receivables control account (asset, debit). */
	ar: '1-1300',
	/** Sales revenue account (revenue, credit). */
	revenue: '4-1000',
	/** Output tax payable (liability, credit). */
	taxPayable: '2-1000',
} as const;

export type TArPostingRole = keyof typeof AR_POSTING_DEFAULT_CODES;
