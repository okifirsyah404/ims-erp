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
	'items.description': 'Item master — SKU catalogue for this organization.',
	'items.empty': 'No items yet for this organization.',
	'items.emptyTitle': 'Nothing here yet',
	'items.sku': 'SKU',
	'items.name': 'Name',
	'items.kind': 'Kind',
	'items.tracking': 'Tracking',
	'items.serialized': 'Serialized',
	'items.quantityTracked': 'Quantity',
	'items.category': 'Category',
	'items.unitLabel': 'Unit',
	'items.minStockQty': 'Minimum stock',
	'items.sellingPrice': 'Selling price',
	'items.purchasePrice': 'Purchase price',
	'items.description_label': 'Description',
	'items.barcode': 'Barcode',
	'items.noCategory': 'No category',
	'items.brand': 'Brand',
	'items.specification': 'Specification',
	'items.specificationHint': 'Printed on quotations. One point per line.',
	'items.isActive': 'Active',
	'items.isActiveHint': 'Inactive items stay listed but are not offered for new quotations or purchase orders.',
	'items.inactive': 'Inactive',

	'categories.title': 'Item categories',
	'categories.description':
		'One level, shared by the whole company. The slug matches the category on the public website.',
	'categories.new': 'New category',
	'categories.edit': 'Edit category',
	'categories.empty': 'No categories yet.',
	'categories.slug': 'Slug',
	'categories.slugHint': 'Lower-case letters, digits and dashes, e.g. access-controllers. Cannot change later.',
	'categories.name': 'Name',
	'categories.shortName': 'Short name',
	'categories.sortOrder': 'Order',
	'categories.descriptionLabel': 'Description',
	'categories.isActive': 'Active',
	'categories.inactive': 'Inactive',
	'categories.saved': 'Category saved',
	'categories.archive': 'Archive',
	'categories.archiveConfirm': 'Archive the category {{name}}? Categories still used by items cannot be archived; deactivate them instead.',
	'categories.archived': 'Category archived',

	// Kind labels.
	'kind.product': 'Product',
	'kind.component': 'Component',
	'kind.material': 'Material',

	// Per-kind page titles.
	'products.title': 'Products',
	'components.title': 'Components',
	'materials.title': 'Materials',

	// Create / edit form.
	'form.newItem': 'New item',
	'form.newItemDescription':
		'SKU and kind are fixed at creation — both drive uniqueness and the status rules.',
	'form.editItem': 'Edit item',
	'form.editItemDescription':
		'SKU and kind cannot be changed after creation.',
	'form.create': 'Create item',
	'form.creating': 'Creating…',
	'form.save': 'Save changes',
	'form.saving': 'Saving…',
	'form.serializedHint':
		'Serialized items are tracked per unit; quantities are not counted.',
	'form.created': 'Item created',
	'form.updated': 'Item updated',
	'form.archived': 'Item archived',

	// Item detail.
	'detail.notFound': 'This item does not exist or has been archived.',
	'detail.archive': 'Archive',
	'detail.archiveConfirm': 'Archive this item?',
	'detail.archiveConfirmBody':
		'Archiving hides the item from the list. Items that still have units cannot be archived.',
	'detail.units': 'Units',
	'detail.unitsEmpty': 'No units registered yet.',
	'detail.serialNumber': 'Serial number',
	'detail.assetTag': 'Asset tag',
	'detail.status': 'Status',
	'detail.provisional': 'Provisional',

	// Unit status labels.
	'status.pre_order': 'Pre-order',
	'status.in_stock': 'Ready',
	'status.borrowed': 'Borrowed',
	'status.lost': 'Lost',
	'status.sold': 'Sold',
	'status.applied_warranty': 'Applied to warranty',

	// Unit registration.
	'unit.new': 'Register unit',
	'unit.newDescription':
		'Units are the physical instances of a serialized item.',
	'unit.serialNumber': 'Serial number',
	'unit.serialNumberHint':
		'Leave empty for a pre-order: a provisional serial is minted and replaced once on receipt.',
	'unit.register': 'Register unit',
	'unit.registering': 'Registering…',
	'unit.registered': 'Unit registered',

	// Provisional serial replacement.
	'unit.replaceSerial': 'Set real serial',
	'unit.replaceSerialBody':
		'A provisional serial can be replaced exactly once.',
	'unit.replaced': 'Serial number replaced',

	// Warehouse list.
	'warehouses.title': 'Warehouses',
	'warehouses.description':
		'Warehouse master - global and per-organization storage locations.',
	'warehouses.new': 'New warehouse',
	'warehouses.empty': 'No warehouses yet.',
	'warehouses.emptyTitle': 'No warehouses yet',
	'warehouses.noAddressTitle': 'No address recorded',
	'warehouses.code': 'Code',
	'warehouses.name': 'Name',
	'warehouses.global': 'Global',
	'warehouses.organization': 'Organization',
	'warehouses.default': 'Default',
	'warehouses.inactive': 'Inactive',
	'warehouses.notFound': 'Warehouse not found.',
	'warehouses.noAddress': 'No address recorded.',
	'warehouses.storages': 'Storages',
	'warehouses.noStorages': 'No storages recorded.',
	'warehouses.noStoragesTitle': 'No storages yet',
	'warehouses.binType': 'Type',
	'warehouses.search': 'Search',
	'warehouses.searchPlaceholder': 'Search by code or name…',
	'warehouses.filters': 'Filters',
	'warehouses.filtersTitle': 'Filter and sort',
	'warehouses.filterStatus': 'Status',
	'warehouses.statusAll': 'All',
	'warehouses.statusArchived': 'Archived',
	'warehouses.sortBy': 'Sort by',
	'warehouses.sortName': 'Name',
	'warehouses.sortCode': 'Code',
	'warehouses.sortStatus': 'Status',
	'warehouses.sortOrder': 'Order',
	'warehouses.sortAsc': 'Ascending',
	'warehouses.sortDesc': 'Descending',
	'warehouses.reset': 'Reset',
	'warehouses.apply': 'Apply',
	'warehouses.active': 'Active',
	'warehouses.products': 'Products',
	'warehouses.components': 'Components',
	'warehouses.materials': 'Materials',
	'warehouses.equipments': 'Equipments',
	'warehouses.storageTab': 'Storage',
	'warehouses.capacity': 'Capacity',
	'warehouses.state': 'State',
	'warehouses.quantity': 'Quantity',
	'warehouses.image': 'Image',
	'warehouses.activate': 'Set active',
	'warehouses.deactivate': 'Set inactive',
	'warehouses.activated': 'Warehouse activated',
	'warehouses.deactivated': 'Warehouse deactivated',
	'warehouses.archiveConfirmTitle': 'Archive this warehouse?',
	'warehouses.archiveConfirmBody':
		'Archiving hides the warehouse from the list. Warehouses that still hold units cannot be archived.',
	'warehouses.archived': 'Warehouse archived',
	'warehouses.addStorage': 'Add storage',
	'warehouses.editStorage': 'Edit storage',
	'warehouses.storageCode': 'Code',
	'warehouses.storageName': 'Name',
	'warehouses.storageCodeHint':
		'Unique within this warehouse, fixed after creation.',
	'warehouses.storageCreated': 'Storage created',
	'warehouses.storageUpdated': 'Storage updated',
	'warehouses.storageArchived': 'Storage archived',
	'warehouses.organizationsTab': 'Organizations',
	'warehouses.linkedOrganizations': 'Linked organizations',
	'warehouses.linkedOrganizationsHint':
		'Organizations that may store stock and assets in this warehouse.',
	'warehouses.selectOrganization': 'Select an organization',
	'warehouses.linkAction': 'Link',
	'warehouses.unlinkAction': 'Unlink',
	'warehouses.unlinkConfirm':
		'Revoke this organization\u2019s access to the warehouse?',
	'warehouses.linkCreated': 'Organization linked',
	'warehouses.linkAlreadyExists': 'Organization already linked',
	'warehouses.linkRemoved': 'Organization unlinked',
	'warehouses.noLinkedOrganizations': 'No organizations linked yet.',
	'warehouses.linkedSince': 'Linked since',

	// Warehouse create / edit form.
	'warehouseForm.new': 'New warehouse',
	'warehouseForm.newDescription':
		'Code and scope are fixed at creation. A warehouse with no organization is global.',
	'warehouseForm.edit': 'Edit warehouse',
	'warehouseForm.editDescription':
		'Code and scope cannot be changed after creation.',
	'warehouseForm.details': 'Details',
	'warehouseForm.detailsDescription':
		'Only one warehouse can be the default within a scope.',
	'warehouseForm.code': 'Code',
	'warehouseForm.name': 'Name',
	'warehouseForm.isDefault': 'Default warehouse',
	'warehouseForm.isDefaultHint':
		'Setting this as default clears the previous default in the same scope.',
	'warehouseForm.isActive': 'Active',
	'warehouseForm.address': 'Address',
	'warehouseForm.addressDescription':
		'Structured per region. Only the village is stored on the address.',
	'warehouseForm.create': 'Create warehouse',
	'warehouseForm.saving': 'Saving.',
	'warehouseForm.created': 'Warehouse created',
	'warehouseForm.updated': 'Warehouse updated',

	// Address fields and the location cascade.
	'address.label': 'Label',
	'address.street': 'Address',
	'address.rt': 'RT',
	'address.rw': 'RW',
	'address.postalCode': 'Postal code',
	'address.province': 'Province',
	'address.regency': 'Regency / city',
	'address.district': 'District',
	'address.village': 'Village',
	'address.searchProvince': 'Search province',
	'address.searchRegency': 'Search regency',
	'address.searchDistrict': 'Search district',
	'address.searchVillage': 'Search village',
	'address.noResults': 'No results',

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
	'movements.type.borrowing_out': 'Borrowed out',
	'movements.type.borrowing_in': 'Returned from borrowing',
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


	'items.documentPhoto': 'Photo on documents',
	'items.documentPhotoHint': 'Printed in the Gambar column of quotations. PNG, JPG or WebP, at most 2 MB. Quotations already issued keep their photo.',
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
