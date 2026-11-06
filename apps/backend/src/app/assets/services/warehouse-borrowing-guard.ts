import { inject, injectable } from 'tsyringe';
import { BORROWING_REPOSITORY_TOKEN } from '../constants/di';
import type { IBorrowingRepository } from '../contracts/borrowing.repository.interface';
import type { IWarehouseBorrowingGuard } from '@app/inventory/contracts/warehouse-borrowing-guard.port';

/**
 * Assets-side implementation of the inventory unlink guard port (ERP-0031).
 *
 * @remarks
 * A thin delegation to the borrowing repository: "open" custody is the
 * borrowing module's definition, so the counting logic lives there and this
 * class only adapts the shape. Kept separate from `BorrowingService` so the
 * port has no coupling to the borrowing state machine.
 */
@injectable()
export class WarehouseBorrowingGuard implements IWarehouseBorrowingGuard {
	constructor(
		@inject(BORROWING_REPOSITORY_TOKEN)
		private readonly borrowingRepository: IBorrowingRepository,
	) {}

	async countOpenBorrowings(
		warehouseId: string,
		organizationId: string,
	): Promise<number> {
		return this.borrowingRepository.countOpenByOriginWarehouse(
			warehouseId,
			organizationId,
		);
	}
}
