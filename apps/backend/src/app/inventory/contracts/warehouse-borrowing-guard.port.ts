/**
 * Port: "does this organization still hold open asset borrowings that
 * originated in this warehouse?" (ERP-0031).
 *
 * @remarks
 * Inventory cannot import Assets (the dependency points the other way:
 * Assets borrows `WAREHOUSE_SERVICE_TOKEN`), so the check is expressed as a
 * port here and implemented by `registerAssets` over the borrowing
 * repository. The only consumer today is `WarehouseService.unlinkOrganization`,
 * which refuses to cut a link while the organization could not return units.
 *
 * "Open" means the borrowing header is `issued` or `partially_returned` —
 * i.e. custody has left the warehouse and not fully come back. Drafts and
 * approvals do not hold custody and do not block.
 */
export interface IWarehouseBorrowingGuard {
	/**
	 * Counts open borrowing lines with the given origin warehouse for one
	 * organization.
	 *
	 * @param warehouseId - The warehouse being unlinked
	 * @param organizationId - The organization being unlinked
	 * @returns The number of blocking lines (0 = safe to unlink)
	 */
	countOpenBorrowings(warehouseId: string, organizationId: string): Promise<number>;
}

/** Null-object used when the asset module is not registered (tests). */
export class NoopWarehouseBorrowingGuard implements IWarehouseBorrowingGuard {
	async countOpenBorrowings(): Promise<number> {
		return 0;
	}
}
