import { DRIZZLE_TOKEN } from '@di/provider';
import {
	supplierAddresses,
	supplierCompanyAddresses,
	type TSupplierAddressInsert,
	type TSupplierAddressSelect,
	type TSupplierCompanyAddressInsert,
	type TSupplierCompanyAddressSelect,
} from '@drizzle/schemas/supplier.schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	ISupplierAddressRepository,
	ISupplierCompanyAddressRepository,
} from '../contracts/supplier.repository.interface';

/**
 * Drizzle implementation of {@link ISupplierCompanyAddressRepository}.
 *
 * @remarks
 * Thin owner-scoped CRUD with no cache: address sets are small and always read
 * through their owner (same shape as the customer module's repositories).
 */
@injectable()
export class SupplierCompanyAddressRepository
	implements ISupplierCompanyAddressRepository
{
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private scoped(companyId: string, addressId?: string) {
		return and(
			eq(supplierCompanyAddresses.companyId, companyId),
			isNull(supplierCompanyAddresses.deletedAt),
			addressId ? eq(supplierCompanyAddresses.id, addressId) : undefined,
		);
	}

	async listByCompany(
		companyId: string,
	): Promise<TSupplierCompanyAddressSelect[]> {
		return this.database
			.select()
			.from(supplierCompanyAddresses)
			.where(this.scoped(companyId));
	}

	async findById(
		companyId: string,
		addressId: string,
	): Promise<TSupplierCompanyAddressSelect | null> {
		const [row] = await this.database
			.select()
			.from(supplierCompanyAddresses)
			.where(this.scoped(companyId, addressId))
			.limit(1);
		return row ?? null;
	}

	async create(
		companyId: string,
		data: Omit<TSupplierCompanyAddressInsert, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
	): Promise<TSupplierCompanyAddressSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(supplierCompanyAddresses)
			.values({ ...data, companyId, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(
		companyId: string,
		addressId: string,
		patch: Parameters<ISupplierCompanyAddressRepository['update']>[2],
	): Promise<TSupplierCompanyAddressSelect | null> {
		const [row] = await this.database
			.update(supplierCompanyAddresses)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.scoped(companyId, addressId))
			.returning();
		return row ?? null;
	}

	async softDelete(companyId: string, addressId: string): Promise<boolean> {
		const rows = await this.database
			.update(supplierCompanyAddresses)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(this.scoped(companyId, addressId))
			.returning({ id: supplierCompanyAddresses.id });
		return rows.length > 0;
	}
}

/**
 * Drizzle implementation of {@link ISupplierAddressRepository} for person
 * addresses. Same shape as the company variant, on `supplier.addresses`.
 */
@injectable()
export class SupplierAddressRepository implements ISupplierAddressRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private scoped(supplierId: string, addressId?: string) {
		return and(
			eq(supplierAddresses.supplierId, supplierId),
			isNull(supplierAddresses.deletedAt),
			addressId ? eq(supplierAddresses.id, addressId) : undefined,
		);
	}

	async listByPerson(supplierId: string): Promise<TSupplierAddressSelect[]> {
		return this.database
			.select()
			.from(supplierAddresses)
			.where(this.scoped(supplierId));
	}

	async findById(
		supplierId: string,
		addressId: string,
	): Promise<TSupplierAddressSelect | null> {
		const [row] = await this.database
			.select()
			.from(supplierAddresses)
			.where(this.scoped(supplierId, addressId))
			.limit(1);
		return row ?? null;
	}

	async create(
		supplierId: string,
		data: Omit<TSupplierAddressInsert, 'id' | 'supplierId' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
	): Promise<TSupplierAddressSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(supplierAddresses)
			.values({ ...data, supplierId, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(
		supplierId: string,
		addressId: string,
		patch: Parameters<ISupplierAddressRepository['update']>[2],
	): Promise<TSupplierAddressSelect | null> {
		const [row] = await this.database
			.update(supplierAddresses)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.scoped(supplierId, addressId))
			.returning();
		return row ?? null;
	}

	async softDelete(supplierId: string, addressId: string): Promise<boolean> {
		const rows = await this.database
			.update(supplierAddresses)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(this.scoped(supplierId, addressId))
			.returning({ id: supplierAddresses.id });
		return rows.length > 0;
	}
}
