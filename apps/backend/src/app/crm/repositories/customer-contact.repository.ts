import { DRIZZLE_TOKEN } from '@di/provider';
import { customerContacts, type TCustomerContactSelect } from '@drizzle/schemas/crm.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TCreateContactInput, TUpdateContactInput } from '../contracts/customer.contract';
import type { ICustomerContactRepository } from '../contracts/customer.repository.interface';

/**
 * Drizzle implementation of {@link ICustomerContactRepository}.
 *
 * @remarks
 * "One primary contact per customer" is kept here: making a contact primary
 * clears the flag on the others in the same transaction.
 */
@injectable()
export class CustomerContactRepository implements ICustomerContactRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private ofCustomer(customerId: string) {
		return and(eq(customerContacts.customerId, customerId), isNull(customerContacts.deletedAt));
	}

	private async clearOtherPrimaries(tx: TTx, customerId: string, keepId: string) {
		await tx
			.update(customerContacts)
			.set({ isPrimary: false, updatedAt: new Date() })
			.where(
				and(this.ofCustomer(customerId), eq(customerContacts.isPrimary, true), ne(customerContacts.id, keepId)),
			);
	}

	listByCustomer(customerId: string): Promise<TCustomerContactSelect[]> {
		return this.database
			.select()
			.from(customerContacts)
			.where(this.ofCustomer(customerId))
			.orderBy(desc(customerContacts.isPrimary), asc(customerContacts.name));
	}

	create(customerId: string, data: TCreateContactInput): Promise<TCustomerContactSelect> {
		const now = new Date();
		return this.database.transaction(async (tx) => {
			const [row] = await tx
				.insert(customerContacts)
				.values({ ...data, customerId, createdAt: now, updatedAt: now })
				.returning();
			if (row.isPrimary) await this.clearOtherPrimaries(tx, customerId, row.id);
			return row;
		});
	}

	update(customerId: string, id: string, patch: TUpdateContactInput): Promise<TCustomerContactSelect | null> {
		return this.database.transaction(async (tx) => {
			const [row] = await tx
				.update(customerContacts)
				.set({ ...patch, updatedAt: new Date() })
				.where(and(this.ofCustomer(customerId), eq(customerContacts.id, id)))
				.returning();
			if (row?.isPrimary && patch.isPrimary) await this.clearOtherPrimaries(tx, customerId, row.id);
			return row ?? null;
		});
	}

	async findById(customerId: string, id: string): Promise<TCustomerContactSelect | null> {
		const [row] = await this.database
			.select()
			.from(customerContacts)
			.where(and(this.ofCustomer(customerId), eq(customerContacts.id, id)))
			.limit(1);
		return row ?? null;
	}

	async softDelete(customerId: string, id: string): Promise<boolean> {
		const now = new Date();
		const rows = await this.database
			.update(customerContacts)
			.set({ deletedAt: now, updatedAt: now, isPrimary: false })
			.where(and(this.ofCustomer(customerId), eq(customerContacts.id, id)))
			.returning({ id: customerContacts.id });
		return rows.length > 0;
	}
}
