import type {
	PortalRole,
	TCustomerAddressSelect,
	TCustomerCompanyAddressSelect,
	TCustomerCompanyInsert,
	TCustomerCompanySelect,
	TCustomerInsert,
	TCustomerSelect,
} from '@drizzle/schemas/customer.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';
import type {
	TCompanyAddressInput,
	TCompanyListQuery,
	TCustomerAddressInput,
	TCustomerListQuery,
	TUpdateCompanyAddressInput,
	TUpdateCustomerAddressInput,
} from './customer.contract';

/** Insert payload; the repository stamps createdAt/updatedAt itself. */
export type TNewCompany = Omit<
	TCustomerCompanyInsert,
	'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** Insert payload; the repository stamps createdAt/updatedAt itself. */
export type TNewCustomer = Omit<
	TCustomerInsert,
	'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** Page settings plus the filters of the customer-company listing. */
export type TCompanyPaginationRequest = TPaginationRequest &
	Omit<TCompanyListQuery, 'page' | 'limit'>;

/** Page settings plus the filters of the customer-person listing. */
export type TCustomerPaginationRequest = TPaginationRequest &
	Omit<TCustomerListQuery, 'page' | 'limit'>;

/** Persistence port for `customer.companies` (live rows only). */
export interface ICompanyRepository {
	/** Fetches one filtered page of customer companies with its pagination metadata. */
	paginate(
		request: TCompanyPaginationRequest,
	): Promise<TPaginationResult<TCustomerCompanySelect>>;

	findById(id: string): Promise<TCustomerCompanySelect | null>;

	findByCode(code: string): Promise<TCustomerCompanySelect | null>;

	create(data: TNewCompany): Promise<TCustomerCompanySelect>;

	update(id: string, patch: Partial<TCustomerCompanyInsert>): Promise<TCustomerCompanySelect | null>;

	/** Moves `from` → `to`; `null` when the company is not in `from`. */
	transitionStatus(
		id: string,
		from: 'active' | 'inactive',
		to: 'active' | 'inactive',
	): Promise<TCustomerCompanySelect | null>;
}

/** Persistence port for `customer.customers` (live rows only). */
export interface ICustomerPersonRepository {
	/** Fetches one filtered page of customer people with its pagination metadata. */
	paginate(
		request: TCustomerPaginationRequest,
	): Promise<TPaginationResult<TCustomerSelect>>;

	findById(id: string): Promise<TCustomerSelect | null>;

	findByCode(code: string): Promise<TCustomerSelect | null>;

	/** The live person behind a portal login, or `null`. */
	findByUserId(userId: string): Promise<TCustomerSelect | null>;

	create(data: TNewCustomer): Promise<TCustomerSelect>;

	update(id: string, patch: Partial<TCustomerInsert>): Promise<TCustomerSelect | null>;

	/**
	 * Portal logins of a scope: everyone with a live (not revoked) login in
	 * `companyId`, or the one person `customerId` when there is no company.
	 */
	listPortalAccounts(scope: { customerId: string; companyId: string | null }): Promise<TCustomerSelect[]>;

	/** Gives the person a portal login (`portal_status = active`). `null` when the person is gone. */
	grantPortalAccess(
		id: string,
		data: { userId: string; portalRole: PortalRole; portalInvitedBy: string | null },
	): Promise<TCustomerSelect | null>;

	/**
	 * Conditional revoke: only a live, not yet revoked login. Sets
	 * `portal_status = revoked`, frees `user_id` and resets the login settings
	 * (`portal_language`, `portal_two_step`, `portal_push`); returns the row as it was
	 * (so the caller can end the user's sessions) or `null` when nothing changed.
	 */
	revokePortalAccess(id: string): Promise<TCustomerSelect | null>;

	/** Stamps `portal_last_login_at`. */
	touchPortalLogin(id: string): Promise<void>;

	/** Clears `is_primary` on every live person of the company. */
	clearPrimary(companyId: string): Promise<void>;

	/** Moves `from` → `to`; `null` when the person is not in `from`. */
	transitionStatus(
		id: string,
		from: 'active' | 'inactive',
		to: 'active' | 'inactive',
	): Promise<TCustomerSelect | null>;
}

/** Persistence port for `customer.company_addresses`. */
export interface ICompanyAddressRepository {
	listByCompany(companyId: string): Promise<TCustomerCompanyAddressSelect[]>;

	findById(companyId: string, addressId: string): Promise<TCustomerCompanyAddressSelect | null>;

	create(companyId: string, data: TCompanyAddressInput): Promise<TCustomerCompanyAddressSelect>;

	update(
		companyId: string,
		addressId: string,
		patch: TUpdateCompanyAddressInput,
	): Promise<TCustomerCompanyAddressSelect | null>;

	softDelete(companyId: string, addressId: string): Promise<boolean>;
}

/** Persistence port for `customer.addresses`. */
export interface ICustomerAddressRepository {
	listByCustomer(customerId: string): Promise<TCustomerAddressSelect[]>;

	findById(customerId: string, addressId: string): Promise<TCustomerAddressSelect | null>;

	create(customerId: string, data: TCustomerAddressInput): Promise<TCustomerAddressSelect>;

	update(
		customerId: string,
		addressId: string,
		patch: TUpdateCustomerAddressInput,
	): Promise<TCustomerAddressSelect | null>;

	softDelete(customerId: string, addressId: string): Promise<boolean>;
}
