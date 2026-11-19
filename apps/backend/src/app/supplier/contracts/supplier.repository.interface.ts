import type {
	TSupplierCompanySelect,
	TSupplierSelect,
} from '@drizzle/schemas/supplier.schema';
import type {
	TSupplierCompanyCreateInput,
	TSupplierCompanyListQuery,
	TSupplierCompanyUpdateInput,
	TSupplierCreateInput,
	TSupplierListQuery,
	TSupplierUpdateInput,
} from './supplier.contract';

/**
 * Persistence port for `supplier.companies` and `supplier.suppliers`.
 *
 * @remarks
 * One port per module file keeps the two closely paired tables together, but
 * the concrete implementations are split so each table gets its own
 * repository (ADR-0024 "one repository per table").
 */
export interface ISupplierCompanyRepository {
	paginate(
		query: TSupplierCompanyListQuery,
	): Promise<TSupplierCompanySelect[]>;

	count(query: TSupplierCompanyListQuery): Promise<number>;

	findById(id: string): Promise<TSupplierCompanySelect | null>;

	findByCode(code: string): Promise<TSupplierCompanySelect | null>;

	create(
		data: TSupplierCompanyCreateInput & { createdBy: string },
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
	paginate(query: TSupplierListQuery): Promise<TSupplierSelect[]>;

	count(query: TSupplierListQuery): Promise<number>;

	findById(id: string): Promise<TSupplierSelect | null>;

	/** Creates a person; a new primary clears the previous one. */
	create(
		data: TSupplierCreateInput & { createdBy: string },
	): Promise<TSupplierSelect>;

	update(id: string, patch: TSupplierUpdateInput): Promise<TSupplierSelect | null>;

	softDelete(id: string): Promise<boolean>;
}
