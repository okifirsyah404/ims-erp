/**
 * Asset module copy (M06, hardening plan Phase A-4).
 *
 * @remarks
 * Keys are added with their screen, not ahead of it — the dead-key test
 * fails on any key no component references. Status/condition/type labels
 * are composed at runtime (`t(`assets:status.${value}`)`), so they live
 * under the dynamic prefixes the dead-key test whitelists.
 */
const assets = {
	// Register list.
	'register.title': 'Asset Register',
	'register.description':
		'Equipment, vehicles and tools owned by this organization.',
	'register.empty': 'No assets registered yet for this organization.',
	'register.emptyTitle': 'Nothing here yet',
	'register.new': 'Register asset',
	'register.searchPlaceholder': 'Search code, name or serial number…',
	'register.includeArchived': 'Include archived',
	'register.filterAllStatuses': 'All statuses',
	'register.code': 'Code',
	'register.name': 'Name',
	'register.status': 'Status',
	'register.condition': 'Condition',
	'register.bookValue': 'Book value',
	'register.serialNumber': 'Serial number',
	'register.location': 'Location',
	'register.acquisitionCost': 'Acquisition cost',

	// Register detail.
	'detail.title': 'Asset detail',
	'detail.custody': 'Custody',
	'detail.movements': 'Movements',
	'detail.conditionChecks': 'Condition checks',
	'detail.maintenances': 'Service records',
	'detail.depreciations': 'Depreciation',
	'detail.documents': 'Documents',
	'detail.noHistory': 'Nothing recorded yet.',
	'detail.returnedAt': 'Returned at',
	'detail.deactivate': 'Deactivate',
	'detail.archive': 'Archive',
	'detail.assign': 'Assign',
	'detail.return': 'Return',
	'detail.dispose': 'Dispose',

	// Forms.
	'form.newAsset': 'Register asset',
	'form.newAssetDescription':
		'The code is allocated automatically. Costs are exact amounts.',
	'form.editAsset': 'Edit asset',
	'form.editAssetDescription':
		'Code, status and valuation are managed by operations.',
	'form.create': 'Create asset',
	'form.creating': 'Creating.',
	'form.save': 'Save changes',
	'form.saving': 'Saving.',
	'form.deactivateTitle': 'Deactivate asset',
	'form.deactivateDescription':
		'The asset is parked; a reason is required (audit).',
	'form.reason': 'Reason',
	'form.reasonPlaceholder': 'Why is this asset being deactivated?',
	'form.deactivate': 'Deactivate',
	'form.deactivating': 'Deactivating.',
	'form.assignTitle': 'Assign asset',
	'form.assignDescription': 'Custody is recorded; the asset becomes in use.',
	'form.holderUserId': 'Holder (user id)',
	'form.notes': 'Notes',
	'form.assign': 'Assign',
	'form.assigning': 'Assigning.',
	'form.returnTitle': 'Return asset',
	'form.returnDescription': 'Condition-in is recorded on the custody row.',
	'form.return': 'Return asset',
	'form.returning': 'Returning.',
	'form.disposeTitle': 'Request disposal',
	'form.disposeDescription':
		'A disposal is created in draft; approval and execution follow.',
	'form.proceedsAmount': 'Proceeds',
	'form.dispose': 'Create disposal',
	'form.cancel': 'Cancel',

	// Disposals page.
	'disposals.title': 'Disposals',
	'disposals.description':
		'Disposal workflow records; executed rows keep the asset as financial proof.',
	'disposals.empty': 'No disposals recorded yet.',
	'disposals.emptyTitle': 'Nothing here yet',
	'disposals.code': 'Code',
	'disposals.status': 'Status',
	'disposals.method': 'Method',
	'disposals.proceeds': 'Proceeds',
	'disposals.approve': 'Approve',
	'disposals.execute': 'Execute',
	'disposals.cancel': 'Cancel',
	'disposals.approved': 'Disposal approved.',
	'disposals.executed': 'Disposal executed; the asset is retired.',
	'disposals.cancelled': 'Disposal cancelled.',

	// Loans page.
	'loans.title': 'Loans',
	'loans.description':
		'Open and past custody assignments across the register.',
	'loans.empty': 'No custody assignments recorded yet.',
	'loans.emptyTitle': 'Nothing here yet',
	'loans.open': 'Open',
	'loans.filterAll': 'All loans',
	'loans.assign': 'Assign',
	'loans.return': 'Return',

	// Service records page.
	'service.title': 'Service Records',
	'service.description': 'Maintenance history per asset.',
	'service.empty': 'No service records yet.',
	'service.emptyTitle': 'Nothing here yet',

	// Depreciation page.
	'depreciation.title': 'Depreciation',
	'depreciation.description':
		'Manual monthly depreciation entries (finance-style log).',
	'depreciation.empty': 'No depreciation entries yet.',
	'depreciation.emptyTitle': 'Nothing here yet',
	'depreciation.period': 'Period',
	'depreciation.record': 'Record entry',
	'depreciation.periodYear': 'Year',
	'depreciation.periodMonth': 'Month',
	'depreciation.depreciationAmount': 'Depreciation amount',

	// Tool sets page.
	'toolSets.title': 'Tool Sets',
	'toolSets.description': 'Kits lent to technicians as one unit.',
	'toolSets.empty': 'No tool sets yet.',
	'toolSets.emptyTitle': 'Nothing here yet',
	'toolSets.new': 'New tool set',
	'toolSets.code': 'Code',
	'toolSets.name': 'Name',
	'toolSets.addItem': 'Add item',
	'toolSets.removeItem': 'Remove',
	'toolSets.assetId': 'Asset id',
	'toolSets.created': 'Tool set created.',
	'toolSets.itemAdded': 'Item added to the tool set.',
	'toolSets.itemRemoved': 'Item removed from the tool set.',

	// Categories page.
	'categories.title': 'Asset Categories',
	'categories.description':
		'Classification and default depreciation rules per category.',
	'categories.empty': 'No categories yet.',
	'categories.emptyTitle': 'Nothing here yet',
	'categories.new': 'New category',
	'categories.code': 'Code',
	'categories.name': 'Name',
	'categories.assetType': 'Asset type',
	'categories.depMethod': 'Default depreciation',
	'categories.lifeMonths': 'Useful life (months)',
	'categories.created': 'Category created.',

	// Enum labels (composed at runtime).
	'status.in_stock': 'In stock',
	'status.in_use': 'In use',
	'status.maintenance': 'Maintenance',
	'status.inactive': 'Inactive',
	'status.disposed': 'Disposed',
	'status.lost': 'Lost',
	'condition.new': 'New',
	'condition.good': 'Good',
	'condition.fair': 'Fair',
	'condition.poor': 'Poor',
	'condition.damaged': 'Damaged',
	'type.equipment': 'Equipment',
	'type.vehicle': 'Vehicle',
	'type.tool': 'Tool',
	'type.furniture': 'Furniture',
	'type.it': 'IT',
	'type.intangible': 'Intangible',
	'disposalStatus.draft': 'Draft',
	'disposalStatus.submitted': 'Submitted',
	'disposalStatus.approved': 'Approved',
	'disposalStatus.executed': 'Executed',
	'disposalStatus.cancelled': 'Cancelled',
	'disposalMethod.sale': 'Sale',
	'disposalMethod.scrap': 'Scrap',
	'disposalMethod.donation': 'Donation',
	'disposalMethod.transfer': 'Transfer',
	'disposalMethod.trade_in': 'Trade-in',
	'maintenanceType.preventive': 'Preventive',
	'maintenanceType.corrective': 'Corrective',
	'maintenanceType.calibration': 'Calibration',
	'maintenanceType.inspection': 'Inspection',
	'toolSetStatus.available': 'Available',
	'toolSetStatus.lent': 'Lent',
	'toolSetStatus.maintenance': 'Maintenance',
	'toolSetStatus.retired': 'Retired',
	'maintenanceStatus.scheduled': 'Scheduled',
	'maintenanceStatus.in_progress': 'In progress',
	'maintenanceStatus.completed': 'Completed',
	'maintenanceStatus.cancelled': 'Cancelled',

	// Feedback.
	'created': 'Asset registered.',	'updated': 'Asset updated.',
	'deactivated': 'Asset deactivated.',
	'reactivated': 'Asset reactivated.',
	'archived': 'Asset archived.',
	'assigned': 'Asset assigned.',
	'returned': 'Asset returned.',
	'depreciated': 'Depreciation recorded.',
	'serviced': 'Service record saved.',
	'disposalRequested': 'Disposal requested.',
} as const;

export default assets;