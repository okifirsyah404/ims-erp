/**
 * Backend API messages, returned in the response envelope's `message` and
 * `errors[].message` fields. Resolved per request from `Accept-Language`.
 *
 * English is the source of truth; `id` mirrors this key set exactly (enforced
 * by `locale-parity.test.ts`).
 *
 * Keys are flat and dot-notated: `{domain}.{message}`. Success acknowledgements
 * (`OK`, `Created`, …) are protocol tokens, not prose, and stay untranslated.
 */
const api = {
	'common.validationFailed': 'Validation failed',
	'common.notFound': 'Not found',
	'common.conflict': 'Conflict',
	'common.unsupportedMediaType': 'Unsupported media type',
	'common.payloadTooLarge': 'Payload too large',
	'common.authenticationRequired': 'Authentication required',

	'location.provinceNotFound': 'Province not found',
	'location.regencyNotFound': 'Regency not found',
	'location.districtNotFound': 'District not found',
	'location.villageNotFound': 'Village not found',

	'sales.quotationNotFound': 'Quotation not found',
	'sales.paymentNotFound': 'Payment not found',

	'inventory.itemNotFound': 'Item not found',
	'inventory.unitNotFound': 'Item unit not found',
	'inventory.skuTaken': 'An item with this SKU already exists',
	'inventory.serialTaken': 'An item unit with this serial number already exists',
	'inventory.ruleViolation': 'This inventory rule does not allow it: {{rule}}',
	'inventory.itemHasUnits':
		'Cannot archive an item that still has {{count}} live unit(s)',
	'inventory.warehouseNotFound': 'Warehouse not found',
	'inventory.warehouseCodeTaken':
		'A warehouse with this code already exists in this scope',
	'inventory.warehouseHasUnits':
		'Cannot archive a warehouse that still holds {{count}} live unit(s)',
	'inventory.warehouseLinkConflict':
		'Cannot unlink while the organization holds {{count}} open borrowing(s) originating in this warehouse',
	'inventory.storageNotFound': 'Storage not found',
	'inventory.storageCodeTaken':
		'A storage with this code already exists in this warehouse',
	'inventory.warehouseInactive':
		'Warehouse "{{warehouseCode}}" is inactive; its storages cannot be changed',
	'inventory.movementNotFound': 'Stock movement not found',
	'inventory.movementAlreadyReversed':
		'This stock movement has already been reversed',
	'inventory.insufficientStock':
		'Cannot move {{requested}}: only {{available}} on hand',
	'inventory.adjustmentNotFound': 'Stock adjustment not found',
	'inventory.adjustmentCodeTaken':
		'An adjustment with this code already exists in this organization',
	'inventory.adjustmentTransition':
		'An adjustment cannot move from "{{from}}" to "{{to}}"',
	'inventory.selfApprovalForbidden':
		'You cannot approve your own stock adjustment',
	'inventory.adjustmentHasNoLines':
		'A stock adjustment must have at least one line',

	'assets.assetNotFound': 'Asset not found',
	'assets.categoryNotFound': 'Asset category not found',
	'assets.categoryCodeTaken':
		'An asset category with this code already exists',
	'assets.ruleViolation': 'This asset rule does not allow it: {{rule}}',
	'assets.illegalTransition':
		'An asset cannot move from "{{from}}" to "{{to}}"',
	'assets.assetHasHistory':
		'Cannot archive an asset with custody or maintenance history',
	'assets.placeBlocked':
		'This asset cannot be placed in its current status',
	'assets.transferBlocked':
		'This asset cannot be transferred in its current status',
	'assets.periodAlreadyDepreciated':
		'This asset already has a depreciation entry for {{period}}',
	'assets.depreciationExceedsBookValue':
		'Depreciation cannot exceed the remaining book value',
	'assets.toolSetNotEmpty':
		'Cannot archive a tool set that still holds items',

	'user.notFound': 'User not found',
	'user.emailInUse': 'Email already in use',
	'user.globalAdminRequired': 'Global administrator role required',
	'user.fileFieldExpected': 'Expected a multipart file field',
	'user.avatarTooLarge': 'Avatar must be 2 MiB or smaller',
	'user.avatarUnsupportedType': 'Avatar must be a PNG, JPEG, or WebP image',

	'organization.lastOrganization':
		'This is your last organization and cannot be removed',
	'organization.notFound': 'Organization not found',
	'organization.slugTaken': 'Organization slug is already taken',
	'organization.alreadyDeleted': 'Organization is already deleted',
	'organization.notDeleted': 'Organization is not deleted',
	'organization.memberNotFound': 'Member not found',
	'organization.lastOwner': 'Cannot remove or demote the last owner',

	'invitation.notFound': 'Invitation not found',
	'invitation.pendingExists': 'A pending invitation already exists for this email',
	'invitation.notPending': 'Invitation is not pending',
	'invitation.claimed':
		'Claimed invitations cannot be deleted; deactivate the user instead',
	'invitation.invalidPayload':
		'Organization invites require both organizationId and roleId',
	'invitation.requiresName': 'Application invites require name',
	'invitation.invalidLink': 'Invitation link is invalid or expired',
	'invitation.alreadyUsed': 'This invitation was already used',
	'invitation.inactive': 'This invitation is no longer active',
	'invitation.expired': 'This invitation link has expired',
	'invitation.bulkLimited': 'Bulk limited to {{max}} rows',
	'invitation.claimUserMissing': 'Invited user no longer exists',
	'invitation.claimAlreadyActive': 'This account is already active',
	'invitation.claimInvalid': 'Invalid claim data',

	'claim.usernameTaken': 'Username is already taken',
	'claim.phoneInUse': 'Phone number is already in use',
	'claim.alreadyInUse': 'Username or email already in use',

	'role.notFound': 'Role not found',
	'role.nameTaken': 'A role named "{{name}}" already exists in this organization',
	'role.inUse': 'This role cannot be removed: it is a system role or still assigned',
	'role.systemRole': '"{{role}}" is a system role and cannot be deleted',
	'role.stillAssigned':
		'{{count}} member(s) still hold "{{role}}"; reassign them first',
	'role.invalidPermission': 'Permission grant is outside the catalog',
	'role.unknownResource': '{{label}}: unknown resource "{{resource}}"',
	'role.unknownAction': '{{label}}: "{{resource}}" has no action "{{action}}"',
	'role.rankExceeded': 'You cannot grant a role at or above your own rank',
	'role.targetRankExceeded':
		'Target holds "{{role}}" (rank {{rank}}) in your organization',

	'userAdmin.accountAlreadyActive': 'Account is already active',
	'userAdmin.cannotDeactivate':
		'Cannot deactivate an account that is not active',

	'auth.ownerGrantRequired': 'Only organization owners can grant the owner role',
	'auth.roleNotGrantable': 'Role not grantable: {{roles}}',

	// Borrowing (S4)
	'assets.borrowingNotFound': 'Borrowing not found',
	'assets.borrowingLineNotFound': 'Borrowing line not found',
	'assets.unitNotOnBorrowing': 'That asset is not issued on this borrowing',
	'assets.borrowingTransition':
		'That status change is not allowed for this borrowing',
	'assets.borrowingCodeTaken': 'Could not allocate a unique borrowing code',
	'assets.borrowingHasNoLines': 'A borrowing must have at least one line',
	'assets.unitNotAvailable': 'That asset cannot be issued',
	'assets.borrowerIdentity':
		'The borrower identity does not match the borrower type',
	'assets.guestIdentityIncomplete':
		'A guest borrower is missing required identity data',
	'assets.borrowingSelfApprovalForbidden':
		'You cannot approve your own borrowing',
} as const;

export default api;
