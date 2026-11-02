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

	// Kind labels.
	'kind.product': 'Product',
	'kind.component': 'Component',
	'kind.material': 'Material',
	'kind.tool': 'Tool',
	'kind.service': 'Service',

	// Per-kind page titles.
	'products.title': 'Products',
	'components.title': 'Components',
	'materials.title': 'Materials',
	'tools.title': 'Tools',

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
	'form.serviceHint': 'A service is never serialized and never stocked.',
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
	'warehouses.code': 'Code',
	'warehouses.name': 'Name',
	'warehouses.scope': 'Scope',
	'warehouses.global': 'Global',
	'warehouses.organization': 'Organization',
	'warehouses.status': 'Status',
	'warehouses.default': 'Default',
	'warehouses.inactive': 'Inactive',
	'warehouses.notFound': 'Warehouse not found.',
	'warehouses.noAddress': 'No address recorded.',
	'warehouses.storages': 'Storages',
	'warehouses.noStorages': 'No storages recorded.',
	'warehouses.binType': 'Type',

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
	'address.street': 'Street',
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
} as const;

export default inventory;
