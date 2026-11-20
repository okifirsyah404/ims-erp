import { DRIZZLE_TOKEN } from '@di/provider';
import {
	customerAddresses,
	customerCompanyAddresses,
	type TCustomerAddressSelect,
	type TCustomerCompanyAddressSelect,
} from '@drizzle/schemas/customer.schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	TCompanyAddressInput,
	TCustomerAddressInput,
	TUpdateCompanyAddressInput,
	TUpdateCustomerAddressInput,
} from '../contracts/customer.contract';
import type {
	ICompanyAddressRepository,
	ICustomerAddressRepository,
} from '../contracts/customer.repository.interface';

/**
 * Drizzle implementation of {@link ICompanyAddressRepository}.
 *
 * @remarks
 * Thin owner-scoped CRUD with no cache: address sets are small and always
 * read through their owner.
 */
@injectable()
export class CompanyAddressRepository implements ICompanyAddressRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private scoped(companyId: string, addressId?: string) {
		return and(
			eq(customerCompanyAddresses.companyId, companyId),
			isNull(customerCompanyAddresses.deletedAt),
			addressId ? eq(customerCompanyAddresses.id, addressId) : undefined,
		);
	}

	async listByCompany(companyId: string): Promise<TCustomerCompanyAddressSelect[]> {
		return this.database.select().from(customerCompanyAddresses).where(this.scoped(companyId));
	}

	async findById(companyId: string, addressId: string): Promise<TCustomerCompanyAddressSelect | null> {
		const [row] = await this.database
			.select()
			.from(customerCompanyAddresses)
			.where(this.scoped(companyId, addressId))
			.limit(1);
		return row ?? null;
	}

	async create(companyId: string, data: TCompanyAddressInput): Promise<TCustomerCompanyAddressSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(customerCompanyAddresses)
			.values({ ...data, companyId, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(
		companyId: string,
		addressId: string,
		patch: TUpdateCompanyAddressInput,
	): Promise<TCustomerCompanyAddressSelect | null> {
		const [row] = await this.database
			.update(customerCompanyAddresses)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.scoped(companyId, addressId))
			.returning();
		return row ?? null;
	}

	async softDelete(companyId: string, addressId: string): Promise<boolean> {
		const rows = await this.database
			.update(customerCompanyAddresses)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(this.scoped(companyId, addressId))
			.returning({ id: customerCompanyAddresses.id });
		return rows.length > 0;
	}
}

/**
 * Drizzle implementation of {@link ICustomerAddressRepository} for person
 * addresses. Same shape as the company variant, on `customer.addresses`.
 */
@injectable()
export class CustomerAddressRepository implements ICustomerAddressRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private scoped(customerId: string, addressId?: string) {
		return and(
			eq(customerAddresses.customerId, customerId),
			isNull(customerAddresses.deletedAt),
			addressId ? eq(customerAddresses.id, addressId) : undefined,
		);
	}

	async listByCustomer(customerId: string): Promise<TCustomerAddressSelect[]> {
		return this.database.select().from(customerAddresses).where(this.scoped(customerId));
	}

	async findById(customerId: string, addressId: string): Promise<TCustomerAddressSelect | null> {
		const [row] = await this.database
			.select()
			.from(customerAddresses)
			.where(this.scoped(customerId, addressId))
			.limit(1);
		return row ?? null;
	}

	async create(customerId: string, data: TCustomerAddressInput): Promise<TCustomerAddressSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(customerAddresses)
			.values({ ...data, customerId, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(
		customerId: string,
		addressId: string,
		patch: TUpdateCustomerAddressInput,
	): Promise<TCustomerAddressSelect | null> {
		const [row] = await this.database
			.update(customerAddresses)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.scoped(customerId, addressId))
			.returning();
		return row ?? null;
	}

	async softDelete(customerId: string, addressId: string): Promise<boolean> {
		const rows = await this.database
			.update(customerAddresses)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(this.scoped(customerId, addressId))
			.returning({ id: customerAddresses.id });
		return rows.length > 0;
	}
}
