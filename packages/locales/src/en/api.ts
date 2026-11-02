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
} as const;

export default api;
