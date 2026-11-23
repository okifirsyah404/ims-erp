import { DRIZZLE_TOKEN } from '@di/provider';
import { employeeAddresses } from '@drizzle/schemas/human-resource.schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IEmployeeAddressRepository, TEmployeeAddressInput } from '../contracts/employee-document.contract';

/** Drizzle implementation of {@link IEmployeeAddressRepository}. */
@injectable()
export class EmployeeAddressRepository implements IEmployeeAddressRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findPrimary(employeeId: string) {
		const [row] = await this.database
			.select()
			.from(employeeAddresses)
			.where(and(eq(employeeAddresses.employeeId, employeeId), eq(employeeAddresses.isPrimary, true), isNull(employeeAddresses.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async savePrimaryResidence(employeeId: string, input: TEmployeeAddressInput) {
		const now = new Date();
		return this.database.transaction(async (tx) => {
			// Soft delete the previous primary first: the partial unique index allows one live primary.
			await tx
				.update(employeeAddresses)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(employeeAddresses.employeeId, employeeId), eq(employeeAddresses.isPrimary, true), isNull(employeeAddresses.deletedAt)));
			const [row] = await tx
				.insert(employeeAddresses)
				.values({
					employeeId,
					kind: 'residence',
					addressLine: input.addressLine,
					villageId: input.villageId,
					postalCode: input.postalCode,
					isPrimary: true,
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			return row!;
		});
	}
}
