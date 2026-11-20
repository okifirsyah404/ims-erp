/**
 * Inventory module copy.
 *
 * @remarks
 * Scoped to what the item slice renders today. Keys are added with their
 * screen, not ahead of it — `locale-dead-keys.test.ts` fails on any key that
 * no component references, which keeps this file an accurate inventory of
 * what the UI actually shows.
 *
 * Vocabulary note: `in_stock` is labelled "Ready" / "Siap". The stored value
 * is never `ready` (ADR-0008); only the label changed.
 */
const inventory = {
	// Shell.
	'adminOnly': 'Inventory management is available to application administrators only.',

	// Item list (shared by the four kind routes).

	// Kind labels.

	// Per-kind page titles.

	// Create / edit form.

	// Item detail.

	// Unit status labels.

	// Unit registration.

	// Provisional serial replacement.

	// Warehouse list.

	// Warehouse create / edit form.

	// Address fields and the location cascade.

	// Stock balances.
	'stock.title': 'Stock balances',
	'stock.description':
		'What is on hand, per warehouse. A global warehouse holds one shared balance.',
	'stock.empty': 'No stock recorded yet.',
	'stock.item': 'Item',
	'stock.warehouse': 'Warehouse',
	'stock.bin': 'Storage',
	'stock.onHand': 'On hand',
	'stock.reserved': 'Reserved',
	'stock.available': 'Available',
	'stock.lastMovement': 'Last movement',
	'stock.scope': 'Scope',
	'stock.shared': 'Shared',
	'stock.inStockOnly': 'In stock only',
	'stock.noBin': 'Unassigned',
	'stock.recompute': 'Rebuild from ledger',
	'stock.recomputeConfirm': 'Rebuild balances from the ledger?',
	'stock.recomputeConfirmBody':
		'This recalculates the balances of one scope from the movement ledger. It is a repair tool; the running balance is normally already correct.',
	'stock.recomputed': 'Balances rebuilt ({{written}} written, {{removed}} removed)',
	'stock.movements': 'Movements',
	'stock.adjust': 'Adjust stock',

	// Movement ledger.
	'movements.title': 'Stock movements',
	'movements.description':
		'The ledger. Every movement is append-only; a correction is a new row, never an edit.',
	'movements.empty': 'No movements recorded yet.',
	'movements.code': 'Code',
	'movements.type': 'Type',
	'movements.item': 'Item',
	'movements.quantity': 'Quantity',
	'movements.statusLabel': 'Status',
	'movements.occurredAt': 'Occurred',
	'movements.reference': 'Reference',
	'movements.notes': 'Notes',
	'movements.reverse': 'Reverse',
	'movements.reverseConfirm': 'Reverse this movement?',
	'movements.reverseConfirmBody':
		'Reversing appends an opposing movement. It happens once and cannot be undone; it is refused if it would take stock below zero.',
	'movements.reversed': 'Movement reversed',
	'movements.type.receipt': 'Receipt',
	'movements.type.issue': 'Issue',
	'movements.type.transfer_in': 'Transfer in',
	'movements.type.transfer_out': 'Transfer out',
	'movements.type.adjustment_in': 'Adjustment in',
	'movements.type.adjustment_out': 'Adjustment out',
	'movements.type.return_in': 'Return in',
	'movements.type.return_out': 'Return out',
	'movements.type.consumption': 'Consumption',
	'movements.type.borrow_out': 'Borrowed out',
	'movements.type.borrow_return': 'Returned from borrowing',
	'movements.type.project_site': 'Sent to project site',
	'movements.type.disposal': 'Disposal',
	'movements.type.lost': 'Lost',
	'movements.status.draft': 'Draft',
	'movements.status.posted': 'Posted',
	'movements.status.reversed': 'Reversed',

	// Adjustments list.
	'adjustments.title': 'Stock adjustments',
	'adjustments.description':
		'A count becomes a movement only after it is approved and posted.',
	'adjustments.new': 'New adjustment',
	'adjustments.empty': 'No adjustments yet.',
	'adjustments.code': 'Code',
	'adjustments.type': 'Type',
	'adjustments.statusLabel': 'Status',
	'adjustments.requestedBy': 'Requested by',
	'adjustments.requestedAt': 'Requested',
	'adjustments.approvedBy': 'Approved by',
	'adjustments.postedAt': 'Posted',
	'adjustments.notes': 'Notes',
	'adjustments.notFound': 'Adjustment not found.',
	'adjustments.lines': 'Lines',
	'adjustments.noLines': 'This adjustment has no lines.',
	'adjustments.qtyBefore': 'System',
	'adjustments.qtyAfter': 'Counted',
	'adjustments.delta': 'Difference',
	'adjustments.type.increase': 'Increase',
	'adjustments.type.decrease': 'Decrease',
	'adjustments.type.recount': 'Recount',
	'adjustments.status.draft': 'Draft',
	'adjustments.status.submitted': 'Submitted',
	'adjustments.status.approved': 'Approved',
	'adjustments.status.rejected': 'Rejected',
	'adjustments.status.posted': 'Posted',
	'adjustments.status.cancelled': 'Cancelled',

	// Adjustment workflow actions.
	'adjustmentActions.submit': 'Submit for approval',
	'adjustmentActions.approve': 'Approve',
	'adjustmentActions.reject': 'Reject',
	'adjustmentActions.cancel': 'Cancel',
	'adjustmentActions.post': 'Post to stock',
	'adjustmentActions.submitted': 'Adjustment submitted',
	'adjustmentActions.approved': 'Adjustment approved',
	'adjustmentActions.rejected': 'Adjustment rejected',
	'adjustmentActions.cancelled': 'Adjustment cancelled',
	'adjustmentActions.posted': 'Adjustment posted to stock',
	'adjustmentActions.selfApprovalBlocked':
		'You raised this adjustment, so someone else must approve it.',

	// Adjustment form.
	'adjustmentForm.new': 'New adjustment',
	'adjustmentForm.newDescription':
		'Enter the counted total per line. The difference from the system quantity becomes the movement.',
	'adjustmentForm.warehouse': 'Warehouse',
	'adjustmentForm.details': 'Adjustment details',
	'adjustmentForm.type': 'Reason',
	'adjustmentForm.reasonCode': 'Reason code',
	'adjustmentForm.notes': 'Notes',
	'adjustmentForm.lines': 'Lines',
	'adjustmentForm.linesDescription':
		'Counted total, not a difference. A line that matches the system posts nothing.',
	'adjustmentForm.item': 'Item',
	'adjustmentForm.bin': 'Storage',
	'adjustmentForm.systemQuantity': 'System',
	'adjustmentForm.countedQuantity': 'Counted',
	'adjustmentForm.difference': 'Difference',
	'adjustmentForm.lineNote': 'Note',
	'adjustmentForm.addLine': 'Add line',
	'adjustmentForm.removeLine': 'Remove',
	'adjustmentForm.create': 'Create adjustment',
	'adjustmentForm.creating': 'Creating.',
	'adjustmentForm.created': 'Adjustment created',
	'adjustmentForm.emptyLines': 'Add at least one line.',

	'adjustmentForm.unitCost': 'Unit cost (Rp)',
	'adjustmentForm.unitCostPlaceholder': 'Empty = average cost',
	'adjustmentForm.reasonOpeningStock': 'Opening stock',
	'value.title': 'Inventory value',
	'value.description': 'Stock on hand at its moving-average cost (HPP), per item and warehouse. Receipts add at their cost; deliveries and decreases leave at the average.',
	'value.total': 'Total inventory value',
	'value.allWarehouses': 'All warehouses',
	'value.balances': '{{count}} balances',
	'value.search': 'Search SKU or item name…',
	'value.empty': 'No stock on hand.',
	'value.item': 'Item',
	'value.warehouse': 'Warehouse',
	'value.quantity': 'On hand',
	'value.averageCost': 'Average cost',
	'value.totalValue': 'Value',
	'value.link': 'Inventory value',
} as const;

export default inventory;
