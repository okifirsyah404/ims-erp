import { DRIZZLE_TOKEN } from '@di/provider';
import { type CustomerAddressKind, customerAddresses, type TCustomerAddressSelect } from '@drizzle/schemas/crm.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ICustomerAddressRepository, TAddressWrite } from '../contracts/customer-address.contract';

/**
 * Drizzle implementation of {@link ICustomerAddressRepository} (ERP-0075).
 * "One primary per customer and kind" is kept here, in the write transaction.
 */
@injectable()
export class CustomerAddressRepository implements ICustomerAddressRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private ofCustomer(customerId: string) {
		return and(eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt));
	}

	private async clearOtherPrimaries(tx: TTx, customerId: string, kind: CustomerAddressKind, keepId: string) {
		await tx
			.update(customerAddresses)
			.set({ isPrimary: false, updatedAt: new Date() })
			.where(
				and(
					this.ofCustomer(customerId),
					eq(customerAddresses.kind, kind),
					eq(customerAddresses.isPrimary, true),
					ne(customerAddresses.id, keepId),
				),
			);
	}

	list(customerId: string, kind?: CustomerAddressKind): Promise<TCustomerAddressSelect[]> {
		return this.database
			.select()
			.from(customerAddresses)
			.where(kind ? and(this.ofCustomer(customerId), eq(customerAddresses.kind, kind)) : this.ofCustomer(customerId))
			.orderBy(desc(customerAddresses.isPrimary), asc(customerAddresses.createdAt));
	}

	create(customerId: string, data: TAddressWrite): Promise<TCustomerAddressSelect> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.insert(customerAddresses)
				.values({ ...data, customerId, createdAt: now, updatedAt: now })
				.returning();
			if (data.isPrimary) await this.clearOtherPrimaries(tx, customerId, data.kind, row!.id);
			return row!;
		});
	}

	update(customerId: string, id: string, data: TAddressWrite): Promise<TCustomerAddressSelect | null> {
		return this.database.transaction(async (tx) => {
			const [row] = await tx
				.update(customerAddresses)
				.set({ ...data, updatedAt: new Date() })
				.where(and(this.ofCustomer(customerId), eq(customerAddresses.id, id)))
				.returning();
			if (row && data.isPrimary) await this.clearOtherPrimaries(tx, customerId, data.kind, row.id);
			return row ?? null;
		});
	}

	async softDelete(customerId: string, id: string): Promise<boolean> {
		const now = new Date();
		const rows = await this.database
			.update(customerAddresses)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(this.ofCustomer(customerId), eq(customerAddresses.id, id)))
			.returning({ id: customerAddresses.id });
		return rows.length > 0;
	}
}
