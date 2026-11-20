import { DRIZZLE_TOKEN } from '@di/provider';
import { type ChangeRequestStatus, customerChangeRequests, type TCustomerChangeRequestSelect } from '@drizzle/schemas/crm.schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ICustomerChangeRequestRepository } from '../contracts/customer-change-request.contract';

/** Drizzle implementation of {@link ICustomerChangeRequestRepository} (ERP-0076). */
@injectable()
export class CustomerChangeRequestRepository implements ICustomerChangeRequestRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	list(customerId: string, limit: number): Promise<TCustomerChangeRequestSelect[]> {
		return this.database
			.select()
			.from(customerChangeRequests)
			.where(and(eq(customerChangeRequests.customerId, customerId), isNull(customerChangeRequests.deletedAt)))
			.orderBy(desc(customerChangeRequests.createdAt))
			.limit(limit);
	}

	async findPending(customerId: string): Promise<TCustomerChangeRequestSelect | null> {
		const [row] = await this.database
			.select()
			.from(customerChangeRequests)
			.where(and(eq(customerChangeRequests.customerId, customerId), eq(customerChangeRequests.status, 'pending'), isNull(customerChangeRequests.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	create(data: Parameters<ICustomerChangeRequestRepository['create']>[0]): Promise<TCustomerChangeRequestSelect> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			await tx
				.update(customerChangeRequests)
				.set({ status: 'superseded', updatedAt: now })
				.where(and(eq(customerChangeRequests.customerId, data.customerId), eq(customerChangeRequests.status, 'pending'), isNull(customerChangeRequests.deletedAt)));
			const [row] = await tx
				.insert(customerChangeRequests)
				.values({ ...data, status: 'pending', createdAt: now, updatedAt: now })
				.returning();
			return row!;
		});
	}

	async decide(
		id: string,
		status: Extract<ChangeRequestStatus, 'approved' | 'rejected'>,
		actorUserId: string,
		note: string | null,
	): Promise<TCustomerChangeRequestSelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(customerChangeRequests)
			.set({ status, decidedByUserId: actorUserId, decidedAt: now, decisionNote: note, updatedAt: now })
			.where(and(eq(customerChangeRequests.id, id), eq(customerChangeRequests.status, 'pending'), isNull(customerChangeRequests.deletedAt)))
			.returning();
		return row ?? null;
	}
}
