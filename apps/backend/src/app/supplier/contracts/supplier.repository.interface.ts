import type {
	TSupplierCompanySelect,
	TSupplierSelect,
} from '@drizzle/schemas/supplier.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';
import type {
	TSupplierCompanyCreateInput,
	TSupplierCompanyUpdateInput,
	TSupplierCreateInput,
	TSupplierUpdateInput,
} from './supplier.contract';

/** Page settings plus the optional company filter of the supplier-person listing. */
export type TSupplierPaginationRequest = TPaginationRequest & {
	companyId?: string;
};

/** Page settings plus the filters of the supplier-company listing. */
export type TSupplierCompanyPaginationRequest = TPaginationRequest & {
	status?: string;
	search?: string;
};

/**
 * Persistence port for `supplier.companies` and `supplier.suppliers`.
 *
 * @remarks
 * One port per module file keeps the two closely paired tables together, but
 * the concrete implementations are split so each table gets its own
 * repository (ADR-0024 "one repository per table").
 */
export interface ISupplierCompanyRepository {
	/** Fetches one filtered page of supplier companies with its pagination metadata. */
	paginate(
		request: TSupplierCompanyPaginationRequest,
	): Promise<TPaginationResult<TSupplierCompanySelect>>;

	findById(id: string): Promise<TSupplierCompanySelect | null>;

	findByCode(code: string): Promise<TSupplierCompanySelect | null>;

	create(
		data: TSupplierCompanyCreateInput & { code: string; createdBy: string },
	): Promise<TSupplierCompanySelect>;

	update(
		id: string,
		patch: TSupplierCompanyUpdateInput,
	): Promise<TSupplierCompanySelect | null>;

	/** Moves `from` → `to`; `null` when the company is not in `from`. */
	transitionStatus(
		id: string,
		from: 'active' | 'inactive',
		to: 'active' | 'inactive',
	): Promise<TSupplierCompanySelect | null>;
}

/** Persistence port for `supplier.suppliers` (live rows only). */
export interface ISupplierRepository {
	/** Fetches one filtered page of supplier people with its pagination metadata. */
	paginate(
		request: TSupplierPaginationRequest,
	): Promise<TPaginationResult<TSupplierSelect>>;

	findById(id: string): Promise<TSupplierSelect | null>;

	/** Creates a person; a new primary clears the previous one. */
	create(
		data: TSupplierCreateInput & { createdBy: string },
	): Promise<TSupplierSelect>;

	update(id: string, patch: TSupplierUpdateInput): Promise<TSupplierSelect | null>;

	softDelete(id: string): Promise<boolean>;
}
