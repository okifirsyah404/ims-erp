import type { TTx } from '@drizzle/types';
import type { TCompanyProfileSnapshot } from './company.contract';

/**
 * The company module's exported API.
 *
 * @remarks
 * Other modules (code_number, document, sales, aftersales) read the letterhead
 * through {@link ICompanyService.getProfile} and never touch `company.*`
 * tables. `tx` lets a caller read inside its own transaction.
 */
export interface ICompanyService {
	/** The letterhead snapshot, or `null` before the profile was first saved. */
	getProfile(tx?: TTx): Promise<TCompanyProfileSnapshot | null>;

	/**
	 * Display name for user-facing surfaces (emails, exports): the profile's
	 * `tradingName ?? legalName`, or `null` before the profile was first saved.
	 */
	getDisplayName(): Promise<string | null>;
}
